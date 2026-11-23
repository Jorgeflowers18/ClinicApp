using System.Net;
using System.Net.Http.Json;
using System.Text.Json.Nodes;
using ClinicApp.Api.Tests.Infrastructure;

namespace ClinicApp.Api.Tests.Integration;

[Collection(ApiCollection.Name)]
public class TreatmentAssignmentsTests(ApiFactory api)
{
    private sealed record Setup(HttpClient Admin, JsonNode Patient, JsonNode Treatment, JsonNode Item);

    /// <summary>
    /// Un insumo con dos lotes (vence pronto: 3, vence después: 10) y un tratamiento que consume 4.
    /// </summary>
    private async Task<Setup> SetupAsync(int consumes = 4, decimal price = 40)
    {
        var admin = await api.As("admin");
        var patient = await admin.CreatePatientAsync();
        var item = await admin.PostJson("/api/inventory/items", new
        {
            name = $"Anestesia {TestData.Next()}", category = "Consumibles", unit = "cartucho", kind = "consumible", minStock = 1, unitCost = 2,
        }, HttpStatusCode.Created);
        await admin.PostJson($"/api/inventory/items/{item.Id()}/movements",
            new { type = "entrada", quantity = 10, reason = "Compra", expirationDate = "2028-01-01" }, HttpStatusCode.Created);
        await admin.PostJson($"/api/inventory/items/{item.Id()}/movements",
            new { type = "entrada", quantity = 3, reason = "Compra", expirationDate = "2027-01-01" }, HttpStatusCode.Created);

        var treatment = await admin.PostJson("/api/treatments", new
        {
            name = $"Endodoncia {TestData.Next()}", category = "Endodoncia", durationMinutes = 60, price, active = true,
            consumption = new[] { new { itemId = item.Id(), quantity = consumes } },
        }, HttpStatusCode.Created);

        return new Setup(admin, patient, treatment!, item!);
    }

    private static object Body(Setup setup, string? sourceKey = null, decimal? price = 35, Guid? patientId = null, string? date = null) => new
    {
        treatmentId = setup.Treatment.Id(),
        patientId = patientId ?? setup.Patient.Id(),
        date = date ?? TestData.TodayInClinic().Iso(),
        tooth = "26",
        sourceEncounterId = Guid.NewGuid().ToString(),
        sourceKey = sourceKey ?? $"{Guid.NewGuid()}:{Guid.NewGuid()}",
        price,
    };

    [Fact]
    public async Task Registrar_crea_un_completado_y_descuenta_insumos_por_FEFO()
    {
        var setup = await SetupAsync();

        var created = await setup.Admin.PostJson("/api/treatment-assignments", Body(setup), HttpStatusCode.Created);

        Assert.Equal("completado", created.Str("status"));
        Assert.Equal(1, created!["completedSessions"]!.GetValue<int>());
        Assert.Equal(35m, created["price"]!.GetValue<decimal>());
        Assert.Equal("26", created.Str("tooth"));

        var item = await setup.Admin.GetJson($"/api/inventory/items/{setup.Item.Id()}");
        Assert.Equal(9, item!["stock"]!.GetValue<int>()); // 13 − 4

        // FEFO: primero el lote que vence antes (3) y luego 1 del otro.
        var lots = (await setup.Admin.GetJson($"/api/inventory/items/{setup.Item.Id()}/lots"))!.AsArray();
        Assert.Equal(0, lots[0]!["quantity"]!.GetValue<int>());
        Assert.Equal(9, lots[1]!["quantity"]!.GetValue<int>());

        var movements = (await setup.Admin.GetJson($"/api/inventory/items/{setup.Item.Id()}/movements"))!.AsArray();
        var exits = movements.Where(movement => movement.Str("type") == "salida").ToList();
        Assert.Equal(2, exits.Count);
        Assert.All(exits, movement =>
        {
            Assert.Equal(created.Str("id"), movement.Str("treatmentAssignmentId"));
            Assert.Equal(setup.Patient.Str("id"), movement.Str("patientId"));
            Assert.StartsWith("Tratamiento realizado:", movement.Str("reason"));
        });
    }

    [Fact]
    public async Task El_mismo_sourceKey_devuelve_el_existente_sin_descontar_de_nuevo()
    {
        var setup = await SetupAsync();
        var key = $"{Guid.NewGuid()}:{Guid.NewGuid()}";

        var first = await setup.Admin.PostJson("/api/treatment-assignments", Body(setup, key), HttpStatusCode.Created);
        var again = await setup.Admin.PostJson("/api/treatment-assignments", Body(setup, key), HttpStatusCode.OK);

        Assert.Equal(first.Str("id"), again.Str("id"));
        Assert.Equal(9, (await setup.Admin.GetJson($"/api/inventory/items/{setup.Item.Id()}"))!["stock"]!.GetValue<int>());
    }

    [Fact]
    public async Task Diez_reintentos_simultaneos_registran_y_descuentan_una_sola_vez()
    {
        var setup = await SetupAsync(consumes: 1);
        var body = Body(setup, $"{Guid.NewGuid()}:{Guid.NewGuid()}");

        var responses = await Task.WhenAll(Enumerable.Range(0, 10).Select(_ =>
            setup.Admin.PostAsync("/api/treatment-assignments", JsonContent.Create(body))));

        Assert.Equal(1, responses.Count(response => response.StatusCode == HttpStatusCode.Created));
        Assert.Equal(9, responses.Count(response => response.StatusCode == HttpStatusCode.OK));
        Assert.Equal(12, (await setup.Admin.GetJson($"/api/inventory/items/{setup.Item.Id()}"))!["stock"]!.GetValue<int>());
    }

