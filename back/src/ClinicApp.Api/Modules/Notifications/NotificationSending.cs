using System.Globalization;
using ClinicApp.Api.Common;

namespace ClinicApp.Api.Modules.Notifications;

/// <summary>Un mensaje listo para enviar.</summary>
public record OutgoingNotification(Guid LogId, string Channel, string Recipient, string Message);

/// <summary>
/// Proveedor que entrega los mensajes (SMS, WhatsApp o correo). Si falla, lanza una excepción y el mensaje
/// se reintenta. El proveedor real está por elegir con la clínica; para conectarlo basta con una clase nueva
/// que implemente esta interfaz y registrarla en Program.cs según <c>Notifications:Provider</c>.
/// </summary>
public interface INotificationSender
{
    Task SendAsync(OutgoingNotification notification, CancellationToken cancellationToken);
}

/// <summary>Desarrollo y pruebas: escribe el mensaje en el log en lugar de enviarlo.</summary>
public sealed class LogNotificationSender(ILogger<LogNotificationSender> logger) : INotificationSender
{
    public Task SendAsync(OutgoingNotification notification, CancellationToken cancellationToken)
    {
        logger.LogInformation("[Notificación simulada] {Channel} a {Recipient}: {Message}", notification.Channel, notification.Recipient, notification.Message);
        return Task.CompletedTask;
    }
}

/// <summary>
/// Configuración: <c>Notifications:Provider</c> (<c>log</c> en desarrollo; vacío en producción hasta elegir
/// proveedor). Sin proveedor <b>no se registra ninguna notificación</b>, para no mostrar "cliente notificado"
/// cuando nadie le envió nada.
/// </summary>
public sealed class NotificationSettings(IConfiguration configuration)
{
    public string Provider { get; } = configuration["Notifications:Provider"]?.Trim().ToLowerInvariant() ?? "";

    public bool Enabled => Provider.Length > 0;

    public int ReminderHoursBefore { get; } = configuration.GetValue<int?>("Notifications:ReminderHoursBefore") ?? 24;

    public int DispatchIntervalSeconds { get; } = Math.Max(1, configuration.GetValue<int?>("Notifications:DispatchIntervalSeconds") ?? 10);

    public const int MaxAttempts = 3;
}

/// <summary>
/// Arma el mensaje reemplazando las variables de la plantilla (las mismas de notification.types.ts).
/// Fecha y hora en la zona horaria de la clínica: "12 de septiembre" y "10:00 am".
/// </summary>
public static class TemplateRenderer
{
    private static readonly CultureInfo Spanish = CultureInfo.GetCultureInfo("es-EC");

    public sealed record Values(string PatientName, string ClinicName, DateTime StartLocal, string ProfessionalName);

    public static string Render(string template, Values values) => template
        .Replace("[nombre del cliente]", values.PatientName)
        .Replace("[nombre de la clínica]", values.ClinicName)
        .Replace("[fecha de la cita]", FormatDate(values.StartLocal))
        .Replace("[hora de la cita]", FormatTime(values.StartLocal))
        .Replace("[profesional]", values.ProfessionalName);

    /// <summary>"12 de septiembre".</summary>
    public static string FormatDate(DateTime local) => $"{local.Day} de {Spanish.DateTimeFormat.GetMonthName(local.Month)}";

    /// <summary>"10:00 am" / "3:30 pm".</summary>
    public static string FormatTime(DateTime local)
    {
        var hour = local.Hour % 12 == 0 ? 12 : local.Hour % 12;
        return $"{hour}:{local.Minute:D2} {(local.Hour < 12 ? "am" : "pm")}";
    }

    public static Values ValuesFor(string patientName, string clinicName, DateTime startUtc, string professionalName, ClinicClock clock) =>
        new(patientName, clinicName, clock.ToLocal(startUtc), professionalName);
}
