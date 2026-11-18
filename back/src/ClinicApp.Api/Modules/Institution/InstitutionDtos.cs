using System.ComponentModel.DataAnnotations;
using ClinicApp.Api.Common;

namespace ClinicApp.Api.Modules.Institution;

/// <summary>Perfil completo: la forma de <c>InstitutionProfile</c> del frontend (institution.types.ts).</summary>
public record InstitutionProfileDto(
    string Name, string LegalName, string Ruc, string Phone, string Email, string Address, string Website,
    string LogoText, string? LogoImage, string Notes, string Hours, List<InstitutionBranchDto> Branches, DateTime UpdatedAt)
{
    public static InstitutionProfileDto FromEntity(InstitutionProfile profile) => new(
        profile.Name, profile.LegalName, profile.Ruc, profile.Phone, profile.Email, profile.Address, profile.Website,
        profile.LogoText, profile.LogoImage, profile.Notes, profile.Hours,
        profile.Branches.OrderBy(branch => branch.Position).Select(InstitutionBranchDto.FromEntity).ToList(),
        profile.UpdatedAt);
}

public record InstitutionBranchDto(string Id, string Name, string Address, string Phone, string Hours, bool IsMain)
{
    public static InstitutionBranchDto FromEntity(InstitutionBranch branch) =>
        new(branch.Id, branch.Name, branch.Address, branch.Phone, branch.Hours, branch.IsMain);
}

/// <summary>Lo único que ve la pantalla de inicio de sesión (sin sesión).</summary>
public record PublicInstitutionDto(string Name, string LogoText, string? LogoImage);

/// <summary>Guardar el perfil (PUT, solo admin): el perfil completo con sus sedes.</summary>
public class InstitutionProfileRequest : IValidatableObject
{
    /// <summary>~500 KB de imagen en base64 (un 33 % más que el archivo).</summary>
    public const int MaxLogoLength = 700_000;

    [Required(ErrorMessage = "El nombre es obligatorio")]
    [MinLength(2, ErrorMessage = "Mínimo 2 caracteres")]
    [MaxLength(160, ErrorMessage = "Máximo 160 caracteres")]
    public string Name { get; set; } = "";

    [MaxLength(200, ErrorMessage = "Máximo 200 caracteres")]
    public string? LegalName { get; set; }

    [RegularExpression(@"^\s*(\d{13})?\s*$", ErrorMessage = "El RUC debe tener 13 dígitos")]
    public string? Ruc { get; set; }

    [MaxLength(30, ErrorMessage = "Máximo 30 caracteres")]
    public string? Phone { get; set; }

    [MaxLength(254, ErrorMessage = "Máximo 254 caracteres")]
    [RegularExpression(Validation.OptionalEmailPattern, ErrorMessage = "Correo inválido")]
    public string? Email { get; set; }

    [MaxLength(250, ErrorMessage = "Máximo 250 caracteres")]
    public string? Address { get; set; }

    [MaxLength(200, ErrorMessage = "Máximo 200 caracteres")]
    [RegularExpression(@"^\s*(https?://\S+)?\s*$", ErrorMessage = "Escribe la dirección completa (https://…)")]
    public string? Website { get; set; }

    [MaxLength(10, ErrorMessage = "Máximo 10 caracteres")]
    public string? LogoText { get; set; }

    /// <summary>data:image/png|jpeg|webp;base64,… (SVG no: puede llevar código).</summary>
    [MaxLength(MaxLogoLength, ErrorMessage = "El logo no puede pesar más de 500 KB")]
    [RegularExpression("^data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$", ErrorMessage = "El logo debe ser una imagen PNG, JPG o WebP")]
    public string? LogoImage { get; set; }

    [MaxLength(1000, ErrorMessage = "Máximo 1000 caracteres")]
    public string? Notes { get; set; }

    [MaxLength(500, ErrorMessage = "Máximo 500 caracteres")]
    public string? Hours { get; set; }

    [MaxLength(20, ErrorMessage = "Máximo 20 sedes")]
    public List<InstitutionBranchRequest> Branches { get; set; } = [];

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (Branches.Count(branch => branch.IsMain) > 1)
            yield return new ValidationResult("Solo puede haber una sede principal", ["branches"]);

        var seen = new HashSet<string>();
        for (var index = 0; index < Branches.Count; index++)
        {
            var id = Branches[index].Id?.Trim() ?? "";
            if (id.Length is 0 or > 60) yield return new ValidationResult("Identificador inválido", [$"branches[{index}].id"]);
            else if (!seen.Add(id)) yield return new ValidationResult("Sede repetida", [$"branches[{index}].id"]);
        }
    }
}

public class InstitutionBranchRequest
{
    public string Id { get; set; } = "";

    [Required(ErrorMessage = "El nombre de la sede es obligatorio")]
    [MinLength(2, ErrorMessage = "Mínimo 2 caracteres")]
    [MaxLength(120, ErrorMessage = "Máximo 120 caracteres")]
    public string Name { get; set; } = "";

    [MaxLength(250, ErrorMessage = "Máximo 250 caracteres")]
    public string? Address { get; set; }

    [MaxLength(30, ErrorMessage = "Máximo 30 caracteres")]
    public string? Phone { get; set; }

    [MaxLength(500, ErrorMessage = "Máximo 500 caracteres")]
    public string? Hours { get; set; }

    public bool IsMain { get; set; }
}
