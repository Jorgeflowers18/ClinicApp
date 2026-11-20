using System.Net;
using System.Text.Json.Nodes;
using ClinicApp.Api.Modules.Appointments;
using ClinicApp.Api.Modules.Treatments;
using ClinicApp.Api.Tests.Infrastructure;

namespace ClinicApp.Api.Tests.Integration;

/// <summary>
/// Los reportes se prueban con datos conocidos en un periodo propio (marzo de 2031), donde ninguna otra prueba
/// agenda citas, y se compara cada número con el esperado.
/// </summary>
[Collection(ApiCollection.Name)]
public class ReportsTests(ApiFactory api)
{
    private const string Period = "from=2031-03-09&to=2031-03-15";

    private sealed record Scenario(HttpClient Admin, Guid ProfessionalId, Guid RoomId, Guid TreatmentId);

    /// <summary>
    /// Semana del 9 al 15 de marzo de 2031 (lunes a domingo):
    /// lun 10: completada 30 min (consultorio), no asistió 60 min (consultorio), cancelada 30 min (consultorio);
    /// dom 15: programada a las 23:30 hora de Ecuador (ya es 16 en UTC) sin consultorio.
    /// Bloqueo del consultorio del domingo 8 a las 22:00 al lunes 9 a las 02:00 (solo cuentan 120 min).
    /// </summary>
    private async Task<Scenario> ScenarioAsync()
    {
        var admin = await api.As("admin");
        var patient = await admin.CreatePatientAsync();
        var professional = await admin.ProfessionalIdAsync();
        var room = await admin.RoomIdAsync();
        var treatment = await admin.PostJson("/api/treatments", new
        {
            name = $"Profilaxis {TestData.Next()}", category = "Preventivo", durationMinutes = 30, price = 40, active = true, consumption = Array.Empty<object>(),
        }, HttpStatusCode.Created);

        async Task<JsonNode> Appointment(string date, string start, string end, Guid? roomId, string? status)
        {
            var created = await admin.PostJson("/api/appointments", new
            {
                patientId = patient.Str("id"), professionalId = professional.ToString(), treatmentId = treatment.Str("id"),
                roomId = roomId?.ToString() ?? "", date, startTime = start, endTime = end, notes = "",
            }, HttpStatusCode.Created);
            if (status is not null)
                await admin.PatchJson($"/api/appointments/{created.Id()}/status", new { status }, HttpStatusCode.OK);
            return created!;
        }

        await Appointment("2031-03-10", "09:00", "09:30", room, "completada");
        await Appointment("2031-03-10", "10:00", "11:00", room, "no_asistio");
        await Appointment("2031-03-10", "12:00", "12:30", room, "cancelada");
        await Appointment("2031-03-15", "23:30", "23:50", null, null);

        await using var scope = api.Db();
        scope.Context.ScheduleBlocks.Add(new ScheduleBlock
        {
            Id = Guid.CreateVersion7(), RoomId = room,
            Start = new DateTime(2031, 3, 9, 3, 0, 0, DateTimeKind.Utc),  // dom 8, 22:00 en Ecuador
            End = new DateTime(2031, 3, 9, 7, 0, 0, DateTimeKind.Utc),    // lun 9, 02:00 en Ecuador
            Reason = "Mantenimiento", CreatedAt = DateTime.UtcNow,
        });
        // Tratamientos realizados con fecha en el periodo (la API no acepta fechas futuras: se insertan directo).
        scope.Context.TreatmentAssignments.AddRange(
            new TreatmentAssignment { Id = Guid.CreateVersion7(), TreatmentId = treatment.Id(), PatientId = patient.Id(), StartDate = new DateOnly(2031, 3, 10), Price = 35, CreatedAt = DateTime.UtcNow },
            new TreatmentAssignment { Id = Guid.CreateVersion7(), TreatmentId = treatment.Id(), PatientId = patient.Id(), StartDate = new DateOnly(2031, 3, 11), Price = null, CreatedAt = DateTime.UtcNow },
            new TreatmentAssignment
            {
                Id = Guid.CreateVersion7(), TreatmentId = treatment.Id(), PatientId = patient.Id(), StartDate = new DateOnly(2031, 3, 12),
                Status = AssignmentStatuses.EnProgreso, TotalSessions = 3, CompletedSessions = 1, Price = 100, CreatedAt = DateTime.UtcNow,
            });
        await scope.Context.SaveChangesAsync();

        return new Scenario(admin, professional, room, treatment.Id());
    }

