using ClinicApp.Api.Common;
using ClinicApp.Api.Data;
using ClinicApp.Api.Modules.Auth;
using ClinicApp.Api.Modules.Inventory;
using ClinicApp.Api.Modules.Treatments;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace ClinicApp.Api.Modules.ClinicalHistory;

/// <summary>
/// Atenciones de la historia clínica (inmutables) y sus notas aclaratorias. Solo admin y médico.
/// </summary>
[ApiController]
[Route("api/clinical-history")]
[Authorize(Roles = Roles.AdminYMedico)]
public class EncountersController(AppDbContext db, ClinicClock clock, StockService stock, ClinicalHistoryLoader loader) : ControllerBase
{
    /// <summary>
    /// GET /api/clinical-history/encounters?page&amp;pageSize&amp;search&amp;patientId&amp;professionalId
    /// De la más reciente a la más antigua. search busca, sin tildes, en el motivo, los diagnósticos y el
    /// nombre o la cédula del paciente.
    /// </summary>
    [HttpGet("encounters")]
    public async Task<PagedResult<EncounterListItemDto>> List(
        [FromQuery] PageQuery query, [FromQuery] Guid? patientId, [FromQuery] Guid? professionalId, CancellationToken cancellationToken)
    {
        var encounters = db.ClinicalEncounters.AsNoTracking();
        if (patientId is not null) encounters = encounters.Where(encounter => encounter.PatientId == patientId);
        if (professionalId is not null) encounters = encounters.Where(encounter => encounter.ProfessionalId == professionalId);

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var pattern = TextSearch.ContainsPattern(query.Search);
            var matchingPatients = db.Patients
                .Where(patient =>
                    EF.Functions.ILike(TextSearch.Unaccent(patient.FirstName + " " + patient.LastName), TextSearch.Unaccent(pattern))
                    || EF.Functions.ILike(patient.DocumentId, pattern))
                .Select(patient => patient.Id);

            encounters = encounters.Where(encounter =>
                EF.Functions.ILike(TextSearch.Unaccent(encounter.Reason), TextSearch.Unaccent(pattern))
                || EF.Functions.ILike(TextSearch.Unaccent(encounter.DiagnosisSummary), TextSearch.Unaccent(pattern))
                || matchingPatients.Contains(encounter.PatientId));
        }

        var page = await encounters
            .OrderByDescending(encounter => encounter.Date)
            .ThenByDescending(encounter => encounter.CreatedAt)
            .ToPagedResultAsync(query, cancellationToken);

