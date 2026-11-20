using System.Text.Json;
using ClinicApp.Api.Common;
using ClinicApp.Api.Data;
using ClinicApp.Api.Modules.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ClinicApp.Api.Modules.ClinicalHistory;

/// <summary>
/// Historia clínica de un paciente: /api/clinical-history/patients/{patientId}. Solo admin y médico.
/// </summary>
[ApiController]
[Route("api/clinical-history/patients/{patientId:guid}")]
[Authorize(Roles = Roles.AdminYMedico)]
public class ClinicalRecordsController(AppDbContext db, ClinicClock clock, ClinicalHistoryLoader loader) : ControllerBase
{
    public const string ConcurrencyMessage = "Otra pestaña o usuario modificó esta historia. Recarga la historia antes de continuar.";

    /// <summary>
    /// GET → { record, encounters, references }. Si el paciente no tiene historia, devuelve una vacía
    /// (revision 0) sin guardarla. Las atenciones van de la más antigua a la más reciente, con sus notas.
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<PatientClinicalHistoryDto>> Get(Guid patientId, CancellationToken cancellationToken)
    {
        if (!await db.Patients.AnyAsync(patient => patient.Id == patientId, cancellationToken)) return PatientNotFound();

        return await loader.LoadAsync(patientId, cancellationToken);
    }

    /// <summary>
    /// PUT → guarda la historia completa y devuelve la guardada con revision + 1.
    /// 409 si la revisión enviada no es la guardada (otra pestaña o usuario la cambió antes).
    /// Antes de sobrescribir, copia la versión anterior en clinical_record_versions.
    /// </summary>
    [HttpPut]
    public async Task<ActionResult<ClinicalRecordDto>> Save(Guid patientId, SaveRecordRequest request, CancellationToken cancellationToken)
    {
        var patient = await db.Patients.AsNoTracking().Where(entry => entry.Id == patientId).Select(entry => new { entry.DeletedAt }).FirstOrDefaultAsync(cancellationToken);
        if (patient is null) return PatientNotFound();
        if (patient.DeletedAt is not null) return Problem(statusCode: StatusCodes.Status409Conflict, title: "Reactiva al paciente antes de editar su historia");

        AddErrors(SectionRules.ValidateIds(request.Plan.Select(item => item.Id), "plan"));
        AddErrors(SectionRules.ValidateIds(request.ExamRequests.Select(item => item.Id), "examRequests"));
        if (!ModelState.IsValid) return this.ValidationError(ModelState);

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        // Un guardado a la vez por paciente: el segundo espera y luego ve la revisión nueva (y recibe 409).
        await db.Database.ExecuteSqlAsync($"SELECT pg_advisory_xact_lock(hashtext({"clinical-record:" + patientId}))", cancellationToken);

        var record = await db.ClinicalRecords.FirstOrDefaultAsync(entry => entry.PatientId == patientId, cancellationToken);
        var currentRevision = record?.Revision ?? 0;
        if (request.Revision != currentRevision) return Problem(statusCode: StatusCodes.Status409Conflict, title: ConcurrencyMessage);

        var attachments = await loader.Attachments(patientId).AsSplitQuery().ToListAsync(cancellationToken);
        await ValidateReferencesAsync(patientId, request, attachments, cancellationToken);
        if (!ModelState.IsValid) return this.ValidationError(ModelState);

        var now = clock.UtcNow;
        var userId = User.GetUserId();

        if (record is null)
        {
            record = new ClinicalRecord { PatientId = patientId, Revision = 0, CreatedAt = now };
            db.ClinicalRecords.Add(record);
        }
        else
        {
            // "Fotocopia" de la versión que se va a reemplazar, con quién la había guardado y cuándo.
            var previous = ClinicalRecordDto.FromEntity(record, attachments);
            db.ClinicalRecordVersions.Add(new ClinicalRecordVersion
            {
                Id = Guid.CreateVersion7(),
                PatientId = patientId,
                Revision = record.Revision,
                Data = JsonSerializer.SerializeToElement(previous, JsonbConversion.Options),
                SavedByUserId = record.UpdatedByUserId,
                SavedAt = record.UpdatedAt,
            });
        }

        Apply(request, record);
        record.Revision = currentRevision + 1;
        record.UpdatedAt = now;
        record.UpdatedByUserId = userId;

        // Adjuntos: la lista enviada decide cuáles quedan en la historia. Los que salen no se borran:
        // se marcan como quitados, porque las versiones anteriores los siguen nombrando.
        var wanted = request.Attachments.Select(item => item.Id!.Value).ToHashSet();
        foreach (var attachment in attachments)
        {
            if (wanted.Contains(attachment.Id))
            {
                attachment.LinkedAt ??= now;
                attachment.RemovedAt = null;
            }
            else if (attachment.IsInRecord)
            {
                attachment.RemovedAt = now;
            }
        }

        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        return ClinicalRecordDto.FromEntity(record, attachments);
    }

