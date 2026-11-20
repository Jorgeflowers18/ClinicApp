namespace ClinicApp.Api.Common;

/// <summary>Envío de correos. Hoy solo la recuperación de contraseña lo usa.</summary>
public interface IEmailSender
{
    Task SendAsync(string to, string subject, string body, CancellationToken cancellationToken);
}

/// <summary>
/// Implementación provisional mientras no se elige un proveedor de correo (ver backlog § notifications).
/// En desarrollo escribe el correo completo en el log, para poder copiar el enlace.
/// En producción NO escribe el contenido (tiene el enlace de recuperación, que es un secreto): solo avisa
/// que el correo no se envió.
/// </summary>
public sealed class LogEmailSender(IHostEnvironment environment, ILogger<LogEmailSender> logger) : IEmailSender
{
    public Task SendAsync(string to, string subject, string body, CancellationToken cancellationToken)
    {
        if (environment.IsDevelopment())
        {
            logger.LogInformation("Correo (solo desarrollo, no se envía)\nPara: {To}\nAsunto: {Subject}\n{Body}", to, subject, body);
        }
        else
        {
            logger.LogWarning("No hay proveedor de correo configurado: no se envió el correo \"{Subject}\".", subject);
        }

        return Task.CompletedTask;
    }
}
