using ClinicApp.Api.Common;
using ClinicApp.Api.Data;
using ClinicApp.Api.Modules.Appointments;
using ClinicApp.Api.Modules.Institution;
using Microsoft.EntityFrameworkCore;

namespace ClinicApp.Api.Modules.Notifications;

/// <summary>
/// Prepara una notificación de una cita: arma el mensaje con la plantilla y la deja <c>pendiente</c> en el
/// DbContext (la guarda quien llama, junto con la cita). La envía después <see cref="NotificationDispatcher"/>.
/// </summary>
public class NotificationComposer(AppDbContext db, ClinicClock clock, NotificationSettings settings, ILogger<NotificationComposer> logger)
{
    /// <summary>
    /// Agrega la notificación pendiente, o no hace nada si no hay proveedor configurado, si el paciente
    /// tiene las notificaciones desactivadas o no tiene teléfono ni correo.
    /// </summary>
    public async Task<NotificationLog?> AddAsync(Appointment appointment, string type, CancellationToken cancellationToken)
    {
        if (!settings.Enabled)
        {
            logger.LogInformation("No se registró la notificación {Type} de la cita {AppointmentId}: no hay proveedor configurado (Notifications:Provider).",
                type, appointment.Id);
            return null;
        }

        var patient = await db.Patients.AsNoTracking()
            .Where(entry => entry.Id == appointment.PatientId)
            .Select(entry => new { entry.FirstName, entry.LastName, entry.Phone, entry.Email, entry.NotificationsEnabled, entry.DeletedAt })
            .FirstOrDefaultAsync(cancellationToken);
        if (patient is null || !patient.NotificationsEnabled || patient.DeletedAt is not null) return null;

        // Canal: el celular si lo tiene (el 92 % lo tiene); si no, el correo; si no hay ninguno, no se notifica.
        var (channel, recipient) = !string.IsNullOrWhiteSpace(patient.Phone)
            ? (NotificationChannels.Sms, patient.Phone)
            : !string.IsNullOrWhiteSpace(patient.Email) ? (NotificationChannels.Email, patient.Email) : ("", "");
        if (channel.Length == 0) return null;

        var professional = await db.Professionals.AsNoTracking()
            .Where(entry => entry.Id == appointment.ProfessionalId).Select(entry => entry.Name).FirstOrDefaultAsync(cancellationToken) ?? "";
        var clinic = await db.Institutions.AsNoTracking().Select(entry => entry.Name).FirstOrDefaultAsync(cancellationToken) ?? "la clínica";
        var template = await db.NotificationTemplates.AsNoTracking().Select(entry => entry.Message).FirstOrDefaultAsync(cancellationToken)
            ?? NotificationTemplate.DefaultMessage;

        var message = TemplateRenderer.Render(template, TemplateRenderer.ValuesFor(
            $"{patient.FirstName} {patient.LastName}".Trim(), clinic, appointment.Start, professional, clock));

        var log = new NotificationLog
        {
            Id = Guid.CreateVersion7(),
            PatientId = appointment.PatientId,
            AppointmentId = appointment.Id,
            Type = type,
            Channel = channel,
            Status = NotificationStatuses.Pendiente,
            Recipient = recipient.Trim(),
            Message = message.Length <= 1200 ? message : message[..1200],
            CreatedAt = clock.UtcNow,
        };
        db.NotificationLogs.Add(log);
        return log;
    }
}

/// <summary>
/// Implementa los eventos de la agenda: al crear una cita, confirmación; al cancelarla, cancelación
/// (y se descarta la confirmación si todavía no salió). Se ejecuta dentro de la transacción de la cita:
/// la notificación pendiente se guarda junto con ella y la cita nunca espera al proveedor.
/// </summary>
public class AppointmentNotifications(AppDbContext db, NotificationComposer composer) : IAppointmentEvents
{
    public async Task AppointmentCreatedAsync(Appointment appointment, CancellationToken cancellationToken) =>
        await composer.AddAsync(appointment, NotificationTypes.Confirmacion, cancellationToken);

    public async Task AppointmentCancelledAsync(Appointment appointment, CancellationToken cancellationToken)
    {
        var pendingConfirmations = await db.NotificationLogs
            .Where(log => log.AppointmentId == appointment.Id && log.Status == NotificationStatuses.Pendiente
                && (log.Type == NotificationTypes.Confirmacion || log.Type == NotificationTypes.Recordatorio))
            .ToListAsync(cancellationToken);
        db.NotificationLogs.RemoveRange(pendingConfirmations);

        await composer.AddAsync(appointment, NotificationTypes.Cancelacion, cancellationToken);
    }
}