    /// <summary>
    /// Referencias que necesitan la base: tratamientos del plan, profesional de la declaración, adjuntos del
    /// consentimiento y de los exámenes, y la atención que pidió cada examen.
    /// </summary>
    private async Task ValidateReferencesAsync(Guid patientId, SaveRecordRequest request, List<ClinicalAttachment> attachments, CancellationToken cancellationToken)
    {
        var owned = attachments.Where(attachment => attachment.PurgedAt is null).Select(attachment => attachment.Id).ToHashSet();
        for (var index = 0; index < request.Attachments.Count; index++)
        {
            if (!owned.Contains(request.Attachments[index].Id!.Value))
                ModelState.AddModelError($"attachments[{index}].id", "El adjunto no pertenece a este paciente");
        }

        var inRecord = request.Attachments.Select(item => item.Id!.Value.ToString()).ToHashSet(StringComparer.OrdinalIgnoreCase);
        if (request.DataConsent.AttachmentId is { Length: > 0 } consentFile && !inRecord.Contains(consentFile))
            ModelState.AddModelError("dataConsent.attachmentId", "El documento firmado no está en los adjuntos de la historia");

        var treatmentIds = request.Plan.Select(item => item.TreatmentId).OfType<Guid>().Distinct().ToList();
        var existingTreatments = treatmentIds.Count == 0
            ? []
            : await db.Treatments.Where(treatment => treatmentIds.Contains(treatment.Id)).Select(treatment => treatment.Id).ToListAsync(cancellationToken);
        for (var index = 0; index < request.Plan.Count; index++)
        {
            if (request.Plan[index].TreatmentId is { } treatmentId && !existingTreatments.Contains(treatmentId))
                ModelState.AddModelError($"plan[{index}].treatmentId", "El tratamiento no existe en el catálogo");
        }

        if (request.TruthDeclaration.ProfessionalId is { Length: > 0 } declared)
        {
            var exists = Guid.TryParse(declared, out var professionalId)
                && await db.Professionals.AnyAsync(professional => professional.Id == professionalId, cancellationToken);
            if (!exists) ModelState.AddModelError("truthDeclaration.professionalId", "El profesional no existe");
        }

        var encounterIds = await db.ClinicalEncounters.Where(encounter => encounter.PatientId == patientId)
            .Select(encounter => encounter.Id.ToString()).ToListAsync(cancellationToken);
        var ownEncounters = encounterIds.ToHashSet(StringComparer.OrdinalIgnoreCase);
        for (var index = 0; index < request.ExamRequests.Count; index++)
        {
            var exam = request.ExamRequests[index];
            if (!ownEncounters.Contains(exam.EncounterId))
                ModelState.AddModelError($"examRequests[{index}].encounterId", "La atención no es de este paciente");
            if (exam.AttachmentId is { Length: > 0 } examFile && !inRecord.Contains(examFile))
                ModelState.AddModelError($"examRequests[{index}].attachmentId", "El resultado no está en los adjuntos de la historia");
        }
    }

    /// <summary>Copia las secciones en la entidad, normalizadas.</summary>
    private static void Apply(SaveRecordRequest request, ClinicalRecord record)
    {
        record.Chart = request.Chart is { ValueKind: JsonValueKind.Object } chart ? chart : null;
        record.MedicalBackground = request.MedicalBackground.Normalized();
        request.AllergiesAndMedication.Alerts = request.AllergiesAndMedication.Alerts.Distinct().ToList();
        record.AllergiesAndMedication = request.AllergiesAndMedication;
        request.Habits.Hygiene.Aids = request.Habits.Hygiene.Aids.Distinct().ToList();
        record.Habits = request.Habits;
        request.DentalBackground.Items = request.DentalBackground.Items.Distinct().ToList();
        record.DentalBackground = request.DentalBackground;
        request.PeriodontalBackground.Items = request.PeriodontalBackground.Items.Distinct().ToList();
        record.PeriodontalBackground = request.PeriodontalBackground;

        // Solo se guarda la referencia al catálogo: el nombre se resuelve al leer (bloque references).
        // La descripción se conserva únicamente en los ítems antiguos de texto libre.
        foreach (var item in request.Plan.Where(item => item.TreatmentId is not null)) item.Description = "";
        record.Plan = request.Plan;

        if (string.IsNullOrWhiteSpace(request.DataConsent.AttachmentId)) request.DataConsent.AttachmentId = null;
        record.DataConsent = request.DataConsent;
        record.TruthDeclaration = request.TruthDeclaration;
        record.ExamRequests = request.ExamRequests;
    }

    private void AddErrors(IEnumerable<System.ComponentModel.DataAnnotations.ValidationResult> errors)
    {
        foreach (var error in errors)
        {
            ModelState.AddModelError(error.MemberNames.First(), error.ErrorMessage ?? "Dato inválido");
        }
    }

    private ObjectResult PatientNotFound() => Problem(statusCode: StatusCodes.Status404NotFound, title: "Paciente no encontrado");
}