    [Fact]
    public async Task Resumen_agenda_productividad_y_tratamientos_con_datos_conocidos()
    {
        var scenario = await ScenarioAsync();
        var admin = scenario.Admin;

        // Resumen: las 4 citas del periodo (incluida la del domingo a las 23:30 hora de la clínica).
        var summary = await admin.GetJson($"/api/reports/summary?{Period}");
        Assert.Equal(4, summary!["appointmentsInPeriod"]!.GetValue<int>());
        Assert.Equal(1, summary["appointmentsCompleted"]!.GetValue<int>());
        Assert.Equal(1, summary["appointmentsNoShow"]!.GetValue<int>());
        Assert.Equal(0.5, summary["noShowRate"]!.GetValue<double>());

        // Agenda por día: los 7 días, con ceros donde no hay citas.
        var agenda = await admin.GetJson($"/api/reports/agenda?{Period}");
        var days = agenda!["byDay"]!.AsArray();
        Assert.Equal(7, days.Count);
        Assert.Equal("lun 10", days[1].Str("label"));
        Assert.Equal(3, days[1]!["total"]!.GetValue<int>());
        Assert.Equal(1, days[1]!["canceladas"]!.GetValue<int>());
        Assert.Equal(0, days[0]!["total"]!.GetValue<int>());
        Assert.Equal(1, days[6]!["total"]!.GetValue<int>()); // domingo 15, aunque en UTC ya era lunes 16

        var byStatus = agenda["byStatus"]!.AsArray();
        Assert.Equal(5, byStatus.Count);
        Assert.Equal("No asistió", byStatus.Single(row => row.Str("status") == "no_asistio").Str("label"));

        var room = agenda["occupancyByRoom"]!.AsArray().Single(row => row.Str("roomId") == scenario.RoomId.ToString())!;
        Assert.Equal(2, room["appointments"]!.GetValue<int>());      // sin la cancelada
        Assert.Equal(90, room["bookedMinutes"]!.GetValue<int>());    // 30 + 60
        Assert.Equal(120, room["blockedMinutes"]!.GetValue<int>());  // recortado al inicio del periodo
        var withoutRoom = agenda["occupancyByRoom"]!.AsArray().Single(row => row.Str("roomId") == "")!;
        Assert.Equal("Sin consultorio", withoutRoom.Str("roomName"));
        Assert.Equal(20, withoutRoom["bookedMinutes"]!.GetValue<int>());

        // Productividad: 4 agendadas, 1 completada, 1 no asistió, 1 cancelada → 1 / (4 − 1).
        var productivity = await admin.GetJson($"/api/reports/productivity?{Period}");
        var mine = productivity!["byProfessional"]!.AsArray().Single(row => row.Str("professionalId") == scenario.ProfessionalId.ToString())!;
        Assert.Equal(4, mine["scheduled"]!.GetValue<int>());
        Assert.Equal(1, mine["completed"]!.GetValue<int>());
        Assert.Equal(1, mine["cancelled"]!.GetValue<int>());
        Assert.Equal(1.0 / 3, mine["completionRate"]!.GetValue<double>(), 6);

        // Tratamientos: 4 citas con el tratamiento; 2 completados (35 + 40 del catálogo) y 1 en progreso.
        var treatments = await admin.GetJson($"/api/reports/treatments?{Period}");
        var row = treatments!["byTreatment"]!.AsArray().Single(item => item.Str("treatmentId") == scenario.TreatmentId.ToString())!;
        Assert.Equal(4, row["appointmentsInPeriod"]!.GetValue<int>());
        Assert.Equal(2, row["completedAssignments"]!.GetValue<int>());
        Assert.Equal(1, row["activeAssignments"]!.GetValue<int>());
        Assert.Equal(3, row["sessionsDone"]!.GetValue<int>());
        Assert.Equal(5, row["sessionsPlanned"]!.GetValue<int>());
        Assert.Equal(75m, row["estimatedRevenue"]!.GetValue<decimal>());
    }

    [Fact]
    public async Task Inventario_criticos_compras_y_consumo_del_periodo()
    {
        var admin = await api.As("admin");
        var today = TestData.TodayInClinic().Iso();
        var item = await admin.PostJson("/api/inventory/items", new
        {
            name = $"Guantes {TestData.Next()}", category = "Consumibles", unit = "caja", kind = "consumible", minStock = 5, unitCost = 3,
        }, HttpStatusCode.Created);
        var supplier = await admin.PostJson("/api/inventory/suppliers", new { name = $"Dental Sur {TestData.Next()}" }, HttpStatusCode.Created);
        var order = await admin.PostJson("/api/inventory/purchase-orders", new
        {
            supplierId = supplier.Id(), notes = "", lines = new[] { new { itemId = item.Id(), quantity = 4, unitCost = 2.5, expirationDate = "" } },
        }, HttpStatusCode.Created);
        await admin.PostJson($"/api/inventory/purchase-orders/{order.Id()}/receive", null, HttpStatusCode.OK);
        await admin.PostJson($"/api/inventory/items/{item.Id()}/movements", new { type = "salida", quantity = 3, reason = "Uso" }, HttpStatusCode.Created);

        var report = await admin.GetJson($"/api/reports/inventory?from={today}&to={today}");

        Assert.Contains(report!["criticalItems"]!.AsArray(), row => row.Str("itemId") == item.Str("id")); // stock 1 ≤ mínimo 5
        var purchase = report["purchasesInPeriod"]!.AsArray().Single(row => row.Str("orderId") == order.Str("id"))!;
        Assert.Equal(10m, purchase["total"]!.GetValue<decimal>());
        Assert.Equal("Recibida", purchase.Str("statusLabel"));
        Assert.Equal(supplier.Str("name"), purchase.Str("supplierName"));
        var consumed = report["consumptionInPeriod"]!.AsArray().Single(row => row.Str("itemId") == item.Str("id"))!;
        Assert.Equal(3, consumed["quantity"]!.GetValue<int>());
    }

    [Fact]
    public async Task Roles_el_inicio_lo_ven_todos_y_el_resto_solo_admin()
    {
        var medico = await api.As("medico");

        await medico.GetJson($"/api/reports/summary?{Period}");
        await medico.GetJson($"/api/reports/agenda?{Period}");
        await medico.GetJson($"/api/reports/productivity?{Period}", HttpStatusCode.Forbidden);
        await medico.GetJson($"/api/reports/treatments?{Period}", HttpStatusCode.Forbidden);
        await (await api.As("recepcion")).GetJson($"/api/reports/inventory?{Period}", HttpStatusCode.Forbidden);
    }

    [Theory]
    [InlineData("")]
    [InlineData("from=2031-03-15&to=2031-03-09")]
    [InlineData("from=2030-01-01&to=2031-03-09")]
    public async Task Periodo_invalido_da_400(string query)
    {
        var admin = await api.As("admin");

        await admin.GetJson($"/api/reports/summary?{query}", HttpStatusCode.BadRequest);
    }
}
