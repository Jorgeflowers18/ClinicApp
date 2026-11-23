using System.ComponentModel.DataAnnotations;

namespace ClinicApp.Api.Modules.Auth;

// ───────────── Lo que sale (gestión de usuarios, solo admin) ─────────────

/// <summary>Cuenta de usuario para la pantalla de administración. Nunca trae la contraseña ni su hash.</summary>
public record UserDto(
    Guid Id,
    string Name,
    string Email,
    string Role,
    Guid? ProfessionalId,
    string? ProfessionalName,
    bool Active,
    DateTime CreatedAt,
    DateTime? LastLoginAt);

/// <summary>
/// Enlace de un solo uso para elegir la contraseña (<c>/restablecer-contrasena?token=…</c>). El token solo
/// existe en esta respuesta: en la base se guarda su hash.
/// </summary>
public record PasswordLinkDto(string Url, DateTime ExpiresAt);

/// <summary>Respuesta de crear una cuenta: el usuario y el enlace para que elija su contraseña.</summary>
public record UserCreatedDto(UserDto User, PasswordLinkDto PasswordLink);

// ───────────── Lo que entra ─────────────

public class UserCreateRequest
{
    [Required(ErrorMessage = "El nombre es obligatorio")]
    [MinLength(3, ErrorMessage = "Mínimo 3 caracteres")]
    [MaxLength(120, ErrorMessage = "Máximo 120 caracteres")]
    public string Name { get; set; } = "";

    [Required(ErrorMessage = "El correo es obligatorio")]
    [EmailAddress(ErrorMessage = "Ingresa un correo válido")]
    [MaxLength(254, ErrorMessage = "Máximo 254 caracteres")]
    public string Email { get; set; } = "";

    [Required(ErrorMessage = "Elige un rol")]
    [AllowedValues(Roles.Admin, Roles.Recepcion, Roles.Medico, ErrorMessage = "Elige un rol válido")]
    public string Role { get; set; } = "";

    /// <summary>Profesional del catálogo que es esta persona (o null). Un profesional tiene como máximo una cuenta.</summary>
    public Guid? ProfessionalId { get; set; }
}

public class UserUpdateRequest : UserCreateRequest
{
    /// <summary>Desactivar en lugar de borrar: la cuenta deja de poder iniciar sesión.</summary>
    public bool Active { get; set; } = true;
}
