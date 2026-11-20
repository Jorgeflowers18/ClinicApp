using System.ComponentModel.DataAnnotations;
using System.Globalization;
using System.Text;
using ClinicApp.Api.Common;
using Microsoft.AspNetCore.Mvc;

namespace ClinicApp.Api.Modules.ClinicalHistory;

/// <summary>Valores del archivo clínico digital (los mismos de <c>archive/lib/classification.ts</c> del frontend).</summary>
public static class ArchiveKeys
{
    /// <summary>Tipos clínicos: los tipos de adjunto de la historia más los propios del archivo.</summary>
    public static readonly string[] ClinicalTypes =
        [.. ClinicalHistoryKeys.AttachmentKinds, "radiografia_cefalometrica", "examen_complementario", "informe_medico", "documento_clinico"];

    public static readonly string[] Colors = ["neutral", "cyan", "violet", "amber", "green"];

    public const string Attach = "adjuntar";
    public const string Edit = "editar";
    public const string Archive = "archivar";
    public const string Restore = "restaurar";

    /// <summary>Campos del borrador, en el orden del frontend (los usa la auditoría de "adjuntar").</summary>
    public static readonly string[] DraftFields =
        ["displayName", "clinicalType", "studyDate", "categoryId", "tagIds", "professionalId", "encounterId", "treatmentId", "examRequestId", "zone", "notes"];

    /// <summary>Tipo de adjunto de la historia que corresponde a un tipo clínico (los nuevos quedan como "otro").</summary>
    public static string LegacyKind(string clinicalType) =>
        ClinicalHistoryKeys.AttachmentKinds.Contains(clinicalType) ? clinicalType : "otro";

    /// <summary>Texto comparable sin tildes, espacios repetidos ni mayúsculas (nombres de categorías y etiquetas).</summary>
    public static string Comparable(string text)
    {
        var decomposed = text.Trim().Normalize(NormalizationForm.FormD);
        var builder = new StringBuilder(decomposed.Length);
        foreach (var character in decomposed)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(character) != UnicodeCategory.NonSpacingMark) builder.Append(character);
        }
        return CollapseSpaces(builder.ToString()).ToLowerInvariant();
    }

    public static string CollapseSpaces(string text) => string.Join(' ', text.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries));
}

public record ArchiveActorDto(string Id, string Name);

public record ArchiveAuditDto(string Action, DateTime At, ArchiveActorDto Actor, List<string> Fields);

/// <summary>Metadatos del archivo (<c>ClinicalFileMetadata</c> del frontend). <c>treatmentId</c> es un tratamiento realizado.</summary>
public record ClinicalFileMetadataDto(
    int Version, string DisplayName, string ClinicalType, string? StudyDate, Guid? CategoryId, List<Guid> TagIds,
    Guid? ProfessionalId, Guid? EncounterId, Guid? TreatmentId, string? ExamRequestId, string Zone, string Notes,
    string? Digest, ArchiveActorDto? UploadedBy, DateTime? UpdatedAt, DateTime? ArchivedAt, List<ArchiveAuditDto> Audit)
{
    public static ClinicalFileMetadataDto? FromEntity(ClinicalAttachment attachment)
    {
        if (attachment.MetadataVersion == 0) return null;

        var audit = attachment.Audit.OrderBy(entry => entry.At)
            .Select(entry => new ArchiveAuditDto(entry.Action, entry.At, new ArchiveActorDto(entry.ActorUserId?.ToString() ?? "", entry.ActorName), entry.Fields))
            .ToList();
        var uploadedBy = audit.FirstOrDefault(entry => entry.Action == ArchiveKeys.Attach)?.Actor;

        return new ClinicalFileMetadataDto(
            attachment.MetadataVersion, attachment.DisplayName, attachment.ClinicalType,
            attachment.StudyDate?.ToString(IsoDateAttribute.Format), attachment.CategoryId,
            attachment.Tags.OrderBy(tag => tag.Position).Select(tag => tag.TagId).ToList(),
            attachment.ProfessionalId, attachment.EncounterId, attachment.TreatmentAssignmentId, attachment.ExamRequestId,
            attachment.Zone, attachment.Notes, attachment.Digest, uploadedBy, attachment.MetadataUpdatedAt, attachment.ArchivedAt, audit);
    }
}

public record ArchiveCategoryDto(Guid Id, string Name, string Description, string Color, DateTime? ArchivedAt, int Version);

public record ArchiveTagDto(Guid Id, string Name, int Version);

/// <summary>
/// Catálogo del archivo clínico (<c>ArchiveCatalog</c> del frontend). <c>revision</c> sube con cada cambio del
/// catálogo (es la suma de las versiones: nada se borra, así que nunca baja).
/// </summary>
public record ArchiveCatalogDto(string Id, int Revision, List<ArchiveCategoryDto> Categories, List<ArchiveTagDto> Tags)
{
    public const string SingleId = "local-institution";
}

/// <summary>Crear o editar una categoría. Al editar, <c>version</c> es la que se leyó (409 si cambió).</summary>
public class ArchiveCategoryRequest
{
    [Required(ErrorMessage = "La categoría necesita un nombre de hasta 60 caracteres")]
    [MaxLength(60, ErrorMessage = "La categoría necesita un nombre de hasta 60 caracteres")]
    public string Name { get; set; } = "";

