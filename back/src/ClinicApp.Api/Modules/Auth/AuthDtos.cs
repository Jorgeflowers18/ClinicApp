using System.ComponentModel.DataAnnotations;

namespace ClinicApp.Api.Modules.Auth;

// ───────────── Lo que sale (contrato de front/src/modules/auth/types/auth.types.ts) ─────────────

public record LoginResponse(string AccessToken, int ExpiresIn, AuthUserDto User);

public record AuthUserDto(Guid Id, string Name, string Email, string Role, Guid? ProfessionalId, UserProfileDto? Profile)
{
    public static AuthUserDto FromEntity(User user) => new(
        user.Id,
        user.Name,
        user.Email,
        user.Role,
        user.ProfessionalId,
        user.Profile is null ? null : UserProfileDto.FromEntity(user.Profile));
}

public record UserProfileDto(string FullName, string Title, string Specialty, string Bio, string AvatarColor, string? AvatarImage)
{
    public static UserProfileDto FromEntity(UserProfile profile) => new(
        profile.FullName, profile.Title, profile.Specialty, profile.Bio, profile.AvatarColor, profile.AvatarImage);
}

// ───────────── Lo que entra ─────────────

public class LoginRequest
{
    [Required(ErrorMessage = "El correo es obligatorio")]
    [EmailAddress(ErrorMessage = "Ingresa un correo válido")]
    [MaxLength(254, ErrorMessage = "Máximo 254 caracteres")]
    public string Email { get; set; } = "";

    [Required(ErrorMessage = "La contraseña es obligatoria")]
    [MaxLength(128, ErrorMessage = "Máximo 128 caracteres")]
    public string Password { get; set; } = "";
}

public class UserProfileRequest
{
    /// <summary>Foto de hasta ~300 KB (la data URL en base64 ocupa un 33 % más que la imagen).</summary>
    public const int MaxAvatarLength = 400_000;

    [Required(ErrorMessage = "El nombre completo es obligatorio")]
    [MaxLength(120, ErrorMessage = "Máximo 120 caracteres")]
    public string FullName { get; set; } = "";

    [MaxLength(80, ErrorMessage = "Máximo 80 caracteres")]
    public string? Title { get; set; }

    [MaxLength(80, ErrorMessage = "Máximo 80 caracteres")]
    public string? Specialty { get; set; }

    [MaxLength(1000, ErrorMessage = "Máximo 1000 caracteres")]
    public string? Bio { get; set; }

    [Required(ErrorMessage = "Elige un color")]
    [RegularExpression("^#[0-9a-fA-F]{6}$", ErrorMessage = "El color debe tener el formato #RRGGBB")]
    public string AvatarColor { get; set; } = "";

    [MaxLength(MaxAvatarLength, ErrorMessage = "La foto no puede superar 300 KB")]
    [RegularExpression("^data:image/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+={0,2}$",
        ErrorMessage = "La foto debe ser una imagen PNG, JPG, WEBP o GIF")]
    public string? AvatarImage { get; set; }

    public UserProfile ToEntity() => new()
    {
        FullName = FullName.Trim(),
        Title = Title?.Trim() ?? "",
        Specialty = Specialty?.Trim() ?? "",
        Bio = Bio?.Trim() ?? "",
        AvatarColor = AvatarColor,
        AvatarImage = string.IsNullOrEmpty(AvatarImage) ? null : AvatarImage,
    };
}

public class PasswordRecoveryRequest
{
    [Required(ErrorMessage = "El correo es obligatorio")]
    [EmailAddress(ErrorMessage = "Ingresa un correo válido")]
    [MaxLength(254, ErrorMessage = "Máximo 254 caracteres")]
    public string Email { get; set; } = "";
}

public class PasswordResetRequest
{
    [Required(ErrorMessage = "El enlace no es válido")]
    [MaxLength(100, ErrorMessage = "El enlace no es válido")]
    public string Token { get; set; } = "";

    [Required(ErrorMessage = "La contraseña es obligatoria")]
    [MinLength(8, ErrorMessage = "Mínimo 8 caracteres")]
    [MaxLength(128, ErrorMessage = "Máximo 128 caracteres")]
    public string Password { get; set; } = "";
}

public class AccessRequestRequest
{
    [Required(ErrorMessage = "El correo es obligatorio")]
    [EmailAddress(ErrorMessage = "Ingresa un correo válido")]
    [MaxLength(254, ErrorMessage = "Máximo 254 caracteres")]
    public string Email { get; set; } = "";

    [Required(ErrorMessage = "El nombre completo es obligatorio")]
    [MaxLength(120, ErrorMessage = "Máximo 120 caracteres")]
    public string FullName { get; set; } = "";

    [MaxLength(160, ErrorMessage = "Máximo 160 caracteres")]
    public string? Institution { get; set; }

    [MaxLength(1000, ErrorMessage = "Máximo 1000 caracteres")]
    public string? Message { get; set; }
}
