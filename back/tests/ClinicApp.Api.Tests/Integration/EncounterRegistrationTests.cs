using System.Net;
using System.Net.Http.Json;
using System.Text.Json.Nodes;
using ClinicApp.Api.Tests.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace ClinicApp.Api.Tests.Integration;

/// <summary>
/// POST …/encounters/register: tratamientos realizados (con insumos), atención, historia y cita en una sola
/// transacción.
/// </summary>
[Collection(ApiCollection.Name)]
public class EncounterRegistrationTests(ApiFactory api)
{
    private sealed record Setup(HttpClient Admin, HttpClient Medico, Guid PatientId, Guid ProfessionalId, JsonNode Treatment, JsonNode Item, JsonNode Appointment);

    /// <summary>
    /// Paciente con una cita de hoy, un insumo con 10 en stock, un tratamiento que consume 4 y, en la historia,
    /// un propuesto con id "plan-1" de ese tratamiento.
    /// </summary>
    private async Task<Setup> SetupAsync(string appointmentStatus = "programada")
    {
        var admin = await api.As("admin");
        var medico = await api.As("medico");
        var patient = await admin.CreatePatientAsync();
        var professional = await admin.ProfessionalIdAsync();
        var item = await admin.PostJson("/api/inventory/items", new
        {
            name = $"Anestesia {TestData.Next()}", category = "Consumibles", unit = "cartucho", kind = "consumible", minStock = 1, unitCost = 2,
        }, HttpStatusCode.Created);
        await admin.PostJson($"/api/inventory/items/{item.Id()}/movements", new { type = "entrada", quantity = 10, reason = "Compra", expirationDate = "" }, HttpStatusCode.Created);
        var treatment = await admin.PostJson("/api/treatments", new
        {
            name = $"Endodoncia {TestData.Next()}", category = "Endodoncia", durationMinutes = 60, price = 120, active = true,
            consumption = new[] { new { itemId = item.Id(), quantity = 4 } },
        }, HttpStatusCode.Created);
        var appointment = await admin.PostJson("/api/appointments", new
        {
            patientId = patient.Str("id"), professionalId = professional.ToString(), treatmentId = treatment.Str("id"), roomId = "",
            date = TestData.TodayInClinic().Iso(), startTime = "00:10", endTime = "00:40", notes = "",
        }, HttpStatusCode.Created);
        if (appointmentStatus != "programada")
            await admin.PatchJson($"/api/appointments/{appointment.Id()}/status", new { status = appointmentStatus }, HttpStatusCode.OK);

        var record = (await medico.GetJson($"/api/clinical-history/patients/{patient.Id()}"))!["record"]!.AsObject();
        record["plan"] = new JsonArray(
            new JsonObject { ["id"] = "plan-1", ["treatmentId"] = treatment.Str("id"), ["description"] = "", ["tooth"] = "26", ["phase"] = "", ["plannedDate"] = "" },
            new JsonObject { ["id"] = "plan-2", ["treatmentId"] = treatment.Str("id"), ["description"] = "", ["tooth"] = "27", ["phase"] = "", ["plannedDate"] = "" });
        await medico.PutJson($"/api/clinical-history/patients/{patient.Id()}", record, HttpStatusCode.OK);

        return new Setup(admin, medico, patient.Id(), professional, treatment!, item!, appointment!);
    }

    private static Dictionary<string, object?> Body(Setup setup, Guid? id = null, string performedId = "plan-1", string? assignmentId = null, Guid? treatmentId = null) => new()
    {
        ["id"] = id ?? Guid.NewGuid(),
        ["date"] = TestData.TodayInClinic().Iso(),
        ["professionalId"] = setup.ProfessionalId,
        ["appointmentId"] = setup.Appointment.Id(),
        ["reason"] = "Dolor en molar",
        ["diagnoses"] = new[] { new { id = Guid.NewGuid().ToString(), description = "Pulpitis irreversible", tooth = "26", priority = "alta" } },
        ["requestedExams"] = new[] { new { id = "exam-1", kind = "radiografia_periapical", detail = "Control" } },
        ["performedTreatments"] = new[] { new { id = performedId, treatmentId = treatmentId ?? setup.Treatment.Id(), description = "", tooth = "26", cost = 100m, assignmentId } },
    };