    [MaxLength(300, ErrorMessage = "La descripción admite hasta 300 caracteres")]
    public string? Description { get; set; }

    [Required(ErrorMessage = "Color de categoría no válido")]
    [AllowedValues("neutral", "cyan", "violet", "amber", "green", ErrorMessage = "Color de categoría no válido")]
    public string Color { get; set; } = "neutral";

    /// <summary>Con valor: archivar la categoría (el servidor pone la fecha). null: activa.</summary>
    public DateTime? ArchivedAt { get; set; }

    public int? Version { get; set; }
}

/// <summary>Crear o renombrar una etiqueta.</summary>
public class ArchiveTagRequest
{
    [Required(ErrorMessage = "La etiqueta necesita un nombre de hasta 40 caracteres")]
    [MaxLength(40, ErrorMessage = "La etiqueta necesita un nombre de hasta 40 caracteres")]
    public string Name { get; set; } = "";

    public int? Version { get; set; }
}

/// <summary>Metadatos de un archivo (<c>ClinicalFileDraft</c> del frontend). Lo comparten la subida y la edición.</summary>
public interface IClinicalFileDraft
{
    string DisplayName { get; }
    string ClinicalType { get; }
    string? StudyDate { get; }
    Guid? CategoryId { get; }
    List<Guid> TagIds { get; }
    Guid? ProfessionalId { get; }
    Guid? EncounterId { get; }
    Guid? TreatmentId { get; }
    string? ExamRequestId { get; }
    string? Zone { get; }
    string? Notes { get; }
}

/// <summary>Editar los metadatos (PATCH, JSON), con la <c>version</c> que se leyó.</summary>
public class ClinicalFileDraftRequest : IClinicalFileDraft
{
    public int Version { get; set; }

    [Required(ErrorMessage = "Escribe un nombre de hasta 200 caracteres")]
    [MaxLength(200, ErrorMessage = "Escribe un nombre de hasta 200 caracteres")]
    public string DisplayName { get; set; } = "";

    [Required(ErrorMessage = "Selecciona el tipo clínico del archivo")]
    public string ClinicalType { get; set; } = "";

    [IsoDate(ErrorMessage = "La fecha de estudio no es válida")]
    public string? StudyDate { get; set; }

    public Guid? CategoryId { get; set; }

    [MaxLength(30, ErrorMessage = "Máximo 30 etiquetas")]
    public List<Guid> TagIds { get; set; } = [];

    public Guid? ProfessionalId { get; set; }
    public Guid? EncounterId { get; set; }
    public Guid? TreatmentId { get; set; }

    [MaxLength(60, ErrorMessage = "Examen inválido")]
    public string? ExamRequestId { get; set; }

    [MaxLength(150, ErrorMessage = "La zona admite hasta 150 caracteres")]
    public string? Zone { get; set; }

    [MaxLength(3000, ErrorMessage = "Las notas admiten hasta 3000 caracteres")]
    public string? Notes { get; set; }
}

/// <summary>Adjuntar con metadatos (multipart): el archivo y los campos del borrador. <c>tagIds</c> se repite por etiqueta.</summary>
public class ClinicalFileUploadRequest : IClinicalFileDraft
{
    [Required(ErrorMessage = "Selecciona un archivo")]
    [FromForm(Name = "file")]
    public IFormFile? File { get; set; }

    [Required(ErrorMessage = "Escribe un nombre de hasta 200 caracteres")]
    [MaxLength(200, ErrorMessage = "Escribe un nombre de hasta 200 caracteres")]
    [FromForm(Name = "displayName")]
    public string DisplayName { get; set; } = "";

    [Required(ErrorMessage = "Selecciona el tipo clínico del archivo")]
    [FromForm(Name = "clinicalType")]
    public string ClinicalType { get; set; } = "";

    [IsoDate(ErrorMessage = "La fecha de estudio no es válida")]
    [FromForm(Name = "studyDate")]
    public string? StudyDate { get; set; }

    [FromForm(Name = "categoryId")]
    public Guid? CategoryId { get; set; }

    [MaxLength(30, ErrorMessage = "Máximo 30 etiquetas")]
    [FromForm(Name = "tagIds")]
    public List<Guid> TagIds { get; set; } = [];

    [FromForm(Name = "professionalId")]
    public Guid? ProfessionalId { get; set; }

    [FromForm(Name = "encounterId")]
    public Guid? EncounterId { get; set; }

    [FromForm(Name = "treatmentId")]
    public Guid? TreatmentId { get; set; }

    [MaxLength(60, ErrorMessage = "Examen inválido")]
    [FromForm(Name = "examRequestId")]
    public string? ExamRequestId { get; set; }

    [MaxLength(150, ErrorMessage = "La zona admite hasta 150 caracteres")]
    [FromForm(Name = "zone")]
    public string? Zone { get; set; }

    [MaxLength(3000, ErrorMessage = "Las notas admiten hasta 3000 caracteres")]
    [FromForm(Name = "notes")]
    public string? Notes { get; set; }
}

/// <summary>Archivar o restaurar, con la <c>version</c> que se leyó.</summary>
public class ClinicalFileVersionRequest
{
    public int Version { get; set; }
}
