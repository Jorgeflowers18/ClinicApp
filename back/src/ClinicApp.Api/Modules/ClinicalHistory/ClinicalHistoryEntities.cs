using System.Text.Json;

namespace ClinicApp.Api.Modules.ClinicalHistory;

/// <summary>
/// Historia clínica de un paciente (una por paciente): lo que se mantiene entre visitas. Tabla
/// <c>clinical_records</c>. Cada sección es una columna jsonb. Los adjuntos están en su propia tabla.
/// </summary>
public class ClinicalRecord
{
    public Guid PatientId { get; set; }

    /// <summary>Concurrencia optimista: cada guardado debe traer la revisión que leyó.</summary>
    public int Revision { get; set; }

    /// <summary>Odontograma y periodontograma tal como los exporta la librería ({ payload, summary }).</summary>
    public JsonElement? Chart { get; set; }

    public MedicalBackground MedicalBackground { get; set; } = MedicalBackground.Empty();
    public AllergiesAndMedication AllergiesAndMedication { get; set; } = new();
    public Habits Habits { get; set; } = new();
    public DentalBackground DentalBackground { get; set; } = new();
    public PeriodontalBackground PeriodontalBackground { get; set; } = new();
    public List<ProposedTreatment> Plan { get; set; } = [];
    public DataConsent DataConsent { get; set; } = new();
    public TruthDeclaration TruthDeclaration { get; set; } = new();
    public List<ExamRequest> ExamRequests { get; set; } = [];

    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public Guid? UpdatedByUserId { get; set; }
}

/// <summary>
/// Copia de una versión anterior de la historia ("fotocopia" antes de cada guardado). Tabla
/// <c>clinical_record_versions</c>. Nunca se modifica ni se borra.
/// </summary>
public class ClinicalRecordVersion
{
    public Guid Id { get; set; }
    public Guid PatientId { get; set; }

    /// <summary>Revisión que se reemplazó.</summary>
    public int Revision { get; set; }

    /// <summary>La historia completa en esa revisión, con la forma de la respuesta de la API.</summary>
    public JsonElement? Data { get; set; }

    /// <summary>Quién había guardado esa versión y cuándo.</summary>
    public Guid? SavedByUserId { get; set; }
    public DateTime SavedAt { get; set; }
}

/// <summary>
/// Atención (consulta) del paciente. Tabla <c>clinical_encounters</c>. Inmutable: solo se le agregan
/// notas aclaratorias.
/// </summary>
public class ClinicalEncounter
{
    /// <summary>Lo genera el frontend antes de registrar los tratamientos (idempotencia).</summary>
    public Guid Id { get; set; }
    public Guid PatientId { get; set; }
    public DateOnly Date { get; set; }
    public Guid ProfessionalId { get; set; }

    /// <summary>Solo para atenciones importadas con el nombre del profesional en texto libre.</summary>
    public string? LegacyProfessionalName { get; set; }

    public Guid? AppointmentId { get; set; }
    public string Reason { get; set; } = "";
    public string PresentIllness { get; set; } = "";
    public Vitals Vitals { get; set; } = new();
    public string Asa { get; set; } = "";
    public List<string> RiskAssessment { get; set; } = [];
    public Dictionary<string, ExamFinding> ExtraoralExam { get; set; } = [];
    public Dictionary<string, ExamFinding> IntraoralExam { get; set; } = [];
    public Pain Pain { get; set; } = new();
    public RiskLevel CariesRisk { get; set; } = new();
    public RiskLevel PeriodontalRisk { get; set; } = new();
    public List<Diagnosis> Diagnoses { get; set; } = [];

    /// <summary>Diagnósticos unidos por " · ", para buscar con ILIKE. No se expone.</summary>
    public string DiagnosisSummary { get; set; } = "";

    public Prognosis Prognosis { get; set; } = new();
    public PeriodontalDiagnosis PeriodontalDiagnosis { get; set; } = new();
    public MaintenanceInterval MaintenanceInterval { get; set; } = new();
    public string Procedures { get; set; } = "";
    public string Materials { get; set; } = "";
    public List<RequestedExam> RequestedExams { get; set; } = [];
    public string ExamFindings { get; set; } = "";
    public string Evolution { get; set; } = "";
    public string Notes { get; set; } = "";
    public DateOnly? NextVisit { get; set; }
    public List<PerformedTreatment> PerformedTreatments { get; set; } = [];
    public JsonElement? ChartSnapshot { get; set; }
    public ClinicalSnapshot? ClinicalSnapshot { get; set; }
    public Guid? CreatedByUserId { get; set; }
    public DateTime CreatedAt { get; set; }

    /// <summary>Notas aclaratorias ("addenda" en el frontend).</summary>
    public List<EncounterNote> Addenda { get; set; } = [];
}

/// <summary>Nota aclaratoria de una atención. Tabla <c>encounter_notes</c>. Inmutable.</summary>
public class EncounterNote
{
    public Guid Id { get; set; }
    public Guid EncounterId { get; set; }
    public string Text { get; set; } = "";
    public Guid? AuthorUserId { get; set; }

