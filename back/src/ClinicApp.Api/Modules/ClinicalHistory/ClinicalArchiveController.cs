using System.Security.Claims;
using System.Text.Json;
using ClinicApp.Api.Common;
using ClinicApp.Api.Data;
using ClinicApp.Api.Modules.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ClinicApp.Api.Modules.ClinicalHistory;

/// <summary>
/// Archivo clínico digital: metadatos de los archivos de la historia (nombre, tipo clínico, fecha de estudio,
/// categoría, etiquetas, vínculos), su archivado y auditoría, y el catálogo de categorías y etiquetas.
/// Solo admin y médico. Las operaciones sobre archivos devuelven la historia completa actualizada
/// (<c>{ record, encounters, references }</c>), como espera el frontend (<c>archive/api.ts</c>).
/// </summary>
[ApiController]
[Route("api/clinical-history")]
[Authorize(Roles = Roles.AdminYMedico)]
public class ClinicalArchiveController(
    AppDbContext db, ClinicClock clock, AttachmentStorage storage, ClinicalHistoryLoader loader, ILogger<ClinicalArchiveController> logger)
    : ControllerBase
{
    private const long RequestLimit = AttachmentStorage.MaxSize + 1024 * 1024;
    private const string CatalogLock = "archive-catalog";

    // ───────────────────────────── Catálogo ─────────────────────────────

    /// <summary>GET /api/clinical-history/archive/catalog → categorías y etiquetas.</summary>
    [HttpGet("archive/catalog")]
    public async Task<ArchiveCatalogDto> GetCatalog(CancellationToken cancellationToken) => await CatalogAsync(cancellationToken);

    /// <summary>POST archive/categories → el catálogo con la categoría nueva. 409 si ya existe ese nombre (sin tildes ni mayúsculas).</summary>
    [HttpPost("archive/categories")]
    public Task<ActionResult<ArchiveCatalogDto>> CreateCategory(ArchiveCategoryRequest request, CancellationToken cancellationToken) =>
        SaveCategoryAsync(null, request, cancellationToken);

    /// <summary>PUT archive/categories/{id} → el catálogo. 409 si la versión no es la guardada o el nombre ya existe.</summary>
    [HttpPut("archive/categories/{id:guid}")]
    public Task<ActionResult<ArchiveCatalogDto>> UpdateCategory(Guid id, ArchiveCategoryRequest request, CancellationToken cancellationToken) =>
        SaveCategoryAsync(id, request, cancellationToken);

    /// <summary>POST archive/tags → el catálogo. Si ya existe una etiqueta con ese nombre, no crea otra (200 sin cambios).</summary>
    [HttpPost("archive/tags")]
    public Task<ActionResult<ArchiveCatalogDto>> CreateTag(ArchiveTagRequest request, CancellationToken cancellationToken) =>
        SaveTagAsync(null, request, cancellationToken);

    /// <summary>PUT archive/tags/{id} → el catálogo. 409 si la versión no es la guardada o el nombre ya existe.</summary>
    [HttpPut("archive/tags/{id:guid}")]
    public Task<ActionResult<ArchiveCatalogDto>> UpdateTag(Guid id, ArchiveTagRequest request, CancellationToken cancellationToken) =>
        SaveTagAsync(id, request, cancellationToken);

    private async Task<ActionResult<ArchiveCatalogDto>> SaveCategoryAsync(Guid? id, ArchiveCategoryRequest request, CancellationToken cancellationToken)
    {
        var name = ArchiveKeys.CollapseSpaces(request.Name);
        if (name.Length == 0)
        {
            ModelState.AddModelError("name", "La categoría necesita un nombre de hasta 60 caracteres");
            return this.ValidationError(ModelState);
        }

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        await LockAsync(CatalogLock, cancellationToken);

        var categories = await db.ArchiveCategories.ToListAsync(cancellationToken);
        var existing = id is null ? null : categories.Find(category => category.Id == id);
        if (id is not null && existing is null) return Problem(statusCode: StatusCodes.Status404NotFound, title: "Categoría no encontrada");
        if (existing is not null && existing.Version != request.Version)
            return Problem(statusCode: StatusCodes.Status409Conflict, title: "La categoría cambió. Recarga el catálogo.");
        if (categories.Any(category => category.Id != id && ArchiveKeys.Comparable(category.Name) == ArchiveKeys.Comparable(name)))
            return this.FieldConflict("name", "Ya existe una categoría con ese nombre");

        var now = clock.UtcNow;
        var category = existing ?? new ArchiveCategory { Id = Guid.CreateVersion7(), CreatedAt = now };
        if (existing is null) db.ArchiveCategories.Add(category);
        category.Name = name;
        category.Description = Validation.Clean(request.Description);
        category.Color = request.Color;
        category.ArchivedAt = request.ArchivedAt is null ? null : category.ArchivedAt ?? now;
        category.Version += 1;
        category.UpdatedAt = now;

        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return await CatalogAsync(cancellationToken);
    }

    private async Task<ActionResult<ArchiveCatalogDto>> SaveTagAsync(Guid? id, ArchiveTagRequest request, CancellationToken cancellationToken)
    {
        var name = ArchiveKeys.CollapseSpaces(request.Name);
        if (name.Length == 0)
        {
            ModelState.AddModelError("name", "La etiqueta necesita un nombre de hasta 40 caracteres");
            return this.ValidationError(ModelState);
        }

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        await LockAsync(CatalogLock, cancellationToken);

        var tags = await db.ArchiveTags.ToListAsync(cancellationToken);
        var duplicate = tags.Find(tag => tag.Id != id && ArchiveKeys.Comparable(tag.Name) == ArchiveKeys.Comparable(name));
        if (duplicate is not null)
        {
            // Crear una que ya existe no es un error: el frontend reutiliza la existente.
            if (id is null) return await CatalogAsync(cancellationToken);
            return this.FieldConflict("name", "Ya existe esa etiqueta");
        }

        var existing = id is null ? null : tags.Find(tag => tag.Id == id);
        if (id is not null && existing is null) return Problem(statusCode: StatusCodes.Status404NotFound, title: "Etiqueta no encontrada");
        if (existing is not null && existing.Version != request.Version)
            return Problem(statusCode: StatusCodes.Status409Conflict, title: "La etiqueta cambió. Recarga el catálogo.");

        var now = clock.UtcNow;
        var tagEntity = existing ?? new ArchiveTag { Id = Guid.CreateVersion7(), CreatedAt = now };
        if (existing is null) db.ArchiveTags.Add(tagEntity);
        tagEntity.Name = name;
        tagEntity.Version += 1;
        tagEntity.UpdatedAt = now;

        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return await CatalogAsync(cancellationToken);
    }

    private async Task<ArchiveCatalogDto> CatalogAsync(CancellationToken cancellationToken)
    {
        var categories = await db.ArchiveCategories.AsNoTracking().OrderBy(category => category.CreatedAt).ToListAsync(cancellationToken);
        var tags = await db.ArchiveTags.AsNoTracking().OrderBy(tag => tag.CreatedAt).ToListAsync(cancellationToken);
        return new ArchiveCatalogDto(
            ArchiveCatalogDto.SingleId,
            categories.Sum(category => category.Version) + tags.Sum(tag => tag.Version),
            categories.Select(category => new ArchiveCategoryDto(category.Id, category.Name, category.Description, category.Color, category.ArchivedAt, category.Version)).ToList(),
            tags.Select(tag => new ArchiveTagDto(tag.Id, tag.Name, tag.Version)).ToList());
    }

    // ───────────────────────────── Archivos ─────────────────────────────

    /// <summary>
    /// POST /api/clinical-history/patients/{patientId}/archive/files (multipart: file + metadatos) → 201 con la historia.
    /// El archivo queda en la historia en el acto (no espera al PUT). Si se vincula a un examen solicitado, el examen pasa
    /// a "recibido". 409 si el mismo original (SHA-256) ya está en la historia del paciente, aunque esté archivado.
    /// </summary>
    [HttpPost("patients/{patientId:guid}/archive/files")]
    [RequestSizeLimit(RequestLimit)]
    [RequestFormLimits(MultipartBodyLengthLimit = RequestLimit)]
    public async Task<ActionResult<PatientClinicalHistoryDto>> Attach(Guid patientId, [FromForm] ClinicalFileUploadRequest request, CancellationToken cancellationToken)
    {
        var patient = await db.Patients.AsNoTracking().Where(entry => entry.Id == patientId).Select(entry => new { entry.DeletedAt }).FirstOrDefaultAsync(cancellationToken);
        if (patient is null) return Problem(statusCode: StatusCodes.Status404NotFound, title: "Paciente no encontrado");
        if (patient.DeletedAt is not null) return Problem(statusCode: StatusCodes.Status409Conflict, title: "Reactiva al paciente antes de editar su historia");

        var file = request.File!;
        var alias = AttachmentStorage.CleanAlias(file.FileName);
        var invalidFile = $"{alias}: utiliza JPG, PNG, WebP o PDF de hasta 20 MB";
        if (file.Length is 0 or > AttachmentStorage.MaxSize)
        {
            ModelState.AddModelError("file", "Formato o tamaño no permitido");
            return this.ValidationError(ModelState, invalidFile);
        }

        var record = await db.ClinicalRecords.AsNoTracking().FirstOrDefaultAsync(entry => entry.PatientId == patientId, cancellationToken);
        await ValidateDraftAsync(patientId, request, record, cancellationToken);
        if (!ModelState.IsValid) return this.ValidationError(ModelState);

        var id = Guid.CreateVersion7();
        await using (var content = file.OpenReadStream())
        {
            var saved = await storage.SaveAsync(patientId, id, content, cancellationToken);
            if (saved is not { } stored)
            {
                ModelState.AddModelError("file", "Formato o tamaño no permitido");
                return this.ValidationError(ModelState, invalidFile);
            }

            var digest = await storage.DigestAsync(stored.StoragePath, cancellationToken);
            var result = await AttachSavedAsync(patientId, id, alias, file.Length, stored, digest, request, cancellationToken);
            if (result is not null)
            {
                // No quedó en la base (duplicado o examen ya resuelto): el archivo en disco sobra.
                if (!storage.TryDelete(stored.StoragePath, out var error))
                    logger.LogWarning(error, "No se pudo borrar el archivo rechazado {Path}.", stored.StoragePath);
                return result;
            }
        }

        return StatusCode(StatusCodes.Status201Created, await loader.LoadAsync(patientId, cancellationToken));
    }

    /// <summary>Registra el archivo ya guardado en disco. Devuelve un error, o null si quedó registrado.</summary>
    private async Task<ActionResult?> AttachSavedAsync(
        Guid patientId, Guid id, string alias, long size, (string StoragePath, string Mime) stored, string digest,
        ClinicalFileUploadRequest request, CancellationToken cancellationToken)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        await LockAsync($"clinical-record:{patientId}", cancellationToken);

        if (await IsDuplicateAsync(patientId, size, digest, cancellationToken))
            return this.FieldConflict("file", "Este original ya está registrado para el paciente, incluso si está archivado");

        var now = clock.UtcNow;
        var attachment = new ClinicalAttachment
        {
            Id = id,
            PatientId = patientId,
            Alias = alias,
            Kind = ArchiveKeys.LegacyKind(request.ClinicalType),
            Mime = stored.Mime,
            Size = size,
            StoragePath = stored.StoragePath,
            Digest = digest,
            UploadedByUserId = User.GetUserId(),
            CreatedAt = now,
            LinkedAt = now,
            MetadataVersion = 1,
        };
        ApplyDraft(attachment, request, now);
        attachment.Audit.Add(AuditEntry(ArchiveKeys.Attach, [.. ArchiveKeys.DraftFields], now));
        db.ClinicalAttachments.Add(attachment);

        var record = await db.ClinicalRecords.FirstOrDefaultAsync(entry => entry.PatientId == patientId, cancellationToken);
        if (record is null)
        {
            record = new ClinicalRecord { PatientId = patientId, Revision = 0, CreatedAt = now };
            db.ClinicalRecords.Add(record);
        }
        else
        {
            await SnapshotAsync(record, cancellationToken);
        }

        if (request.ExamRequestId is { Length: > 0 } examId && LinkExam(record, examId, id) is { } conflict) return conflict;
        Touch(record, now);

        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return null;
    }

    /// <summary>
    /// PATCH /api/clinical-history/attachments/{id} (JSON: version + metadatos) → la historia.
    /// 409 si la versión no es la guardada. Un archivo ya vinculado a un examen no se reasigna a otro (400).
    /// Funciona también con los adjuntos anteriores al archivo clínico (versión 0).
    /// </summary>
    [HttpPatch("attachments/{id:guid}")]
    public async Task<ActionResult<PatientClinicalHistoryDto>> Edit(Guid id, ClinicalFileDraftRequest request, CancellationToken cancellationToken)
    {
        var located = await db.ClinicalAttachments.AsNoTracking().Where(entry => entry.Id == id)
            .Select(entry => new { entry.PatientId }).FirstOrDefaultAsync(cancellationToken);
        if (located is null) return FileNotFound();
        var patientId = located.PatientId;

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        await LockAsync($"clinical-record:{patientId}", cancellationToken);

        var attachment = await loader.Attachments(patientId).AsSplitQuery().FirstOrDefaultAsync(entry => entry.Id == id, cancellationToken);
        if (attachment is null || !attachment.IsInRecord) return FileNotFound();
        if (attachment.MetadataVersion != request.Version)
            return Problem(statusCode: StatusCodes.Status409Conflict, title: "El archivo cambió en otra pantalla. Recarga antes de editar.");

        var record = await db.ClinicalRecords.FirstOrDefaultAsync(entry => entry.PatientId == patientId, cancellationToken);
        await ValidateDraftAsync(patientId, request, record, cancellationToken);
        var newExam = string.IsNullOrWhiteSpace(request.ExamRequestId) ? null : request.ExamRequestId.Trim();
        if (attachment.ExamRequestId is { } previousExam && previousExam != newExam)
            ModelState.AddModelError("examRequestId", "El vínculo del resultado se conserva. No puede reasignarse desde los metadatos");
        if (!ModelState.IsValid) return this.ValidationError(ModelState);

        InitializeLegacy(attachment);
        var before = DraftOf(attachment);
        var now = clock.UtcNow;
        ApplyDraft(attachment, request, now);
        var changed = ArchiveKeys.DraftFields.Where(field => before[field] != DraftOf(attachment)[field]).ToList();
        attachment.MetadataVersion += 1;
        attachment.Audit.Add(AuditEntry(ArchiveKeys.Edit, changed, now));

        if (newExam is not null && attachment.ExamRequestId is not null && record is not null
            && record.ExamRequests.Any(exam => exam.Id == newExam && exam.AttachmentId != id.ToString()))
        {
            await SnapshotAsync(record, cancellationToken);
            if (LinkExam(record, newExam, id) is { } conflict) return conflict;
            Touch(record, now);
        }

        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return await loader.LoadAsync(patientId, cancellationToken);
    }

    /// <summary>POST attachments/{id}/archive { version } → la historia, con el archivo archivado (sigue en la historia).</summary>
    [HttpPost("attachments/{id:guid}/archive")]
    public Task<ActionResult<PatientClinicalHistoryDto>> Archive(Guid id, ClinicalFileVersionRequest request, CancellationToken cancellationToken) =>
        SetArchivedAsync(id, request.Version, archived: true, cancellationToken);

    /// <summary>POST attachments/{id}/restore { version } → la historia, con el archivo restaurado.</summary>
    [HttpPost("attachments/{id:guid}/restore")]
    public Task<ActionResult<PatientClinicalHistoryDto>> Restore(Guid id, ClinicalFileVersionRequest request, CancellationToken cancellationToken) =>
        SetArchivedAsync(id, request.Version, archived: false, cancellationToken);

    private async Task<ActionResult<PatientClinicalHistoryDto>> SetArchivedAsync(Guid id, int version, bool archived, CancellationToken cancellationToken)
    {
        var located = await db.ClinicalAttachments.AsNoTracking().Where(entry => entry.Id == id)
            .Select(entry => new { entry.PatientId }).FirstOrDefaultAsync(cancellationToken);
        if (located is null) return FileNotFound();

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        await LockAsync($"clinical-record:{located.PatientId}", cancellationToken);

        var attachment = await loader.Attachments(located.PatientId).AsSplitQuery().FirstOrDefaultAsync(entry => entry.Id == id, cancellationToken);
        if (attachment is null || !attachment.IsInRecord) return FileNotFound();
        if (attachment.MetadataVersion != version)
            return Problem(statusCode: StatusCodes.Status409Conflict, title: "El archivo cambió. Recarga antes de continuar.");

        var now = clock.UtcNow;
        InitializeLegacy(attachment);
        attachment.ArchivedAt = archived ? now : null;
        attachment.MetadataVersion += 1;
        attachment.MetadataUpdatedAt = now;
        attachment.Audit.Add(AuditEntry(archived ? ArchiveKeys.Archive : ArchiveKeys.Restore, ["archivedAt"], now));

        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return await loader.LoadAsync(located.PatientId, cancellationToken);
    }

    // ───────────────────────────── Reglas ─────────────────────────────

    /// <summary>Las reglas de <c>validateDraft</c> del frontend: tipo clínico y vínculos que deben ser del paciente.</summary>
    private async Task ValidateDraftAsync(Guid patientId, IClinicalFileDraft draft, ClinicalRecord? record, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(draft.DisplayName)) ModelState.AddModelError("displayName", "Escribe un nombre de hasta 200 caracteres");
        if (!ArchiveKeys.ClinicalTypes.Contains(draft.ClinicalType)) ModelState.AddModelError("clinicalType", "Selecciona el tipo clínico del archivo");

        if (draft.EncounterId is { } encounterId
            && !await db.ClinicalEncounters.AnyAsync(encounter => encounter.Id == encounterId && encounter.PatientId == patientId, cancellationToken))
            ModelState.AddModelError("encounterId", "La atención no pertenece a este paciente");

        if (draft.ExamRequestId is { Length: > 0 } examId && record?.ExamRequests.Any(exam => exam.Id == examId.Trim()) != true)
            ModelState.AddModelError("examRequestId", "El examen no pertenece a este paciente");

        if (draft.TreatmentId is { } assignmentId
            && !await db.TreatmentAssignments.AnyAsync(assignment => assignment.Id == assignmentId && assignment.PatientId == patientId, cancellationToken))
            ModelState.AddModelError("treatmentId", "El tratamiento no pertenece a este paciente");

        if (draft.ProfessionalId is { } professionalId && !await db.Professionals.AnyAsync(professional => professional.Id == professionalId, cancellationToken))
            ModelState.AddModelError("professionalId", "El profesional ya no está disponible");

        if (draft.CategoryId is { } categoryId && !await db.ArchiveCategories.AnyAsync(category => category.Id == categoryId, cancellationToken))
            ModelState.AddModelError("categoryId", "La categoría no está disponible");

        var tagIds = draft.TagIds.Distinct().ToList();
        if (tagIds.Count > 0 && await db.ArchiveTags.CountAsync(tag => tagIds.Contains(tag.Id), cancellationToken) != tagIds.Count)
            ModelState.AddModelError("tagIds", "Una etiqueta ya no está disponible");
    }

    /// <summary>
    /// ¿El mismo original ya está en la historia del paciente (también archivado)? A los adjuntos anteriores sin
    /// SHA-256 y del mismo tamaño se les calcula en el momento y se guarda.
    /// </summary>
    private async Task<bool> IsDuplicateAsync(Guid patientId, long size, string digest, CancellationToken cancellationToken)
    {
        var candidates = await db.ClinicalAttachments
            .Where(entry => entry.PatientId == patientId && entry.LinkedAt != null && entry.RemovedAt == null && entry.PurgedAt == null
                && (entry.Digest == digest || (entry.Digest == null && entry.Size == size)))
            .ToListAsync(cancellationToken);

        foreach (var legacy in candidates.Where(entry => entry.Digest is null))
        {
            if (!storage.Exists(legacy.StoragePath)) continue;
            legacy.Digest = await storage.DigestAsync(legacy.StoragePath, cancellationToken);
        }
        return candidates.Any(entry => entry.Digest == digest);
    }

    private static void ApplyDraft(ClinicalAttachment attachment, IClinicalFileDraft draft, DateTime now)
    {
        attachment.DisplayName = draft.DisplayName.Trim();
        attachment.ClinicalType = draft.ClinicalType;
        attachment.StudyDate = Validation.ParseDate(draft.StudyDate);
        attachment.CategoryId = draft.CategoryId;
        attachment.ProfessionalId = draft.ProfessionalId;
        attachment.EncounterId = draft.EncounterId;
        attachment.TreatmentAssignmentId = draft.TreatmentId;
        attachment.ExamRequestId = string.IsNullOrWhiteSpace(draft.ExamRequestId) ? null : draft.ExamRequestId.Trim();
        attachment.Zone = Validation.Clean(draft.Zone);
        attachment.Notes = Validation.Clean(draft.Notes);
        attachment.MetadataUpdatedAt = now;

        var wanted = draft.TagIds.Distinct().ToList();
        attachment.Tags.RemoveAll(tag => !wanted.Contains(tag.TagId));
        for (var index = 0; index < wanted.Count; index++)
        {
            var tag = attachment.Tags.Find(entry => entry.TagId == wanted[index]);
            if (tag is null) attachment.Tags.Add(new ClinicalAttachmentTag { AttachmentId = attachment.Id, TagId = wanted[index], Position = index });
            else tag.Position = index;
        }
    }

    /// <summary>Adjunto anterior al archivo clínico: sus metadatos parten del nombre y el tipo con que se subió.</summary>
    private static void InitializeLegacy(ClinicalAttachment attachment)
    {
        if (attachment.MetadataVersion > 0) return;
        if (attachment.DisplayName.Length == 0) attachment.DisplayName = attachment.Alias;
        if (attachment.ClinicalType.Length == 0) attachment.ClinicalType = attachment.Kind;
    }

    private static Dictionary<string, string> DraftOf(ClinicalAttachment attachment) => new()
    {
        ["displayName"] = attachment.DisplayName,
        ["clinicalType"] = attachment.ClinicalType,
        ["studyDate"] = attachment.StudyDate?.ToString(IsoDateAttribute.Format) ?? "",
        ["categoryId"] = attachment.CategoryId?.ToString() ?? "",
        ["tagIds"] = string.Join(',', attachment.Tags.OrderBy(tag => tag.Position).Select(tag => tag.TagId)),
        ["professionalId"] = attachment.ProfessionalId?.ToString() ?? "",
        ["encounterId"] = attachment.EncounterId?.ToString() ?? "",
        ["treatmentId"] = attachment.TreatmentAssignmentId?.ToString() ?? "",
        ["examRequestId"] = attachment.ExamRequestId ?? "",
        ["zone"] = attachment.Zone,
        ["notes"] = attachment.Notes,
    };

    /// <summary>Marca el examen como recibido con este archivo. 409 si ya tiene otro resultado.</summary>
    private ActionResult? LinkExam(ClinicalRecord record, string examId, Guid attachmentId)
    {
        var exams = record.ExamRequests.Select(exam => exam).ToList();
        var target = exams.Find(exam => exam.Id == examId);
        if (target is null) return null;
        if (target.AttachmentId is { Length: > 0 } current && current != attachmentId.ToString())
            return Problem(statusCode: StatusCodes.Status409Conflict, title: "Este examen ya tiene un resultado. Recarga antes de continuar.");

        target.Status = "recibido";
        target.AttachmentId = attachmentId.ToString();
        target.ReceivedAt ??= clock.Today.ToString(IsoDateAttribute.Format);
        record.ExamRequests = exams;
        return null;
    }

    /// <summary>Copia la versión actual de la historia antes de cambiarla (como el PUT).</summary>
    private async Task SnapshotAsync(ClinicalRecord record, CancellationToken cancellationToken)
    {
        var attachments = await loader.Attachments(record.PatientId).AsNoTracking().AsSplitQuery().ToListAsync(cancellationToken);
        db.ClinicalRecordVersions.Add(new ClinicalRecordVersion
        {
            Id = Guid.CreateVersion7(),
            PatientId = record.PatientId,
            Revision = record.Revision,
            Data = JsonSerializer.SerializeToElement(ClinicalRecordDto.FromEntity(record, attachments), JsonbConversion.Options),
            SavedByUserId = record.UpdatedByUserId,
            SavedAt = record.UpdatedAt,
        });
    }

    private void Touch(ClinicalRecord record, DateTime now)
    {
        record.Revision += 1;
        record.UpdatedAt = now;
        record.UpdatedByUserId = User.GetUserId();
    }

    private ClinicalAttachmentAudit AuditEntry(string action, List<string> fields, DateTime now) => new()
    {
        Id = Guid.CreateVersion7(),
        Action = action,
        Fields = fields,
        ActorUserId = User.GetUserId(),
        ActorName = User.FindFirstValue(AuthClaims.Name) ?? "",
        At = now,
    };

    private Task LockAsync(string key, CancellationToken cancellationToken) =>
        db.Database.ExecuteSqlAsync($"SELECT pg_advisory_xact_lock(hashtext({key}))", cancellationToken);

    private ObjectResult FileNotFound() => Problem(statusCode: StatusCodes.Status404NotFound, title: "Archivo no disponible para este paciente");
}
