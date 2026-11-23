using ClinicApp.Api.Common;
using ClinicApp.Api.Data;
using ClinicApp.Api.Modules.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ClinicApp.Api.Modules.ClinicalHistory;

/// <summary>
/// Fotos y documentos de la historia clínica: /api/clinical-history/attachments. Solo admin y médico.
/// Subir solo guarda el archivo; la historia lo referencia cuando se guardan los cambios (PUT).
/// </summary>
[ApiController]
[Route("api/clinical-history/attachments")]
[Authorize(Roles = Roles.AdminYMedico)]
public class AttachmentsController(AppDbContext db, ClinicClock clock, AttachmentStorage storage, ILogger<AttachmentsController> logger) : ControllerBase
{
    private const long RequestLimit = AttachmentStorage.MaxSize + 1024 * 1024;

    /// <summary>POST (multipart: file, kind, patientId) → 201 con el DentalAttachment.</summary>
    [HttpPost]
    [RequestSizeLimit(RequestLimit)]
    [RequestFormLimits(MultipartBodyLengthLimit = RequestLimit)]
    public async Task<ActionResult<DentalAttachmentDto>> Upload([FromForm] UploadAttachmentRequest request, CancellationToken cancellationToken)
    {
        var file = request.File!;
        var alias = AttachmentStorage.CleanAlias(file.FileName);
        var invalidFile = $"{alias}: utiliza JPG, PNG, WebP o PDF de hasta 20 MB";

        if (!ClinicalHistoryKeys.AttachmentKinds.Contains(request.Kind)) ModelState.AddModelError("kind", "Tipo de documento inválido");
        if (!await db.Patients.AnyAsync(patient => patient.Id == request.PatientId, cancellationToken)) ModelState.AddModelError("patientId", "El paciente no existe");
        if (file.Length is 0 or > AttachmentStorage.MaxSize) ModelState.AddModelError("file", "Formato o tamaño no permitido");
        if (!ModelState.IsValid) return this.ValidationError(ModelState, ModelState.ContainsKey("file") ? invalidFile : Validation.Title);

        var id = Guid.CreateVersion7();
        await using var content = file.OpenReadStream();
        var saved = await storage.SaveAsync(request.PatientId!.Value, id, content, cancellationToken);
        if (saved is not { } stored)
        {
            ModelState.AddModelError("file", "Formato o tamaño no permitido");
            return this.ValidationError(ModelState, invalidFile);
        }

        var attachment = new ClinicalAttachment
        {
            Id = id,
            PatientId = request.PatientId!.Value,
            Alias = alias,
            Kind = request.Kind,
            Mime = stored.Mime,
            Size = file.Length,
            StoragePath = stored.StoragePath,
            Digest = await storage.DigestAsync(stored.StoragePath, cancellationToken),
            UploadedByUserId = User.GetUserId(),
            CreatedAt = clock.UtcNow,
        };
        db.ClinicalAttachments.Add(attachment);
        await db.SaveChangesAsync(cancellationToken);

        return StatusCode(StatusCodes.Status201Created, DentalAttachmentDto.FromEntity(attachment));
    }

    /// <summary>
    /// GET /{attachmentId}/file → el archivo, con su tipo y el alias como nombre de descarga.
    /// También funciona si se quitó de la historia (las versiones anteriores lo nombran).
    /// 410 si el protocolo de conservación lo borró.
    /// </summary>
    [HttpGet("{attachmentId:guid}/file")]
    public async Task<IActionResult> Download(Guid attachmentId, CancellationToken cancellationToken)
    {
        var attachment = await db.ClinicalAttachments.AsNoTracking().FirstOrDefaultAsync(entry => entry.Id == attachmentId, cancellationToken);
        if (attachment is null) return Problem(statusCode: StatusCodes.Status404NotFound, title: "Adjunto no encontrado");

        if (attachment.PurgedAt is not null)
        {
            return Problem(statusCode: StatusCodes.Status410Gone,
                title: $"Archivo eliminado por política de conservación el {clock.LocalDate(attachment.PurgedAt.Value):dd/MM/yyyy}");
        }

        if (!storage.Exists(attachment.StoragePath))
        {
            logger.LogError("Falta en disco el archivo del adjunto {AttachmentId} ({Path}).", attachment.Id, attachment.StoragePath);
            return Problem(statusCode: StatusCodes.Status404NotFound, title: "No se encontró el archivo del adjunto");
        }

        return PhysicalFile(storage.FullPath(attachment.StoragePath), attachment.Mime, attachment.Alias);
    }
}