    /// <summary>Copia del nombre del autor al firmar.</summary>
    public string AuthorName { get; set; } = "";

    public DateTime CreatedAt { get; set; }
}

/// <summary>
/// Foto o documento de la historia. Tabla <c>clinical_attachments</c>. El archivo está en el disco del
/// servidor (<see cref="StoragePath"/>, relativo a <c>Attachments:RootPath</c>).
/// </summary>
public class ClinicalAttachment
{
    public Guid Id { get; set; }
    public Guid PatientId { get; set; }

    /// <summary>Nombre con que lo subió el usuario. Se muestra y se usa al descargar ("name" en la API).</summary>
    public string Alias { get; set; } = "";

    public string Kind { get; set; } = "";
    public string Mime { get; set; } = "";
    public long Size { get; set; }

    /// <summary>"{patientId}/{id}.{ext}": nombre generado por el servidor. No se expone.</summary>
    public string StoragePath { get; set; } = "";

    /// <summary>null = subido, pero todavía no está en una historia guardada (se borra a las 24 h).</summary>
    public DateTime? LinkedAt { get; set; }

    /// <summary>Se quitó de la historia: deja de aparecer, pero el archivo se conserva para las versiones anteriores.</summary>
    public DateTime? RemovedAt { get; set; }

    /// <summary>El protocolo de limpieza borró el archivo (apagado por defecto). La fila se conserva.</summary>
    public DateTime? PurgedAt { get; set; }

    public Guid? UploadedByUserId { get; set; }
    public DateTime CreatedAt { get; set; }

    // ── Archivo clínico digital (metadatos opcionales; ver ClinicalArchiveController) ──

    /// <summary>SHA-256 (hex) del archivo, calculado por el servidor. Detecta originales repetidos del paciente.</summary>
    public string? Digest { get; set; }

    /// <summary>0 = sin metadatos (adjunto anterior al archivo clínico). Sube con cada edición: concurrencia optimista.</summary>
    public int MetadataVersion { get; set; }

    public string DisplayName { get; set; } = "";
    public string ClinicalType { get; set; } = "";
    public DateOnly? StudyDate { get; set; }
    public Guid? CategoryId { get; set; }
    public Guid? ProfessionalId { get; set; }
    public Guid? EncounterId { get; set; }

    /// <summary>Tratamiento realizado (<c>treatment_assignments</c>) al que corresponde ("treatmentId" en la API).</summary>
    public Guid? TreatmentAssignmentId { get; set; }

    /// <summary>Examen solicitado de la historia (<c>examRequests[].id</c>) cuyo resultado es este archivo.</summary>
    public string? ExamRequestId { get; set; }

    public string Zone { get; set; } = "";
    public string Notes { get; set; } = "";
    public DateTime? MetadataUpdatedAt { get; set; }

    /// <summary>Archivado: sigue en la historia, pero la vista lo oculta por defecto. Se puede restaurar.</summary>
    public DateTime? ArchivedAt { get; set; }

    public List<ClinicalAttachmentTag> Tags { get; set; } = [];
    public List<ClinicalAttachmentAudit> Audit { get; set; } = [];

    public bool IsInRecord => LinkedAt is not null && RemovedAt is null;
}

/// <summary>Categoría del archivo clínico (catálogo de la clínica). Tabla <c>archive_categories</c>.</summary>
public class ArchiveCategory
{
    public Guid Id { get; set; }
    public string Name { get; set; } = "";
    public string Description { get; set; } = "";
    public string Color { get; set; } = "neutral";
    public DateTime? ArchivedAt { get; set; }
    public int Version { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

/// <summary>Etiqueta del archivo clínico. Tabla <c>archive_tags</c>.</summary>
public class ArchiveTag
{
    public Guid Id { get; set; }
    public string Name { get; set; } = "";
    public int Version { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

/// <summary>Etiquetas de cada adjunto. Tabla <c>clinical_attachment_tags</c>.</summary>
public class ClinicalAttachmentTag
{
    public Guid AttachmentId { get; set; }
    public Guid TagId { get; set; }

    /// <summary>Orden en que se eligieron (el frontend las muestra así).</summary>
    public int Position { get; set; }
}

/// <summary>Auditoría del archivo clínico: quién adjuntó, editó, archivó o restauró cada archivo. Tabla <c>clinical_attachment_audit</c>.</summary>
public class ClinicalAttachmentAudit
{
    public Guid Id { get; set; }
    public Guid AttachmentId { get; set; }

    /// <summary><c>adjuntar</c>, <c>editar</c>, <c>archivar</c> o <c>restaurar</c>.</summary>
    public string Action { get; set; } = "";

    /// <summary>Campos que cambiaron (nombres del JSON).</summary>
    public List<string> Fields { get; set; } = [];

    public Guid? ActorUserId { get; set; }

    /// <summary>Nombre del usuario en ese momento (se conserva aunque luego cambie).</summary>
    public string ActorName { get; set; } = "";

    public DateTime At { get; set; }
}