    [Fact]
    public async Task El_mismo_sourceKey_con_otro_paciente_responde_409()
    {
        var setup = await SetupAsync();
        var other = await setup.Admin.CreatePatientAsync();
        var key = $"{Guid.NewGuid()}:{Guid.NewGuid()}";
        await setup.Admin.PostJson("/api/treatment-assignments", Body(setup, key), HttpStatusCode.Created);

        await setup.Admin.PostJson("/api/treatment-assignments", Body(setup, key, patientId: other.Id()), HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task Sin_stock_se_registra_igual_y_el_stock_queda_en_cero()
    {
        var setup = await SetupAsync(consumes: 20);

        await setup.Admin.PostJson("/api/treatment-assignments", Body(setup), HttpStatusCode.Created);

        Assert.Equal(0, (await setup.Admin.GetJson($"/api/inventory/items/{setup.Item.Id()}"))!["stock"]!.GetValue<int>());
    }

    [Fact]
    public async Task Sin_precio_usa_el_del_catalogo()
    {
        var setup = await SetupAsync(price: 55);

        var created = await setup.Admin.PostJson("/api/treatment-assignments", Body(setup, price: null), HttpStatusCode.Created);

        Assert.Equal(55m, created!["price"]!.GetValue<decimal>());
    }

    [Fact]
    public async Task Validaciones()
    {
        var setup = await SetupAsync();

        var future = await setup.Admin.PostJson("/api/treatment-assignments", Body(setup, date: TestData.TodayInClinic().AddDays(1).Iso()), HttpStatusCode.BadRequest);
        Assert.True(future.HasError("date"));

        var negative = await setup.Admin.PostJson("/api/treatment-assignments", Body(setup, price: -1), HttpStatusCode.BadRequest);
        Assert.True(negative.HasError("price"));

        await setup.Admin.Delete($"/api/patients/{setup.Patient.Id()}", HttpStatusCode.NoContent);
        var deleted = await setup.Admin.PostJson("/api/treatment-assignments", Body(setup), HttpStatusCode.BadRequest);
        Assert.True(deleted.HasError("patientId"));

        var missing = new { treatmentId = Guid.NewGuid(), patientId = setup.Patient.Id(), date = TestData.TodayInClinic().Iso() };
        await setup.Admin.PostJson("/api/treatment-assignments", missing, HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Un_tratamiento_inactivo_da_400()
    {
        var setup = await SetupAsync();
        await setup.Admin.PutJson($"/api/treatments/{setup.Treatment.Id()}", new
        {
            name = setup.Treatment.Str("name"), category = "Endodoncia", durationMinutes = 60, price = 40, active = false, consumption = Array.Empty<object>(),
        }, HttpStatusCode.OK);

        var error = await setup.Admin.PostJson("/api/treatment-assignments", Body(setup), HttpStatusCode.BadRequest);

        Assert.True(error.HasError("treatmentId"));
    }

    [Fact]
    public async Task Recepcion_lee_pero_no_registra_y_el_medico_si()
    {
        var setup = await SetupAsync();
        var reception = await api.As("recepcion");
        var medico = await api.As("medico");

        await reception.PostJson("/api/treatment-assignments", Body(setup), HttpStatusCode.Forbidden);
        await medico.PostJson("/api/treatment-assignments", Body(setup), HttpStatusCode.Created);
        await reception.GetJson($"/api/treatment-assignments?patientId={setup.Patient.Id()}");
    }

    [Fact]
    public async Task Listas_por_paciente_y_por_tratamiento_en_orden_descendente()
    {
        var setup = await SetupAsync(consumes: 1);
        var older = await setup.Admin.PostJson("/api/treatment-assignments", Body(setup, date: TestData.TodayInClinic().AddDays(-10).Iso()), HttpStatusCode.Created);
        var newer = await setup.Admin.PostJson("/api/treatment-assignments", Body(setup), HttpStatusCode.Created);

        var byPatient = (await setup.Admin.GetJson($"/api/treatment-assignments?patientId={setup.Patient.Id()}"))!.AsArray();
        Assert.Equal([newer.Id(), older.Id()], byPatient.Select(item => item.Id()));

        var byTreatment = (await setup.Admin.GetJson($"/api/treatments/{setup.Treatment.Id()}/assignments"))!.AsArray();
        Assert.Equal([newer.Id(), older.Id()], byTreatment.Select(item => item.Id()));

        // Nombres del paciente y del tratamiento en cada fila (y en la respuesta del registro).
        var patientName = $"{setup.Patient.Str("firstName")} {setup.Patient.Str("lastName")}";
        Assert.All(byPatient.Concat(byTreatment).Append(newer), item =>
        {
            Assert.Equal(patientName, item.Str("patientName"));
            Assert.Equal(setup.Treatment.Str("name"), item.Str("treatmentName"));
        });

        await setup.Admin.GetJson("/api/treatment-assignments", HttpStatusCode.BadRequest);
        await setup.Admin.GetJson($"/api/treatments/{Guid.NewGuid()}/assignments", HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Un_tratamiento_realizado_no_se_borra_del_catalogo()
    {
        var setup = await SetupAsync();
        await setup.Admin.PostJson("/api/treatment-assignments", Body(setup), HttpStatusCode.Created);

        await setup.Admin.Delete($"/api/treatments/{setup.Treatment.Id()}", HttpStatusCode.Conflict);
    }
}