    private Task<JsonNode?> RegisterAsync(Setup setup, object body, HttpStatusCode expected = HttpStatusCode.Created) =>
        setup.Medico.PostJson($"/api/clinical-history/patients/{setup.PatientId}/encounters/register", body, expected);

    private async Task<int> StockAsync(Setup setup) =>
        (await setup.Admin.GetJson($"/api/inventory/items/{setup.Item.Id()}"))!["stock"]!.GetValue<int>();

    [Fact]
    public async Task Registra_todo_en_una_transaccion()
    {
        var setup = await SetupAsync();
        var revisionBefore = (await setup.Medico.GetJson($"/api/clinical-history/patients/{setup.PatientId}"))!["record"]!["revision"]!.GetValue<int>();

        var result = await RegisterAsync(setup, Body(setup));

        // 1. Tratamiento realizado con el profesional, el costo cobrado y los insumos descontados.
        var performed = result!["encounter"]!["performedTreatments"]![0]!;
        var assignmentId = Guid.Parse(performed.Str("assignmentId"));
        var assignments = (await setup.Medico.GetJson($"/api/treatment-assignments?patientId={setup.PatientId}"))!.AsArray();
        var assignment = Assert.Single(assignments)!;
        Assert.Equal(assignmentId, assignment.Id());
        Assert.Equal(100m, assignment["price"]!.GetValue<decimal>());
        Assert.Equal($"{result["encounter"].Str("id")}:plan-1", assignment.Str("sourceKey"));
        Assert.Equal(6, await StockAsync(setup));
        await using (var scope = api.Db())
        {
            var row = await scope.Context.TreatmentAssignments.AsNoTracking().SingleAsync(entry => entry.Id == assignmentId);
            Assert.Equal(setup.ProfessionalId, row.ProfessionalId);
        }

        // 2-3. Atención creada; la historia sin el propuesto usado y con el examen pendiente.
        var record = result["record"]!;
        Assert.Equal(revisionBefore + 1, record["revision"]!.GetValue<int>());
        Assert.Equal(["plan-2"], record["plan"]!.AsArray().Select(item => item.Str("id")));
        var exam = Assert.Single(record["examRequests"]!.AsArray())!;
        Assert.Equal("pendiente", exam.Str("status"));
        Assert.Equal(result["encounter"].Str("id"), exam.Str("encounterId"));

        // 4. La cita quedó completada.
        Assert.True(result["appointmentCompleted"]!.GetValue<bool>());
        Assert.Empty(result["warnings"]!.AsArray());
        Assert.Equal("completada", (await setup.Admin.GetJson($"/api/appointments/{setup.Appointment.Id()}")).Str("status"));
    }

    [Fact]
    public async Task Reintentar_con_el_mismo_id_no_duplica_ni_descuenta_otra_vez()
    {
        var setup = await SetupAsync();
        var body = Body(setup);

        var first = await RegisterAsync(setup, body);
        var again = await RegisterAsync(setup, body, HttpStatusCode.OK);

        Assert.Equal(first!["encounter"].Str("id"), again!["encounter"].Str("id"));
        Assert.Single((await setup.Medico.GetJson($"/api/treatment-assignments?patientId={setup.PatientId}"))!.AsArray());
        Assert.Equal(6, await StockAsync(setup));
    }

