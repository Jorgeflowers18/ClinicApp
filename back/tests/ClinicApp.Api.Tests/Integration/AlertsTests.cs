using System.Net;
using ClinicApp.Api.Modules.Notifications;
using ClinicApp.Api.Tests.Infrastructure;

namespace ClinicApp.Api.Tests.Integration;

/// <summary>GET /api/alerts: citas y cumpleaños de hoy para todos; stock crítico y envíos fallidos solo admin y recepción.</summary>
[Collection(ApiCollection.Name)]
public class AlertsTests(ApiFactory api)
{
    [Fact]
    public async Task Alertas_del_dia_segun_el_rol()
    {
        var admin = await api.As("admin");
        var today = TestData.TodayInClinic();

        // Cumpleañero de hoy (30 años) y una cita suya hoy, más una cancelada que no debe salir.
        var body = TestData.PatientBody(firstName: "Lucía", lastName: $"Alertas {TestData.Next()}");
        body["birthDate"] = (today.Month == 2 && today.Day == 29 ? today.AddDays(-1) : today).AddYears(-30).Iso();
        var patient = await admin.PostJson("/api/patients", body, HttpStatusCode.Created);
        var professional = await admin.ProfessionalIdAsync();
        object Appointment(string start, string end) => new
        {
            patientId = patient.Str("id"), professionalId = professional.ToString(), treatmentId = "", roomId = "",
            date = today.Iso(), startTime = start, endTime = end, notes = "",
        };
        var appointment = await admin.PostJson("/api/appointments", Appointment("00:05", "00:20"), HttpStatusCode.Created);
        var cancelled = await admin.PostJson("/api/appointments", Appointment("00:30", "00:45"), HttpStatusCode.Created);
        await admin.PatchJson($"/api/appointments/{cancelled.Id()}/status", new { status = "cancelada" }, HttpStatusCode.OK);

        // Insumo sin stock (0 ≤ mínimo 3) y un envío fallido de hoy.
        var item = await admin.PostJson("/api/inventory/items", new
        {
            name = $"Anestesia {TestData.Next()}", category = "Anestesia", unit = "cartucho", kind = "consumible", minStock = 3, unitCost = 1,
        }, HttpStatusCode.Created);
        var failedId = Guid.CreateVersion7();
        await using (var scope = api.Db())
        {
            scope.Context.NotificationLogs.Add(new NotificationLog
            {
                Id = failedId, PatientId = patient.Id(), AppointmentId = null, Type = NotificationTypes.Recordatorio,
                Channel = NotificationChannels.Sms, Status = NotificationStatuses.Fallida, Recipient = "0991234567", Message = "Hola",
                Attempts = 3, CreatedAt = DateTime.UtcNow, SentAt = DateTime.UtcNow,
            });
            await scope.Context.SaveChangesAsync();
        }

        var alerts = await admin.GetJson("/api/alerts");
        Assert.Equal(today.Iso(), alerts.Str("date"));
        var todays = alerts!["appointmentsToday"]!.AsArray();
        var row = Assert.Single(todays, entry => entry.Str("patientId") == patient.Str("id"));
        Assert.Equal(appointment.Str("id"), row.Str("id"));
        Assert.Equal($"Lucía {patient.Str("lastName")}", row.Str("patientName"));
        Assert.Contains(alerts["birthdaysToday"]!.AsArray(), entry => entry.Str("patientId") == patient.Str("id"));
        var critical = Assert.Single(alerts["criticalItems"]!.AsArray(), entry => entry.Str("itemId") == item.Str("id"));
        Assert.Equal(0, critical!["stock"]!.GetValue<int>());
        Assert.Contains(alerts["failedDeliveries"]!.AsArray(), entry => entry.Str("id") == failedId.ToString());

        // El médico ve citas y cumpleaños, pero no stock ni envíos.
        var forDoctor = await (await api.As("medico")).GetJson("/api/alerts");
        Assert.Contains(forDoctor!["appointmentsToday"]!.AsArray(), entry => entry.Str("id") == appointment.Str("id"));
        Assert.Empty(forDoctor["criticalItems"]!.AsArray());
        Assert.Empty(forDoctor["failedDeliveries"]!.AsArray());

        Assert.Equal(HttpStatusCode.Unauthorized, (await api.Anonymous().GetAsync("/api/alerts")).StatusCode);
    }

    [Fact]
    public async Task Dados_de_baja_no_cumplen_anios()
    {
        var admin = await api.As("admin");
        var today = TestData.TodayInClinic();
        var body = TestData.PatientBody(firstName: "Baja", lastName: $"Alertas {TestData.Next()}");
        body["birthDate"] = (today.Month == 2 && today.Day == 29 ? today.AddDays(-1) : today).AddYears(-40).Iso();
        var patient = await admin.PostJson("/api/patients", body, HttpStatusCode.Created);
        await admin.Delete($"/api/patients/{patient.Id()}", HttpStatusCode.NoContent);

        var alerts = await admin.GetJson("/api/alerts");

        Assert.DoesNotContain(alerts!["birthdaysToday"]!.AsArray(), entry => entry.Str("patientId") == patient.Str("id"));
    }
}
