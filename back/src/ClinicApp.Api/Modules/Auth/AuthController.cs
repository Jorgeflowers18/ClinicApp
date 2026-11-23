using ClinicApp.Api.Common;
using ClinicApp.Api.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

namespace ClinicApp.Api.Modules.Auth;

/// <summary>
/// Sesión del usuario. El access token (JWT, 15 min) viaja en el encabezado Authorization y el frontend
/// lo guarda solo en memoria. El token de refresh viaja en una cookie httpOnly (JavaScript no puede
/// leerla) y sirve para obtener un access token nuevo al recargar la página o cuando vence.
/// </summary>
[ApiController]
[Route("api/auth")]
public sealed class AuthController(
    AppDbContext db,
    TokenService tokens,
    AuthOptions options,
    IPasswordHasher<User> passwordHasher,
    IEmailSender emailSender,
    ILogger<AuthController> logger) : ControllerBase
{
    public const string RefreshCookieName = "clinicapp_refresh";

    // Si el frontend pide dos renovaciones casi a la vez (por ejemplo, dos pestañas al recargar),
    // la segunda llega con el token que la primera acaba de reemplazar. Dentro de este margen no se
    // considera robo.
    private static readonly TimeSpan RotationGracePeriod = TimeSpan.FromSeconds(30);

    // Hash de una contraseña ficticia: si el correo no existe, se verifica contra él igual, para que
    // la respuesta tarde lo mismo y no revele qué correos tienen cuenta.
    private static readonly Lazy<string> DummyPasswordHash =
        new(() => new PasswordHasher<User>().HashPassword(new User(), Guid.NewGuid().ToString()));

    /// <summary>Inicia sesión con correo y contraseña.</summary>
    [HttpPost("login")]
    [AllowAnonymous]
    [EnableRateLimiting(RateLimits.Auth)]
    public async Task<ActionResult<LoginResponse>> Login(LoginRequest request, CancellationToken cancellationToken)
    {
        var email = NormalizeEmail(request.Email);
        var user = await db.Users.FirstOrDefaultAsync(u => u.Email == email, cancellationToken);

        if (user is null)
        {
            passwordHasher.VerifyHashedPassword(new User(), DummyPasswordHash.Value, request.Password);
            return InvalidCredentials();
        }

        var result = passwordHasher.VerifyHashedPassword(user, user.PasswordHash, request.Password);
        if (result == PasswordVerificationResult.Failed)
        {
            return InvalidCredentials();
        }

        // Solo se dice que la cuenta está desactivada si la contraseña era correcta.
        if (!user.Active)
        {
            return Problem(
                statusCode: StatusCodes.Status403Forbidden,
                title: "Tu cuenta está desactivada",
                detail: "Comunícate con el administrador de la clínica.");
        }

        // El algoritmo de cifrado se actualizó desde que se guardó la contraseña: se vuelve a cifrar.
        if (result == PasswordVerificationResult.SuccessRehashNeeded)
        {
            user.PasswordHash = passwordHasher.HashPassword(user, request.Password);
        }

        user.LastLoginAt = DateTime.UtcNow;
        return await StartSessionAsync(user, cancellationToken);
    }

    /// <summary>
    /// Renueva la sesión con la cookie de refresh: devuelve un access token nuevo y reemplaza la cookie
    /// (rotación). El frontend lo llama al cargar la app y cuando el access token vence.
    /// </summary>
    [HttpPost("refresh")]
    [AllowAnonymous]
    public async Task<ActionResult<LoginResponse>> Refresh(CancellationToken cancellationToken)
    {
        if (Request.Cookies[RefreshCookieName] is not { Length: > 0 } rawToken)
        {
            return SessionExpired();
        }

        var tokenHash = TokenService.Hash(rawToken);
        var stored = await db.RefreshTokens
            .Include(t => t.User)
            .FirstOrDefaultAsync(t => t.TokenHash == tokenHash, cancellationToken);

        var now = DateTime.UtcNow;

        if (stored is null || stored.ExpiresAt <= now || !stored.User.Active)
        {
            return SessionExpired();
        }

        RefreshToken? replacing = null;

        if (stored.RevokedAt is { } revokedAt)
        {
            // Cerrado por logout, por cambio de contraseña o por seguridad: la sesión terminó.
            if (stored.ReplacedByTokenId is null)
            {
                return SessionExpired();
            }

            // Reemplazado hace más de 30 s: el dueño ya usa el token nuevo, así que quien manda este
            // puede tener una cookie robada. Se cierran todas las sesiones del usuario.
            if (now - revokedAt > RotationGracePeriod)
            {
                logger.LogWarning("Reutilización de un token de refresh ya reemplazado del usuario {UserId}: se cierran todas sus sesiones.", stored.UserId);
                await RevokeAllSessionsAsync(stored.UserId, cancellationToken);
                return SessionExpired();
            }

            // Renovación casi simultánea a la anterior: se entrega otra sesión sin tocar el token viejo.
        }
        else
        {
            // Rotación normal: el token usado deja de valer y queda enlazado al nuevo.
            stored.RevokedAt = now;
            replacing = stored;
        }

        return await StartSessionAsync(stored.User, cancellationToken, replacing);
    }

    /// <summary>Cierra la sesión: invalida el token de refresh y borra la cookie.</summary>
    [HttpPost("logout")]
    [AllowAnonymous]
    public async Task<IActionResult> Logout(CancellationToken cancellationToken)
    {
        if (Request.Cookies[RefreshCookieName] is { Length: > 0 } rawToken)
        {
            var tokenHash = TokenService.Hash(rawToken);
            await db.RefreshTokens
                .Where(t => t.TokenHash == tokenHash && t.RevokedAt == null)
                .ExecuteUpdateAsync(s => s.SetProperty(t => t.RevokedAt, DateTime.UtcNow), cancellationToken);
        }

        DeleteRefreshCookie();
        return NoContent();
    }

    /// <summary>Datos del usuario de la sesión actual.</summary>
    [HttpGet("me")]
    [Authorize]
    public async Task<ActionResult<AuthUserDto>> Me(CancellationToken cancellationToken)
    {
        var user = await FindCurrentUserAsync(cancellationToken);
        return user is null ? SessionExpired() : AuthUserDto.FromEntity(user);
    }

    /// <summary>Guarda el perfil de "Mi perfil" y devuelve el usuario actualizado.</summary>
    [HttpPut("me/profile")]
    [Authorize]
    public async Task<ActionResult<AuthUserDto>> UpdateProfile(UserProfileRequest request, CancellationToken cancellationToken)
    {
        var user = await FindCurrentUserAsync(cancellationToken);
        if (user is null)
        {
            return SessionExpired();
        }

        user.Profile = request.ToEntity();
        await db.SaveChangesAsync(cancellationToken);

        return AuthUserDto.FromEntity(user);
    }

    /// <summary>
    /// Envía el enlace para restablecer la contraseña. Responde siempre 202, exista o no el correo,
    /// para no revelar qué cuentas existen.
    /// </summary>
    [HttpPost("password-recovery")]
    [AllowAnonymous]
    [EnableRateLimiting(RateLimits.Auth)]
    public async Task<IActionResult> PasswordRecovery(PasswordRecoveryRequest request, CancellationToken cancellationToken)
    {
        var email = NormalizeEmail(request.Email);
        var user = await db.Users.FirstOrDefaultAsync(u => u.Email == email && u.Active, cancellationToken);

        if (user is not null)
        {
            // Solo vale el último enlace enviado.
            var link = (await db.CreatePasswordLinkAsync(
                options, user.Id, TimeSpan.FromMinutes(options.PasswordResetMinutes), cancellationToken)).Url;
            await emailSender.SendAsync(
                user.Email,
                "Restablecer tu contraseña de ClinicApp",
                $"Hola, {user.Name}:\n\nPara elegir una contraseña nueva, abre este enlace (vale {options.PasswordResetMinutes} minutos):\n{link}\n\nSi no lo pediste, ignora este correo.",
                cancellationToken);
        }

        return Accepted();
    }

    /// <summary>Fija la contraseña nueva con el token del enlace. Cierra todas las sesiones abiertas.</summary>
    [HttpPost("password-reset")]
    [AllowAnonymous]
    [EnableRateLimiting(RateLimits.Auth)]
    public async Task<IActionResult> PasswordReset(PasswordResetRequest request, CancellationToken cancellationToken)
    {
        var tokenHash = TokenService.Hash(request.Token);
        var now = DateTime.UtcNow;

        var resetToken = await db.PasswordResetTokens
            .Include(t => t.User)
            .FirstOrDefaultAsync(t => t.TokenHash == tokenHash, cancellationToken);

        if (resetToken is null || resetToken.UsedAt is not null || resetToken.ExpiresAt <= now || !resetToken.User.Active)
        {
            return Problem(
                statusCode: StatusCodes.Status400BadRequest,
                title: "El enlace no es válido o ya expiró",
                detail: "Solicita uno nuevo desde «Recuperar contraseña».");
        }

        resetToken.UsedAt = now;
        resetToken.User.PasswordHash = passwordHasher.HashPassword(resetToken.User, request.Password);
        await db.SaveChangesAsync(cancellationToken);

        // Si alguien tenía una sesión abierta con la contraseña anterior, se cierra.
        await RevokeAllSessionsAsync(resetToken.UserId, cancellationToken);

        return NoContent();
    }

    /// <summary>Registra una solicitud de acceso desde "Solicitar acceso".</summary>
    [HttpPost("access-requests")]
    [AllowAnonymous]
    [EnableRateLimiting(RateLimits.Auth)]
    public async Task<IActionResult> CreateAccessRequest(AccessRequestRequest request, CancellationToken cancellationToken)
    {
        db.AccessRequests.Add(new AccessRequest
        {
            Id = Guid.CreateVersion7(),
            Email = NormalizeEmail(request.Email),
            FullName = request.FullName.Trim(),
            Institution = request.Institution?.Trim() ?? "",
            Message = request.Message?.Trim() ?? "",
            CreatedAt = DateTime.UtcNow,
        });
        await db.SaveChangesAsync(cancellationToken);

        return Accepted();
    }

    // ───────────── Ayudantes ─────────────

    public static string NormalizeEmail(string email) => email.Trim().ToLowerInvariant();

    /// <summary>Crea un token de refresh, lo pone en la cookie y devuelve el access token.</summary>
    private async Task<ActionResult<LoginResponse>> StartSessionAsync(
        User user, CancellationToken cancellationToken, RefreshToken? replacing = null)
    {
        var now = DateTime.UtcNow;
        var rawToken = TokenService.NewOpaqueToken();
        var refreshToken = new RefreshToken
        {
            Id = Guid.CreateVersion7(),
            UserId = user.Id,
            TokenHash = TokenService.Hash(rawToken),
            CreatedAt = now,
            ExpiresAt = now.AddDays(options.RefreshTokenDays),
        };
        db.RefreshTokens.Add(refreshToken);

        if (replacing is not null)
        {
            replacing.ReplacedByTokenId = refreshToken.Id;
        }

        await db.SaveChangesAsync(cancellationToken);

        SetRefreshCookie(rawToken, refreshToken.ExpiresAt);
        var (accessToken, expiresIn) = tokens.CreateAccessToken(user);
        return new LoginResponse(accessToken, expiresIn, AuthUserDto.FromEntity(user));
    }

    private Task RevokeAllSessionsAsync(Guid userId, CancellationToken cancellationToken) =>
        db.RevokeAllSessionsAsync(userId, cancellationToken);

    private async Task<User?> FindCurrentUserAsync(CancellationToken cancellationToken)
    {
        if (User.GetUserId() is not { } userId)
        {
            return null;
        }

        return await db.Users.FirstOrDefaultAsync(u => u.Id == userId && u.Active, cancellationToken);
    }

    // Cookie solo para /api/auth: el navegador no la manda a los demás endpoints.
    // SameSite=Strict: no viaja en peticiones que empiezan en otro sitio (protege contra CSRF).
    // Secure: solo por HTTPS (los navegadores aceptan http://localhost como excepción en desarrollo).
    private CookieOptions RefreshCookieOptions(DateTime? expires = null) => new()
    {
        HttpOnly = true,
        Secure = true,
        SameSite = SameSiteMode.Strict,
        Path = "/api/auth",
        Expires = expires,
        IsEssential = true,
    };

    private void SetRefreshCookie(string token, DateTime expiresAt) =>
        Response.Cookies.Append(RefreshCookieName, token, RefreshCookieOptions(expiresAt));

    private void DeleteRefreshCookie() =>
        Response.Cookies.Delete(RefreshCookieName, RefreshCookieOptions());

    private ObjectResult InvalidCredentials() =>
        Problem(statusCode: StatusCodes.Status401Unauthorized, title: "Correo o contraseña incorrectos");

    private ObjectResult SessionExpired()
    {
        DeleteRefreshCookie();
        return Problem(statusCode: StatusCodes.Status401Unauthorized, title: "Tu sesión expiró. Inicia sesión de nuevo");
    }
}