        return new PagedResult<EncounterListItemDto>(
            page.Items.Select(encounter => new EncounterListItemDto(
                encounter.Id, encounter.PatientId, encounter.Date.ToString(IsoDateAttribute.Format), encounter.ProfessionalId,
                encounter.LegacyProfessionalName, encounter.Reason, encounter.Diagnoses,
                encounter.NextVisit?.ToString(IsoDateAttribute.Format) ?? "")).ToList(),
            page.Page, page.PageSize, page.TotalItems, page.TotalPages);
    }

    /// <summary>
    /// POST /api/clinical-history/patients/{patientId}/encounters → 201 con la atención.
    /// Idempotente por id: si ya existe para este paciente, 200 con la guardada (sin comparar contenido);
    /// si el id es de otro paciente, 409. Una cita tiene como máximo una atención (409).
    /// </summary>
    [HttpPost("patients/{patientId:guid}/encounters")]
    [RequestSizeLimit(5 * 1024 * 1024)]
    public async Task<ActionResult<ClinicalEncounterDto>> Create(Guid patientId, CreateEncounterRequest request, CancellationToken cancellationToken)
    {
        var id = request.Id!.Value;
        var patient = await db.Patients.AsNoTracking().Where(entry => entry.Id == patientId).Select(entry => new { entry.DeletedAt }).FirstOrDefaultAsync(cancellationToken);
        if (patient is null) return Problem(statusCode: StatusCodes.Status404NotFound, title: "Paciente no encontrado");

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        await db.Database.ExecuteSqlAsync($"SELECT pg_advisory_xact_lock(hashtext({"encounter:" + id}))", cancellationToken);

        var existing = await db.ClinicalEncounters.AsNoTracking().Include(encounter => encounter.Addenda)
            .FirstOrDefaultAsync(encounter => encounter.Id == id, cancellationToken);
        if (existing is not null)
        {
            return existing.PatientId == patientId
                ? Ok(ClinicalEncounterDto.FromEntity(existing))
                : this.FieldConflict("id", "Ese identificador ya pertenece a una atención de otro paciente");
        }

        if (patient.DeletedAt is not null) return Problem(statusCode: StatusCodes.Status409Conflict, title: "Reactiva al paciente antes de registrar una atención");

        await ValidateReferencesAsync(patientId, request, cancellationToken);
        if (!ModelState.IsValid) return this.ValidationError(ModelState);

        if (request.AppointmentId is { } appointmentId
            && await db.ClinicalEncounters.AnyAsync(encounter => encounter.AppointmentId == appointmentId, cancellationToken))
        {
            return this.FieldConflict("appointmentId", "La cita ya está vinculada a otra atención");
        }

        var encounter = ToEntity(patientId, request);
        db.ClinicalEncounters.Add(encounter);

        try
        {
            await db.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
        }
        catch (DbUpdateException exception) when (exception.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            // Dos atenciones simultáneas con la misma cita: la llave única deja pasar solo una.
            return this.FieldConflict("appointmentId", "La cita ya está vinculada a otra atención");
        }

        return StatusCode(StatusCodes.Status201Created, ClinicalEncounterDto.FromEntity(encounter));
    }

    /// <summary>
    /// POST /api/clinical-history/patients/{patientId}/encounters/register → registra la atención completa en
    /// <b>una sola transacción</b> (lo que hoy el frontend hace en cuatro pasos, <c>registerEncounterSequence</c>):
    /// <list type="number">
    /// <item>cada tratamiento realizado sin <c>assignmentId</c> se registra en Tratamientos (completado, con el
    /// profesional de la atención y el costo cobrado) y descuenta sus insumos por FEFO; idempotente por
    /// <c>sourceKey</c> = "{atención}:{ítem}";</item>
    /// <item>se crea la atención, con los <c>assignmentId</c>;</item>
    /// <item>en la historia se quitan los propuestos registrados (mismo id) y se agregan los exámenes solicitados
    /// como pendientes (con versión anterior y revisión + 1);</item>
    /// <item>la cita vinculada pasa a "completada" si estaba programada o confirmada.</item>
    /// </list>
    /// Si algo falla no queda nada a medias. 201 con <c>{ encounter, record, appointmentCompleted, warnings }</c>
    /// (<c>record</c> es null si la historia no cambió). Reintentar con el mismo id: 200 con lo ya registrado.
    /// </summary>
    [HttpPost("patients/{patientId:guid}/encounters/register")]
    [RequestSizeLimit(5 * 1024 * 1024)]
    public async Task<ActionResult<RegisterEncounterResultDto>> Register(Guid patientId, CreateEncounterRequest request, CancellationToken cancellationToken)
    {
        var id = request.Id!.Value;
        var patient = await db.Patients.AsNoTracking().Where(entry => entry.Id == patientId).Select(entry => new { entry.DeletedAt }).FirstOrDefaultAsync(cancellationToken);
        if (patient is null) return Problem(statusCode: StatusCodes.Status404NotFound, title: "Paciente no encontrado");

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        await db.Database.ExecuteSqlAsync($"SELECT pg_advisory_xact_lock(hashtext({"encounter:" + id}))", cancellationToken);

        var existing = await db.ClinicalEncounters.AsNoTracking().Include(encounter => encounter.Addenda)
            .FirstOrDefaultAsync(encounter => encounter.Id == id, cancellationToken);
        if (existing is not null)
        {
            if (existing.PatientId != patientId) return this.FieldConflict("id", "Ese identificador ya pertenece a una atención de otro paciente");
            var current = await loader.LoadAsync(patientId, cancellationToken);
            return Ok(new RegisterEncounterResultDto(ClinicalEncounterDto.FromEntity(existing), current.Record, false, []));
        }

        if (patient.DeletedAt is not null) return Problem(statusCode: StatusCodes.Status409Conflict, title: "Reactiva al paciente antes de registrar una atención");

        await ValidateReferencesAsync(patientId, request, cancellationToken);
        var treatments = await ValidatePerformedAsync(patientId, request, cancellationToken);
        if (!ModelState.IsValid) return this.ValidationError(ModelState);

        if (request.AppointmentId is { } linkedAppointment
            && await db.ClinicalEncounters.AnyAsync(encounter => encounter.AppointmentId == linkedAppointment, cancellationToken))
        {
            return this.FieldConflict("appointmentId", "La cita ya está vinculada a otra atención");
        }

        var date = Validation.ParseDate(request.Date)!.Value;
        var userId = User.GetUserId();
        var now = clock.UtcNow;

        // 1. Tratamientos realizados (y su consumo de insumos).
        for (var index = 0; index < request.PerformedTreatments.Count; index++)
        {
            var item = request.PerformedTreatments[index];
            if (!string.IsNullOrWhiteSpace(item.AssignmentId) || item.TreatmentId is not { } treatmentId) continue;

            var sourceKey = $"{id}:{item.Id}";
            await db.Database.ExecuteSqlAsync($"SELECT pg_advisory_xact_lock(hashtext({"assignment:" + sourceKey}))", cancellationToken);
            var previous = await db.TreatmentAssignments.AsNoTracking().FirstOrDefaultAsync(entry => entry.SourceKey == sourceKey, cancellationToken);
            if (previous is not null)
            {
                // Un intento anterior por el flujo de pasos ya lo registró: se reutiliza sin volver a descontar.
                if (previous.PatientId != patientId || previous.TreatmentId != treatmentId)
                    return this.FieldConflict($"performedTreatments[{index}].treatmentId", "Esta atención ya registró ese tratamiento para otro paciente o tratamiento");
                item.AssignmentId = previous.Id.ToString();
                continue;
            }

            var treatment = treatments[treatmentId];
            var assignment = new TreatmentAssignment
            {
                Id = Guid.CreateVersion7(),
                TreatmentId = treatmentId,
                PatientId = patientId,
                TotalSessions = 1,
                CompletedSessions = 1,
                Status = AssignmentStatuses.Completado,
                StartDate = date,
                Tooth = item.Tooth.Trim(),
                SourceEncounterId = id,
                SourceKey = sourceKey,
                Price = item.Cost,
                ProfessionalId = request.ProfessionalId,
                CreatedAt = now,
                CreatedByUserId = userId,
            };
            db.TreatmentAssignments.Add(assignment);
            item.AssignmentId = assignment.Id.ToString();

            if (treatment.Consumption.Count > 0)
            {
                var items = await stock.LockItemsAsync(treatment.Consumption.Select(line => line.ItemId).ToList(), cancellationToken);
                var info = new MovementInfo($"Tratamiento realizado: {treatment.Name}", userId, TreatmentAssignmentId: assignment.Id, PatientId: patientId);
                foreach (var line in treatment.Consumption)
                    await stock.ConsumeAsync(items.First(entry => entry.Id == line.ItemId), line.Quantity, info, cancellationToken);
            }
        }

        // 2. La atención.
        var created = ToEntity(patientId, request);
        db.ClinicalEncounters.Add(created);

        // 3. La historia: sin los propuestos registrados y con los exámenes solicitados como pendientes.
        await db.Database.ExecuteSqlAsync($"SELECT pg_advisory_xact_lock(hashtext({"clinical-record:" + patientId}))", cancellationToken);
        var record = await db.ClinicalRecords.FirstOrDefaultAsync(entry => entry.PatientId == patientId, cancellationToken);
        var usedIds = request.PerformedTreatments.Select(item => item.Id).ToHashSet();
        var knownExams = record?.ExamRequests.Select(exam => exam.Id).ToHashSet() ?? [];
        var newExams = request.RequestedExams.Where(exam => !knownExams.Contains(exam.Id)).Select(exam => new ExamRequest
        {
            Id = exam.Id, Kind = exam.Kind, Detail = exam.Detail, Status = "pendiente", EncounterId = id.ToString(),
            RequestedAt = request.Date, AttachmentId = null, ReceivedAt = null,
        }).ToList();
        var recordChanged = (record?.Plan.Any(item => usedIds.Contains(item.Id)) ?? false) || newExams.Count > 0;
        if (recordChanged)
        {
            if (record is null)
            {
                record = new ClinicalRecord { PatientId = patientId, Revision = 0, CreatedAt = now };
                db.ClinicalRecords.Add(record);
            }
            else
            {
                var attachments = await loader.Attachments(patientId).AsNoTracking().AsSplitQuery().ToListAsync(cancellationToken);
                db.ClinicalRecordVersions.Add(new ClinicalRecordVersion
                {
                    Id = Guid.CreateVersion7(), PatientId = patientId, Revision = record.Revision,
                    Data = System.Text.Json.JsonSerializer.SerializeToElement(ClinicalRecordDto.FromEntity(record, attachments), JsonbConversion.Options),
                    SavedByUserId = record.UpdatedByUserId, SavedAt = record.UpdatedAt,
                });
            }
            record.Plan = record.Plan.Where(item => !usedIds.Contains(item.Id)).ToList();
            record.ExamRequests = [.. record.ExamRequests, .. newExams];
            record.Revision += 1;
            record.UpdatedAt = now;
            record.UpdatedByUserId = userId;
        }

        // 4. La cita vinculada.
        var warnings = new List<string>();
        var appointmentCompleted = false;
        if (request.AppointmentId is { } appointmentId)
        {
            var appointment = await db.Appointments.FirstAsync(entry => entry.Id == appointmentId, cancellationToken);
            if (appointment.Status is Appointments.AppointmentStatuses.Programada or Appointments.AppointmentStatuses.Confirmada)
            {
                appointment.Status = Appointments.AppointmentStatuses.Completada;
                appointment.StatusChangedAt = now;
                appointment.StatusChangedByUserId = userId;
                appointmentCompleted = true;
            }
            else if (appointment.Status is Appointments.AppointmentStatuses.Cancelada or Appointments.AppointmentStatuses.NoAsistio)
            {
                warnings.Add("La cita vinculada está cancelada o marcada como no asistida; no se cambió su estado.");
            }
        }

        try
        {
            await db.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
        }
        catch (DbUpdateException exception) when (exception.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            return this.FieldConflict("appointmentId", "La cita ya está vinculada a otra atención");
        }

        var savedRecord = recordChanged ? (await loader.LoadAsync(patientId, cancellationToken)).Record : null;
        return StatusCode(StatusCodes.Status201Created,
            new RegisterEncounterResultDto(ClinicalEncounterDto.FromEntity(created), savedRecord, appointmentCompleted, warnings));
    }

    /// <summary>
    /// Tratamientos realizados del registro: los que se van a registrar deben estar activos; los que ya traen
    /// <c>assignmentId</c>, ser tratamientos realizados de este paciente. Devuelve los tratamientos con sus insumos.
    /// </summary>
    private async Task<Dictionary<Guid, Treatment>> ValidatePerformedAsync(Guid patientId, CreateEncounterRequest request, CancellationToken cancellationToken)
    {
        var ids = request.PerformedTreatments.Select(item => item.TreatmentId).OfType<Guid>().Distinct().ToList();
        var treatments = ids.Count == 0
            ? []
            : await db.Treatments.AsNoTracking().Include(treatment => treatment.Consumption)
                .Where(treatment => ids.Contains(treatment.Id)).ToDictionaryAsync(treatment => treatment.Id, cancellationToken);

        for (var index = 0; index < request.PerformedTreatments.Count; index++)
        {
            var item = request.PerformedTreatments[index];
            if (!string.IsNullOrWhiteSpace(item.AssignmentId))
            {
                var owned = Guid.TryParse(item.AssignmentId, out var assignmentId)
                    && await db.TreatmentAssignments.AnyAsync(entry => entry.Id == assignmentId && entry.PatientId == patientId, cancellationToken);
                if (!owned) ModelState.AddModelError($"performedTreatments[{index}].assignmentId", "El tratamiento realizado no es de este paciente");
            }
            else if (item.TreatmentId is { } treatmentId && treatments.TryGetValue(treatmentId, out var treatment) && !treatment.Active)
            {
                ModelState.AddModelError($"performedTreatments[{index}].treatmentId", $"El tratamiento \"{treatment.Name}\" está inactivo");
            }
        }
        return treatments;
    }

    /// <summary>POST /api/clinical-history/encounters/{encounterId}/notes → 201. El autor sale de la sesión.</summary>
    [HttpPost("encounters/{encounterId:guid}/notes")]
    public async Task<ActionResult<EncounterNoteDto>> AddNote(Guid encounterId, AddNoteRequest request, CancellationToken cancellationToken)
    {
        if (!await db.ClinicalEncounters.AnyAsync(encounter => encounter.Id == encounterId, cancellationToken))
            return Problem(statusCode: StatusCodes.Status404NotFound, title: "Atención no encontrada");

        var text = request.Text.Trim();
        if (text.Length < 10)
        {
            ModelState.AddModelError("text", "Escribe la nota (mínimo 10 caracteres)");
            return this.ValidationError(ModelState, "La nota debe tener al menos 10 caracteres");
        }

        var userId = User.GetUserId();
        var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(entry => entry.Id == userId, cancellationToken);
        var authorName = user?.Profile?.FullName is { Length: > 0 } fullName ? fullName : user?.Name ?? User.Identity?.Name ?? "Usuario";

        var note = new EncounterNote
        {
            Id = Guid.CreateVersion7(),
            EncounterId = encounterId,
            Text = text,
            AuthorUserId = userId,
            AuthorName = authorName.Length <= 120 ? authorName : authorName[..120],
            CreatedAt = clock.UtcNow,
        };
        db.EncounterNotes.Add(note);
        await db.SaveChangesAsync(cancellationToken);

        return StatusCode(StatusCodes.Status201Created, EncounterNoteDto.FromEntity(note));
    }

    /// <summary>Profesional activo, cita del paciente y tratamientos del catálogo.</summary>
    private async Task ValidateReferencesAsync(Guid patientId, CreateEncounterRequest request, CancellationToken cancellationToken)
    {
        var professionalActive = await db.Professionals.Where(professional => professional.Id == request.ProfessionalId)
            .Select(professional => (bool?)professional.Active).FirstOrDefaultAsync(cancellationToken);
        if (professionalActive is null) ModelState.AddModelError("professionalId", "El profesional no existe");
        else if (professionalActive == false) ModelState.AddModelError("professionalId", "El profesional está inactivo");

        if (request.AppointmentId is { } appointmentId)
        {
            var appointmentPatient = await db.Appointments.Where(appointment => appointment.Id == appointmentId)
                .Select(appointment => (Guid?)appointment.PatientId).FirstOrDefaultAsync(cancellationToken);
            if (appointmentPatient is null) ModelState.AddModelError("appointmentId", "La cita no existe");
            else if (appointmentPatient != patientId) ModelState.AddModelError("appointmentId", "La cita es de otro paciente");
        }

        var treatmentIds = request.PerformedTreatments.Select(item => item.TreatmentId).OfType<Guid>().Distinct().ToList();
        var existing = treatmentIds.Count == 0
            ? []
            : await db.Treatments.Where(treatment => treatmentIds.Contains(treatment.Id)).Select(treatment => treatment.Id).ToListAsync(cancellationToken);
        for (var index = 0; index < request.PerformedTreatments.Count; index++)
        {
            if (request.PerformedTreatments[index].TreatmentId is { } treatmentId && !existing.Contains(treatmentId))
                ModelState.AddModelError($"performedTreatments[{index}].treatmentId", "El tratamiento no existe en el catálogo");
        }
    }

    private ClinicalEncounter ToEntity(Guid patientId, CreateEncounterRequest request)
    {
        foreach (var item in request.PerformedTreatments.Where(item => item.TreatmentId is not null)) item.Description = "";

        return new ClinicalEncounter
        {
            Id = request.Id!.Value,
            PatientId = patientId,
            Date = Validation.ParseDate(request.Date)!.Value,
            ProfessionalId = request.ProfessionalId!.Value,
            AppointmentId = request.AppointmentId,
            Reason = request.Reason.Trim(),
            PresentIllness = request.PresentIllness.Trim(),
            Vitals = request.Vitals,
            Asa = request.Asa,
            RiskAssessment = request.RiskAssessment.Distinct().ToList(),
            ExtraoralExam = ExamSections.Normalize(request.ExtraoralExam, ClinicalHistoryKeys.Extraoral),
            IntraoralExam = ExamSections.Normalize(request.IntraoralExam, ClinicalHistoryKeys.Intraoral),
            Pain = request.Pain,
            CariesRisk = request.CariesRisk,
            PeriodontalRisk = request.PeriodontalRisk,
            Diagnoses = request.Diagnoses,
            DiagnosisSummary = string.Join(" · ", request.Diagnoses.Select(item => item.Description.Trim()).Where(text => text.Length > 0)),
            Prognosis = request.Prognosis,
            PeriodontalDiagnosis = request.PeriodontalDiagnosis,
            MaintenanceInterval = request.MaintenanceInterval,
            Procedures = request.Procedures.Trim(),
            Materials = request.Materials.Trim(),
            RequestedExams = request.RequestedExams,
            ExamFindings = request.ExamFindings.Trim(),
            Evolution = request.Evolution.Trim(),
            Notes = request.Notes.Trim(),
            NextVisit = Validation.ParseDate(request.NextVisit),
            PerformedTreatments = request.PerformedTreatments,
            ChartSnapshot = request.ChartSnapshot is { ValueKind: System.Text.Json.JsonValueKind.Object } chart ? chart : null,
            ClinicalSnapshot = request.ClinicalSnapshot,
            CreatedByUserId = User.GetUserId(),
            CreatedAt = clock.UtcNow,
        };
    }
}
