using ClinicApp.Api.Common;
using ClinicApp.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace ClinicApp.Api.Modules.ClinicalHistory;

/// <summary>
/// Lee la historia completa de un paciente: <c>{ record, encounters, references }</c>. La usan el GET de la
/// historia y las operaciones del archivo clínico, que devuelven la historia actualizada.
/// </summary>
public class ClinicalHistoryLoader(AppDbContext db, ClinicClock clock, ReferenceResolver references)
{
    /// <summary>Adjuntos del paciente con sus etiquetas y su auditoría (para los metadatos del archivo clínico).</summary>
    public IQueryable<ClinicalAttachment> Attachments(Guid patientId) =>
        db.ClinicalAttachments.Include(attachment => attachment.Tags).Include(attachment => attachment.Audit)
            .Where(attachment => attachment.PatientId == patientId);

    public async Task<PatientClinicalHistoryDto> LoadAsync(Guid patientId, CancellationToken cancellationToken)
    {
        var record = await db.ClinicalRecords.AsNoTracking().FirstOrDefaultAsync(entry => entry.PatientId == patientId, cancellationToken);
        var attachments = await Attachments(patientId).AsNoTracking().AsSplitQuery().ToListAsync(cancellationToken);
        var recordDto = record is null ? ClinicalRecordDto.Empty(patientId, clock.UtcNow) : ClinicalRecordDto.FromEntity(record, attachments);

        var encounters = await db.ClinicalEncounters.AsNoTracking()
            .Include(encounter => encounter.Addenda)
            .Where(encounter => encounter.PatientId == patientId)
            .OrderBy(encounter => encounter.Date)
            .ThenBy(encounter => encounter.CreatedAt)
            .ToListAsync(cancellationToken);
        var encounterDtos = encounters.Select(ClinicalEncounterDto.FromEntity).ToList();

        return new PatientClinicalHistoryDto(recordDto, encounterDtos, await references.ResolveAsync(recordDto, encounterDtos, cancellationToken));
    }
}
