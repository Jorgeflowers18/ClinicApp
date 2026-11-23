using ClinicApp.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace ClinicApp.Api.Modules.Auth;

/// <summary>
/// Tokens de una cuenta que comparten el inicio de sesión (<see cref="AuthController"/>) y la gestión de
/// usuarios (<see cref="UsersController"/>): el enlace para elegir la contraseña y el cierre de sesiones.
/// </summary>
public static class AccountTokens
{
    /// <summary>
    /// Crea un enlace de un solo uso para elegir la contraseña. Los enlaces anteriores sin usar dejan de valer:
    /// solo vale el último. Guarda los cambios.
    /// </summary>
    public static async Task<PasswordLinkDto> CreatePasswordLinkAsync(
        this AppDbContext db, AuthOptions options, Guid userId, TimeSpan lifetime, CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;

        await db.PasswordResetTokens
            .Where(t => t.UserId == userId && t.UsedAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(t => t.UsedAt, now), cancellationToken);

        var rawToken = TokenService.NewOpaqueToken();
        var token = new PasswordResetToken
        {
            Id = Guid.CreateVersion7(),
            UserId = userId,
            TokenHash = TokenService.Hash(rawToken),
            CreatedAt = now,
            ExpiresAt = now.Add(lifetime),
        };
        db.PasswordResetTokens.Add(token);
        await db.SaveChangesAsync(cancellationToken);

        return new PasswordLinkDto($"{options.FrontendBaseUrl.TrimEnd('/')}/restablecer-contrasena?token={rawToken}", token.ExpiresAt);
    }

    /// <summary>
    /// Cierra todas las sesiones del usuario (revoca sus tokens de refresh). El access token que ya tenga
    /// sigue valiendo hasta que vence (15 minutos).
    /// </summary>
    public static Task RevokeAllSessionsAsync(this AppDbContext db, Guid userId, CancellationToken cancellationToken) =>
        db.RefreshTokens
            .Where(t => t.UserId == userId && t.RevokedAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(t => t.RevokedAt, DateTime.UtcNow), cancellationToken);
}
