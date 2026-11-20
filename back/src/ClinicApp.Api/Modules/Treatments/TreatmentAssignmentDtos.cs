using System.ComponentModel.DataAnnotations;
using ClinicApp.Api.Common;

namespace ClinicApp.Api.Modules.Treatments;

/// <summary>Tratamiento realizado: la forma de <c>TreatmentAssignment</c> del frontend (treatment.types.ts).</summary>
public record TreatmentAssignmentDto(
    Guid Id,
    Guid TreatmentId,
    Guid PatientId,
    int TotalSessions,
    int CompletedSessions,
    string Status,
    string StartDate,
    string Tooth,
    Guid? SourceEncounterId,
    decimal? Price,
    string? SourceKey)
{
    public static TreatmentAssignmentDto FromEntity(TreatmentAssignment assignment) => new(
        assignment.Id,
        assignment.TreatmentId,
        assignment.PatientId,
        assignment.TotalSessions,
        assignment.CompletedSessions,
        assignment.Status,
        assignment.StartDate.ToString(IsoDateAttribute.Format),
        assignment.Tooth,
        assignment.SourceEncounterId,
        assignment.Price,
        assignment.SourceKey);
}

/// <summary>Registrar un tratamiento realizado: la forma de <c>CreateAssignmentInput</c>.</summary>
public class CreateAssignmentRequest
{
    [Required(ErrorMessage = "Selecciona un tratamiento")]
    public Guid? TreatmentId { get; set; }

    [Required(ErrorMessage = "Selecciona un paciente")]
    public Guid? PatientId { get; set; }

    /// <summary>Fecha de la atención, "YYYY-MM-DD". No futura (lo revisa el controlador).</summary>
    [Required(ErrorMessage = "La fecha es obligatoria")]
    [IsoDate]
    public string Date { get; set; } = "";

    [MaxLength(60, ErrorMessage = "Máximo 60 caracteres")]
    public string? Tooth { get; set; }

    /// <summary>Id de la atención (UUID que genera el frontend). Vacío si no viene de una atención.</summary>
    public string? SourceEncounterId { get; set; }

    /// <summary>Clave de idempotencia: "{atención}:{tratamiento de esa atención}".</summary>
    [MaxLength(200, ErrorMessage = "Máximo 200 caracteres")]
    public string? SourceKey { get; set; }

    /// <summary>Costo cobrado. Si no viene, se usa el precio del catálogo.</summary>
    [Range(typeof(decimal), "0", "99999999.99", ParseLimitsInInvariantCulture = true,
        ErrorMessage = "El costo debe estar entre 0 y 99 999 999,99")]
    public decimal? Price { get; set; }
}
