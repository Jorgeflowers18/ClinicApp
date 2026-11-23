using System.ComponentModel.DataAnnotations;
using ClinicApp.Api.Common;
using ClinicApp.Api.Data;
using ClinicApp.Api.Modules.Patients;
using Microsoft.EntityFrameworkCore;

namespace ClinicApp.Api.Modules.Treatments;

/// <summary>
/// Tratamiento realizado: la forma de <c>TreatmentAssignment</c> del frontend (treatment.types.ts), con el nombre
/// del paciente ("Nombres Apellidos") y el del tratamiento, para que las listas no pidan cada uno por separado
/// ni dependan de "los primeros 100" del catálogo.
/// </summary>
public record TreatmentAssignmentDto(
    Guid Id,
    Guid TreatmentId,
    string TreatmentName,
    Guid PatientId,
    string PatientName,
    int TotalSessions,
    int CompletedSessions,
    string Status,
    string StartDate,
    string Tooth,
    Guid? SourceEncounterId,
    decimal? Price,
    string? SourceKey)
{
    public static TreatmentAssignmentDto FromEntity(TreatmentAssignment assignment, string treatmentName, string patientName) => new(
        assignment.Id,
        assignment.TreatmentId,
        treatmentName,
        assignment.PatientId,
        patientName,
        assignment.TotalSessions,
        assignment.CompletedSessions,
        assignment.Status,
        assignment.StartDate.ToString(IsoDateAttribute.Format),
        assignment.Tooth,
        assignment.SourceEncounterId,
        assignment.Price,
        assignment.SourceKey);

    /// <summary>Convierte una lista trayendo los nombres de sus pacientes y tratamientos en dos consultas.</summary>
    public static async Task<List<TreatmentAssignmentDto>> FromEntitiesAsync(
        IReadOnlyList<TreatmentAssignment> assignments, AppDbContext db, CancellationToken cancellationToken)
    {
        var patients = await db.PatientNamesAsync(assignments.Select(assignment => assignment.PatientId), cancellationToken);
        var treatmentIds = assignments.Select(assignment => assignment.TreatmentId).Distinct().ToList();
        var treatments = treatmentIds.Count == 0
            ? []
            : await db.Treatments.AsNoTracking()
                .Where(treatment => treatmentIds.Contains(treatment.Id))
                .ToDictionaryAsync(treatment => treatment.Id, treatment => treatment.Name, cancellationToken);
        return assignments.Select(assignment => FromEntity(
            assignment, treatments.GetValueOrDefault(assignment.TreatmentId, ""), patients.GetValueOrDefault(assignment.PatientId, ""))).ToList();
    }

    public static async Task<TreatmentAssignmentDto> FromEntityAsync(TreatmentAssignment assignment, AppDbContext db, CancellationToken cancellationToken) =>
        (await FromEntitiesAsync([assignment], db, cancellationToken))[0];
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
