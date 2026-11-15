using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;

namespace ClinicApp.Api.Common;

/// <summary>
/// Límites de peticiones por IP para los endpoints que se pueden atacar por fuerza bruta
/// (inicio de sesión, recuperación de contraseña, solicitudes de acceso). Al superarlo: 429.
/// La IP real del cliente llega de nginx gracias a UseForwardedHeaders.
/// </summary>
public static class RateLimits
{
    public const string Auth = "auth";

    public static IServiceCollection AddClinicRateLimits(this IServiceCollection services) =>
        services.AddRateLimiter(options =>
        {
            options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

            // 20 intentos por minuto por IP y por endpoint. Es holgado porque todo el personal de la clínica
            // sale a internet con la misma IP pública. Por endpoint: equivocarse al iniciar sesión no bloquea
            // la recuperación de contraseña.
            options.AddPolicy(Auth, context => RateLimitPartition.GetFixedWindowLimiter(
                partitionKey: $"{context.Connection.RemoteIpAddress}|{context.Request.Path}",
                factory: _ => new FixedWindowRateLimiterOptions
                {
                    PermitLimit = 20,
                    Window = TimeSpan.FromMinutes(1),
                    QueueLimit = 0,
                }));

            // Avisa cuántos segundos esperar. El cuerpo ProblemDetails lo pone UseStatusCodePages.
            options.OnRejected = (context, _) =>
            {
                if (context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter))
                {
                    context.HttpContext.Response.Headers.RetryAfter = ((int)retryAfter.TotalSeconds).ToString();
                }
                return ValueTask.CompletedTask;
            };
        });
}
