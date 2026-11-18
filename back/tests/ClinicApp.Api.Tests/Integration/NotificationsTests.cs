using System.Net;
using System.Text.Json.Nodes;
using ClinicApp.Api.Common;
using ClinicApp.Api.Modules.Notifications;
using ClinicApp.Api.Tests.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;

namespace ClinicApp.Api.Tests.Integration;

[Collection(ApiCollection.Name)]
public class NotificationsTests(ApiFactory api)
{
    private sealed class FailingSender : INotificationSender
    {
        public Task SendAsync(OutgoingNotification notification, CancellationToken cancellationToken) =>
            throw new InvalidOperationException("Proveedor caído");
    }

    private NotificationDispatcher Dispatcher(INotificationSender? sender = null) => sender is null
        ? api.Services.GetRequiredService<NotificationDispatcher>()
        : new NotificationDispatcher(
            api.Services.GetRequiredService<IServiceScopeFactory>(), sender,
            api.Services.GetRequiredService<NotificationSettings>(), api.Services.GetRequiredService<ClinicClock>(),
            NullLogger<NotificationDispatcher>.Instance);

    /// <summary>Paciente nuevo (con celular) y una cita en <paramref name="daysAhead"/> días a las 09:00.</summary>
    private async Task<(HttpClient Admin, JsonNode Patient, JsonNode Appointment)> AppointmentAsync(
        bool notificationsEnabled = true, int daysAhead = 20, string start = "09:00", string end = "09:30", DateOnly? date = null)
    {
        var admin = await api.As("admin");
        var body = TestData.PatientBody(firstName: "Rosa", lastName: $"Mena {TestData.Next()}");
        body["notificationsEnabled"] = notificationsEnabled;
        var patient = await admin.PostJson("/api/patients", body, HttpStatusCode.Created);
        var professional = await admin.ProfessionalIdAsync();

        var appointment = await admin.PostJson("/api/appointments", new
        {
            patientId = patient.Str("id"), professionalId = professional.ToString(), treatmentId = "", roomId = "",
            date = (date ?? TestData.TodayInClinic().AddDays(daysAhead)).Iso(), startTime = start, endTime = end, notes = "",
        }, HttpStatusCode.Created);

        return (admin, patient!, appointment!);
    }

    private async Task<List<NotificationLog>> LogsAsync(Guid appointmentId)
    {
        await using var scope = api.Db();
        return await scope.Context.NotificationLogs.AsNoTracking().Where(log => log.AppointmentId == appointmentId).OrderBy(log => log.CreatedAt).ToListAsync();
    }

    [Fact]
    public async Task Crear_una_cita_deja_la_confirmacion_pendiente_y_luego_se_envia()
    {
        var (admin, patient, appointment) = await AppointmentAsync();

        var pending = Assert.Single(await LogsAsync(appointment.Id()));
        Assert.Equal(NotificationTypes.Confirmacion, pending.Type);
        Assert.Equal(NotificationStatuses.Pendiente, pending.Status);
        Assert.Equal("sms", pending.Channel);
        Assert.Contains(patient.Str("lastName"), pending.Message);
        Assert.Contains("09:00 am".TrimStart('0'), pending.Message);
        Assert.DoesNotContain("[", pending.Message);

        // Pendiente: todavía no aparece en la API.
        Assert.Empty((await admin.GetJson($"/api/notifications?appointmentId={appointment.Id()}"))!.AsArray());

        await Dispatcher().RunOnceAsync(CancellationToken.None);

        var listed = (await (await api.As("medico")).GetJson($"/api/notifications?appointmentId={appointment.Id()}"))!.AsArray();
        var sent = Assert.Single(listed);
        Assert.Equal("enviada", sent.Str("status"));
        Assert.Equal("confirmacion_cita", sent.Str("type"));
        Assert.NotNull(sent!["sentAt"]);
    }

    [Fact]
    public async Task Paciente_sin_notificaciones_no_recibe_nada()
    {
        var (_, _, appointment) = await AppointmentAsync(notificationsEnabled: false);

        Assert.Empty(await LogsAsync(appointment.Id()));
    }

    [Fact]
    public async Task Cancelar_descarta_la_confirmacion_pendiente_y_avisa_la_cancelacion()
    {
        var (admin, _, appointment) = await AppointmentAsync();

        await admin.PatchJson($"/api/appointments/{appointment.Id()}/status", new { status = "cancelada" }, HttpStatusCode.OK);

        var log = Assert.Single(await LogsAsync(appointment.Id()));
        Assert.Equal(NotificationTypes.Cancelacion, log.Type);
    }

