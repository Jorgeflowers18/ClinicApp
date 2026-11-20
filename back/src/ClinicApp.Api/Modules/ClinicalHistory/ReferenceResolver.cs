using ClinicApp.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace ClinicApp.Api.Modules.ClinicalHistory;

/// <summary>
/// Arma el bloque <c>references</c> de la historia: el nombre de cada tratamiento y profesional que la historia
/// y sus atenciones nombran por id. Se calcula al leer y no se guarda, así no se duplican datos y la
/// impresión muestra todo aunque el tratamiento esté inactivo o fuera de los primeros 100 del catálogo.
/// </summary>
public class ReferenceResolver(AppDbContext db)
{
    public async Task<ClinicalReferences> ResolveAsync(ClinicalRecordDto record, IReadOnlyCollection<ClinicalEncounterDto> encounters, CancellationToken cancellationToken)
    {
        var treatmentIds = record.Plan.Select(item => item.TreatmentId)
            .Concat(encounters.SelectMany(encounter => encounter.PerformedTreatments).Select(item => item.TreatmentId))
            .OfType<Guid>()
            .Distinct()
            .ToList();

        var professionalIds = encounters.Select(encounter => encounter.ProfessionalId)
            .Concat(Guid.TryParse(record.TruthDeclaration.ProfessionalId, out var declared) ? [declared] : [])
            .Distinct()
            .ToList();

        var treatments = treatmentIds.Count == 0
            ? []
            : await db.Treatments.AsNoTracking()
                .Where(treatment => treatmentIds.Contains(treatment.Id))
                .ToDictionaryAsync(treatment => treatment.Id, treatment => new TreatmentReference(treatment.Name, treatment.Category, treatment.Active), cancellationToken);

        var professionals = professionalIds.Count == 0
            ? []
            : await db.Professionals.AsNoTracking()
                .Where(professional => professionalIds.Contains(professional.Id))
                .ToDictionaryAsync(professional => professional.Id,
                    professional => new ProfessionalReference(professional.Name, professional.Specialty, professional.RegistrationNumber, professional.Active),
                    cancellationToken);

        return new ClinicalReferences(treatments, professionals);
    }
}