    [Fact]
    public async Task Un_registro_previo_por_pasos_se_reutiliza()
    {
        var setup = await SetupAsync();
        var id = Guid.NewGuid();
        // El flujo anterior registró el tratamiento y luego se cortó antes de crear la atención.
        await setup.Medico.PostJson("/api/treatment-assignments", new
        {
            treatmentId = setup.Treatment.Id(), patientId = setup.PatientId, date = TestData.TodayInClinic().Iso(), tooth = "26",
            sourceEncounterId = id.ToString(), sourceKey = $"{id}:plan-1", price = 100,
        }, HttpStatusCode.Created);
        Assert.Equal(6, await StockAsync(setup));

        await RegisterAsync(setup, Body(setup, id));

        Assert.Single((await setup.Medico.GetJson($"/api/treatment-assignments?patientId={setup.PatientId}"))!.AsArray());
        Assert.Equal(6, await StockAsync(setup));
    }

    [Fact]
    public async Task Si_falla_no_queda_nada_a_medias()
    {
        var setup = await SetupAsync();
        await setup.Admin.PutJson($"/api/treatments/{setup.Treatment.Id()}", new
        {
            name = setup.Treatment.Str("name"), category = "Endodoncia", durationMinutes = 60, price = 120, active = false,
            consumption = new[] { new { itemId = setup.Item.Id(), quantity = 4 } },
        }, HttpStatusCode.OK);

        var error = await RegisterAsync(setup, Body(setup), HttpStatusCode.BadRequest);

        Assert.True(error.HasError("performedTreatments[0].treatmentId"), error!.ToJsonString());
        Assert.Empty((await setup.Medico.GetJson($"/api/treatment-assignments?patientId={setup.PatientId}"))!.AsArray());
        Assert.Equal(10, await StockAsync(setup));
        Assert.Equal("programada", (await setup.Admin.GetJson($"/api/appointments/{setup.Appointment.Id()}")).Str("status"));
        var history = await setup.Medico.GetJson($"/api/clinical-history/patients/{setup.PatientId}");
        Assert.Empty(history!["encounters"]!.AsArray());
        Assert.Equal(2, history["record"]!["plan"]!.AsArray().Count);
    }

    [Fact]
    public async Task Dos_registros_simultaneos_de_la_misma_cita_solo_uno_pasa_y_el_otro_no_deja_rastro()
    {
        var setup = await SetupAsync();

        var responses = await Task.WhenAll(Enumerable.Range(0, 2).Select(_ =>
            setup.Medico.PostAsJsonAsync($"/api/clinical-history/patients/{setup.PatientId}/encounters/register", Body(setup), HttpHelpers.Json)));

        Assert.Equal([HttpStatusCode.Created, HttpStatusCode.Conflict], responses.Select(response => response.StatusCode).Order());
        Assert.Single((await setup.Medico.GetJson($"/api/treatment-assignments?patientId={setup.PatientId}"))!.AsArray());
        Assert.Equal(6, await StockAsync(setup));
    }

    [Fact]
    public async Task Cita_cancelada_se_avisa_y_no_cambia()
    {
        var setup = await SetupAsync(appointmentStatus: "cancelada");

        var result = await RegisterAsync(setup, Body(setup));

        Assert.False(result!["appointmentCompleted"]!.GetValue<bool>());
        Assert.Single(result["warnings"]!.AsArray());
        Assert.Equal("cancelada", (await setup.Admin.GetJson($"/api/appointments/{setup.Appointment.Id()}")).Str("status"));
    }

    [Fact]
    public async Task Tratamiento_realizado_ajeno_y_roles()
    {
        var setup = await SetupAsync();
        var other = await SetupAsync();
        var foreign = await other.Medico.PostJson("/api/treatment-assignments", new
        {
            treatmentId = other.Treatment.Id(), patientId = other.PatientId, date = TestData.TodayInClinic().Iso(), tooth = "",
            sourceEncounterId = "", sourceKey = $"{Guid.NewGuid()}:x", price = 10,
        }, HttpStatusCode.Created);

        var error = await RegisterAsync(setup, Body(setup, assignmentId: foreign.Str("id")), HttpStatusCode.BadRequest);
        Assert.True(error.HasError("performedTreatments[0].assignmentId"));

        await (await api.As("recepcion")).PostJson($"/api/clinical-history/patients/{setup.PatientId}/encounters/register", Body(setup), HttpStatusCode.Forbidden);
    }
}
