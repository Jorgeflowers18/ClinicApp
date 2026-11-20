using System.ComponentModel.DataAnnotations;
using ClinicApp.Api.Common;

namespace ClinicApp.Api.Modules.Inventory;

/// <summary>Ciclo de esterilización: la forma de <c>SterilizationCycle</c> en el frontend.</summary>
public record SterilizationCycleDto(
    Guid Id,
    IReadOnlyList<Guid> ItemIds,
    DateOnly PerformedAt,
    string Result,
    Guid ResponsibleProfessionalId,
    string? Notes,
    DateTime CreatedAt)
{
    public static SterilizationCycleDto FromEntity(SterilizationCycle cycle) => new(
        cycle.Id,
        cycle.Items.Select(item => item.ItemId).ToList(),
        cycle.PerformedAt,
        cycle.Result,
        cycle.ResponsibleProfessionalId,
        cycle.Notes,
        cycle.CreatedAt);
}

/// <summary>Registrar un ciclo: la forma de <c>SterilizationCycleFormValues</c>.</summary>
public class SterilizationCycleRequest
{
    [Required(ErrorMessage = "Selecciona al menos un instrumento")]
    [MinLength(1, ErrorMessage = "Selecciona al menos un instrumento")]
    [MaxLength(200, ErrorMessage = "Máximo 200 instrumentos por ciclo")]
    public List<Guid> ItemIds { get; set; } = [];

    /// <summary>"YYYY-MM-DD" (input type="date").</summary>
    [Required(ErrorMessage = "La fecha es obligatoria")]
    [IsoDate]
    public string PerformedAt { get; set; } = "";

    [Required(ErrorMessage = "Selecciona un resultado")]
    [AllowedValues(SterilizationResults.Aprobado, SterilizationResults.Fallido, ErrorMessage = "Selecciona un resultado")]
    public string Result { get; set; } = "";

    [Required(ErrorMessage = "Selecciona un responsable")]
    public Guid? ResponsibleProfessionalId { get; set; }

    [MaxLength(1000, ErrorMessage = "Máximo 1000 caracteres")]
    public string? Notes { get; set; }
}