    [Fact]
    public async Task Con_el_proveedor_caido_reintenta_tres_veces_y_queda_fallida()
    {
        var (_, _, appointment) = await AppointmentAsync();
        var failing = Dispatcher(new FailingSender());

        for (var attempt = 0; attempt < 3; attempt++) await failing.RunOnceAsync(CancellationToken.None);

        var log = Assert.Single(await LogsAsync(appointment.Id()));
        Assert.Equal(NotificationStatuses.Fallida, log.Status);
        Assert.Equal(3, log.Attempts);
        Assert.Equal("Proveedor caído", log.Error);
        Assert.NotNull(log.SentAt);
    }

    [Fact]
    public async Task Una_cita_en_menos_de_24_horas_recibe_un_solo_recordatorio()
    {
        var clock = api.Services.GetRequiredService<ClinicClock>();
        var startLocal = clock.LocalNow.AddHours(3);
        if (startLocal.Hour == 23) startLocal = startLocal.AddHours(-1);
        var (_, _, appointment) = await AppointmentAsync(
            date: DateOnly.FromDateTime(startLocal), start: $"{startLocal.Hour:D2}:00", end: $"{startLocal.Hour:D2}:30");

        await Dispatcher().RunOnceAsync(CancellationToken.None);
        await Dispatcher().RunOnceAsync(CancellationToken.None);

        var logs = await LogsAsync(appointment.Id());
        Assert.Single(logs, log => log.Type == NotificationTypes.Recordatorio);
        Assert.Single(logs, log => log.Type == NotificationTypes.Confirmacion);
    }

    [Fact]
    public async Task Sin_proveedor_no_se_registra_nada()
    {
        var (_, _, appointment) = await AppointmentAsync(notificationsEnabled: false);
        var disabled = new NotificationSettings(new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["Notifications:Provider"] = "" }).Build());

        await using var scope = api.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ClinicApp.Api.Data.AppDbContext>();
        var composer = new NotificationComposer(db, scope.ServiceProvider.GetRequiredService<ClinicClock>(), disabled, NullLogger<NotificationComposer>.Instance);
        var entity = await db.Appointments.SingleAsync(entry => entry.Id == appointment.Id());

        Assert.Null(await composer.AddAsync(entity, NotificationTypes.Confirmacion, CancellationToken.None));
        Assert.False(disabled.Enabled);
    }

    [Fact]
    public async Task Reporte_paginado_con_busqueda_y_rango_de_fechas_solo_admin_y_recepcion()
    {
        var (admin, patient, _) = await AppointmentAsync();
        await Dispatcher().RunOnceAsync(CancellationToken.None);
        var today = TestData.TodayInClinic().Iso();

        var byName = await admin.GetJson($"/api/notifications?search={Uri.EscapeDataString(patient.Str("lastName"))}&dateFrom={today}&dateTo={today}");
        Assert.Equal(1, byName!["totalItems"]!.GetValue<int>());

        var byDocument = await (await api.As("recepcion")).GetJson($"/api/notifications?search={patient.Str("documentId")}");
        Assert.Equal(1, byDocument!["totalItems"]!.GetValue<int>());

        var yesterday = TestData.TodayInClinic().AddDays(-1).Iso();
        var none = await admin.GetJson($"/api/notifications?search={patient.Str("documentId")}&dateFrom={yesterday}&dateTo={yesterday}");
        Assert.Equal(0, none!["totalItems"]!.GetValue<int>());

        await (await api.As("medico")).GetJson("/api/notifications", HttpStatusCode.Forbidden);
        await admin.GetJson("/api/notifications?dateFrom=17-11-2026", HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Plantilla_leer_guardar_y_validar()
    {
        var reception = await api.As("recepcion");

        var original = await reception.GetJson("/api/notifications/template");
        Assert.Contains("[nombre del cliente]", original.Str("message"));

        var saved = await reception.PutJson("/api/notifications/template", new { message = $"  {original.Str("message")}  " }, HttpStatusCode.OK);
        Assert.Equal(original.Str("message"), saved.Str("message"));

        var shortMessage = await reception.PutJson("/api/notifications/template", new { message = "Hola" }, HttpStatusCode.BadRequest);
        Assert.True(shortMessage.HasError("message"));

        await (await api.As("medico")).GetJson("/api/notifications/template", HttpStatusCode.Forbidden);
    }
}
