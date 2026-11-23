namespace ClinicApp.Api.Modules.Auth;

/// <summary>Usuario del sistema (personal de la clínica). Tabla <c>users</c>.</summary>
public class User
{
    public Guid Id { get; set; }

    /// <summary>Siempre en minúsculas y sin espacios, para que el inicio de sesión no distinga mayúsculas.</summary>
    public string Email { get; set; } = "";

    public string Name { get; set; } = "";

    /// <summary>Contraseña cifrada con PasswordHasher (PBKDF2). Nunca se guarda ni se devuelve la contraseña.</summary>
    public string PasswordHash { get; set; } = "";

    /// <summary>Uno de <see cref="Roles"/>.</summary>
    public string Role { get; set; } = Roles.Recepcion;

    /// <summary>
    /// Profesional vinculado (catálogo de profesionales de <c>appointments</c>). Sin llave foránea
    /// hasta que exista esa tabla.
    /// </summary>
    public Guid? ProfessionalId { get; set; }

    /// <summary>Un usuario desactivado no puede iniciar sesión ni renovar su sesión.</summary>
    public bool Active { get; set; } = true;

    /// <summary>Perfil de "Mi perfil". <c>null</c> hasta que el usuario lo completa en su primer ingreso.</summary>
    public UserProfile? Profile { get; set; }

    public DateTime CreatedAt { get; set; }
    public DateTime? LastLoginAt { get; set; }
}

/// <summary>Perfil del usuario. Se guarda como JSON (jsonb) dentro de la fila del usuario.</summary>
public class UserProfile
{
    public string FullName { get; set; } = "";
    public string Title { get; set; } = "";
    public string Specialty { get; set; } = "";
    public string Bio { get; set; } = "";
    public string AvatarColor { get; set; } = "";

    /// <summary>Foto como data URL en base64 (<c>data:image/png;base64,...</c>), o <c>null</c>.</summary>
    public string? AvatarImage { get; set; }
}

/// <summary>
/// Token de refresh: permite renovar la sesión sin volver a escribir la contraseña. Viaja en una
/// cookie httpOnly. En la base solo se guarda su hash (SHA-256): si alguien lee la tabla, no puede
/// usar los tokens.
/// </summary>
public class RefreshToken
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;
    public string TokenHash { get; set; } = "";
    public DateTime CreatedAt { get; set; }
    public DateTime ExpiresAt { get; set; }

    /// <summary>Cuándo dejó de valer: al renovar la sesión (rotación), al cerrarla o al cambiar la contraseña.</summary>
    public DateTime? RevokedAt { get; set; }

    /// <summary>Token que lo reemplazó al renovar la sesión. Vacío si se revocó por otro motivo.</summary>
    public Guid? ReplacedByTokenId { get; set; }

    /// <summary>
    /// "Recordarme": la cookie sobrevive al cierre del navegador y la sesión dura <c>Auth:RefreshTokenDays</c>.
    /// Si no, es una cookie de sesión y vence tras <c>Auth:SessionRefreshHours</c>. Se hereda al renovar.
    /// </summary>
    public bool Persistent { get; set; }
}

/// <summary>Token de un solo uso para restablecer la contraseña. Solo se guarda su hash.</summary>
public class PasswordResetToken
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;
    public string TokenHash { get; set; } = "";
    public DateTime CreatedAt { get; set; }
    public DateTime ExpiresAt { get; set; }
    public DateTime? UsedAt { get; set; }
}

/// <summary>Solicitud de acceso enviada desde "Solicitar acceso". La revisa un administrador.</summary>
public class AccessRequest
{
    public Guid Id { get; set; }
    public string Email { get; set; } = "";
    public string FullName { get; set; } = "";
    public string Institution { get; set; } = "";
    public string Message { get; set; } = "";

    /// <summary><c>pendiente</c> al crearse. Los demás estados se definirán con la pantalla de revisión.</summary>
    public string Status { get; set; } = AccessRequestStatus.Pendiente;

    public DateTime CreatedAt { get; set; }
}

public static class AccessRequestStatus
{
    public const string Pendiente = "pendiente";
}
