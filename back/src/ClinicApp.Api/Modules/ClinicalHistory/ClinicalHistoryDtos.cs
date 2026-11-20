using System.ComponentModel.DataAnnotations;
using System.Text.Json;
using ClinicApp.Api.Common;

namespace ClinicApp.Api.Modules.ClinicalHistory;

/// <summary>Foto o documento: la forma de <c>DentalAttachment</c> del frontend.</summary>
/// <summary>
/// Adjunto (<c>DentalAttachment</c> del frontend). <c>archive</c> son los metadatos del archivo clínico digital,
/// o null si el archivo nunca se clasificó (adjuntos anteriores o subidos desde la historia).
/// Para que <c>archive</c> traiga etiquetas y auditoría, la consulta debe incluir <c>Tags</c> y <c>Audit</c>.
/// </summary>
public record DentalAttachmentDto(Guid Id, string Name, string Kind, string Mime, long Size, DateTime CreatedAt, ClinicalFileMetadataDto? Archive)
{
    public static DentalAttachmentDto FromEntity(ClinicalAttachment attachment) =>
        new(attachment.Id, attachment.Alias, attachment.Kind, attachment.Mime, attachment.Size, attachment.CreatedAt,
            ClinicalFileMetadataDto.FromEntity(attachment));
}

/// <summary>Historia clínica: la forma de <c>ClinicalRecord</c> del frontend.</summary>
public record ClinicalRecordDto(
    Guid PatientId,
    int Revision,
    JsonElement? Chart,
    MedicalBackground MedicalBackground,
    AllergiesAndMedication AllergiesAndMedication,
    Habits Habits,
    DentalBackground DentalBackground,
    PeriodontalBackground PeriodontalBackground,
    List<ProposedTreatment> Plan,
    DataConsent DataConsent,
    TruthDeclaration TruthDeclaration,
    List<DentalAttachmentDto> Attachments,
    List<ExamRequest> ExamRequests,
    DateTime CreatedAt,
    DateTime UpdatedAt)
{
    public static ClinicalRecordDto FromEntity(ClinicalRecord record, IEnumerable<ClinicalAttachment> attachments) => new(
        record.PatientId,
        record.Revision,
        record.Chart,
        record.MedicalBackground.Normalized(),
        record.AllergiesAndMedication,
        record.Habits,
        record.DentalBackground,
        record.PeriodontalBackground,
        record.Plan,
        record.DataConsent,
        record.TruthDeclaration,
        attachments.Where(attachment => attachment.IsInRecord).OrderBy(attachment => attachment.CreatedAt).Select(DentalAttachmentDto.FromEntity).ToList(),
        record.ExamRequests,
        record.CreatedAt,
        record.UpdatedAt);

    /// <summary>Historia vacía (revisión 0) para un paciente que todavía no tiene: no se guarda.</summary>
    public static ClinicalRecordDto Empty(Guid patientId, DateTime now) =>
        FromEntity(new ClinicalRecord { PatientId = patientId, CreatedAt = now, UpdatedAt = now }, []);
}

/// <summary>Una referencia del catálogo, resuelta para mostrar e imprimir.</summary>
public record TreatmentReference(string Name, string Category, bool Active);

public record ProfessionalReference(string Name, string Specialty, string RegistrationNumber, bool Active);

/// <summary>
/// Nombres de lo que la historia y sus atenciones nombran por id (tratamientos y profesionales),
/// calculados al leer y sin guardarse. Así la impresión muestra todo aunque esté inactivo.
/// </summary>
public record ClinicalReferences(
    Dictionary<Guid, TreatmentReference> Treatments,
    Dictionary<Guid, ProfessionalReference> Professionals);

/// <summary>GET /clinical-history/patients/:patientId</summary>
public record PatientClinicalHistoryDto(ClinicalRecordDto Record, List<ClinicalEncounterDto> Encounters, ClinicalReferences References);

/// <summary>Resultado de registrar la atención en una transacción (<c>RegisterEncounterResult</c> del frontend).</summary>
public record RegisterEncounterResultDto(ClinicalEncounterDto Encounter, ClinicalRecordDto? Record, bool AppointmentCompleted, List<string> Warnings);

/// <summary>Guardar la historia (PUT): la forma de <c>ClinicalRecord</c> que envía el frontend.</summary>
public class SaveRecordRequest
{
    /// <summary>La revisión que se leyó. 0 si el paciente todavía no tenía historia.</summary>
    [Range(0, int.MaxValue, ErrorMessage = "Revisión inválida")]
    public int Revision { get; set; }

    public JsonElement? Chart { get; set; }

    [Required(ErrorMessage = "Falta la sección")] public MedicalBackground MedicalBackground { get; set; } = MedicalBackground.Empty();
    [Required(ErrorMessage = "Falta la sección")] public AllergiesAndMedication AllergiesAndMedication { get; set; } = new();
    [Required(ErrorMessage = "Falta la sección")] public Habits Habits { get; set; } = new();
    [Required(ErrorMessage = "Falta la sección")] public DentalBackground DentalBackground { get; set; } = new();
    [Required(ErrorMessage = "Falta la sección")] public PeriodontalBackground PeriodontalBackground { get; set; } = new();

    [Required(ErrorMessage = "Falta la sección")]
    [MaxLength(200, ErrorMessage = "Máximo 200 tratamientos propuestos")]
    public List<ProposedTreatment> Plan { get; set; } = [];

    [Required(ErrorMessage = "Falta la sección")] public DataConsent DataConsent { get; set; } = new();
    [Required(ErrorMessage = "Falta la sección")] public TruthDeclaration TruthDeclaration { get; set; } = new();

    /// <summary>Adjuntos que quedan en la historia. Solo se usa el id; el resto sale de la tabla.</summary>
    [MaxLength(500, ErrorMessage = "Máximo 500 adjuntos")]
    public List<AttachmentReference> Attachments { get; set; } = [];

    [MaxLength(200, ErrorMessage = "Máximo 200 exámenes solicitados")]
    public List<ExamRequest> ExamRequests { get; set; } = [];
}

public class AttachmentReference
{
    [Required(ErrorMessage = "Adjunto inválido")]
    public Guid? Id { get; set; }
}

/// <summary>Atención: la forma de <c>ClinicalEncounter</c> del frontend.</summary>
public record ClinicalEncounterDto(
    Guid Id,
    Guid PatientId,
    string Date,
    Guid ProfessionalId,
    string? LegacyProfessionalName,
    Guid? AppointmentId,
    string Reason,
    string PresentIllness,
    Vitals Vitals,
    string Asa,
    List<string> RiskAssessment,
    Dictionary<string, ExamFinding> ExtraoralExam,
    Dictionary<string, ExamFinding> IntraoralExam,
    Pain Pain,
    RiskLevel CariesRisk,
    RiskLevel PeriodontalRisk,
    List<Diagnosis> Diagnoses,
    Prognosis Prognosis,
    PeriodontalDiagnosis PeriodontalDiagnosis,
    MaintenanceInterval MaintenanceInterval,
    string Procedures,
    string Materials,
    List<RequestedExam> RequestedExams,
    string ExamFindings,
    string Evolution,
    string Notes,
    string NextVisit,
    List<PerformedTreatment> PerformedTreatments,
    JsonElement? ChartSnapshot,
    ClinicalSnapshot? ClinicalSnapshot,
    List<EncounterNoteDto> Addenda,
    DateTime CreatedAt)
{
    public static ClinicalEncounterDto FromEntity(ClinicalEncounter encounter) => new(
        encounter.Id,
        encounter.PatientId,
        encounter.Date.ToString(IsoDateAttribute.Format),
        encounter.ProfessionalId,
        encounter.LegacyProfessionalName,
        encounter.AppointmentId,
        encounter.Reason,
        encounter.PresentIllness,
        encounter.Vitals,
        encounter.Asa,
        encounter.RiskAssessment,
        encounter.ExtraoralExam,
        encounter.IntraoralExam,
        encounter.Pain,
        encounter.CariesRisk,
        encounter.PeriodontalRisk,
        encounter.Diagnoses,
        encounter.Prognosis,
        encounter.PeriodontalDiagnosis,
        encounter.MaintenanceInterval,
        encounter.Procedures,
        encounter.Materials,
        encounter.RequestedExams,
        encounter.ExamFindings,
        encounter.Evolution,
        encounter.Notes,
        encounter.NextVisit?.ToString(IsoDateAttribute.Format) ?? "",
        encounter.PerformedTreatments,
        encounter.ChartSnapshot,
        encounter.ClinicalSnapshot,
        encounter.Addenda.OrderBy(note => note.CreatedAt).Select(EncounterNoteDto.FromEntity).ToList(),
        encounter.CreatedAt);
}

/// <summary>Una fila de la lista global de atenciones (<c>EncounterListItem</c>).</summary>
public record EncounterListItemDto(
    Guid Id, Guid PatientId, string Date, Guid ProfessionalId, string? LegacyProfessionalName, string Reason, List<Diagnosis> Diagnoses, string NextVisit);

/// <summary>Nota aclaratoria (<c>EncounterNote</c>).</summary>
public record EncounterNoteDto(Guid Id, string Text, string AuthorName, DateTime CreatedAt)
{
    public static EncounterNoteDto FromEntity(EncounterNote note) => new(note.Id, note.Text, note.AuthorName, note.CreatedAt);
}

public class AddNoteRequest
{
    [Required(ErrorMessage = "Escribe la nota (mínimo 10 caracteres)")]
    [MaxLength(4000, ErrorMessage = "Máximo 4000 caracteres")]
    public string Text { get; set; } = "";
}

/// <summary>Crear una atención: la forma de <c>CreateEncounterInput</c> (encounterFormSchema + id y copias).</summary>
public class CreateEncounterRequest : IValidatableObject
{
    [Required(ErrorMessage = "Falta el identificador de la atención")]
    public Guid? Id { get; set; }

    [Required(ErrorMessage = "La fecha es obligatoria")]
    [IsoDate]
    public string Date { get; set; } = "";

    [Required(ErrorMessage = "Selecciona un profesional")]
    public Guid? ProfessionalId { get; set; }

    public Guid? AppointmentId { get; set; }

    [MaxLength(500, ErrorMessage = "Máximo 500 caracteres")]
    public string Reason { get; set; } = "";

    [MaxLength(2000, ErrorMessage = "Máximo 2000 caracteres")]
    public string PresentIllness { get; set; } = "";

    [Required] public Vitals Vitals { get; set; } = new();
    public string Asa { get; set; } = "";
    public List<string> RiskAssessment { get; set; } = [];
    // ValidateNever: MVC nombraría los errores "extraoralExam[0].value.finding"; se validan en Validate()
    // para que salgan como "extraoralExam.atm.finding", el campo del formulario.
    [Microsoft.AspNetCore.Mvc.ModelBinding.Validation.ValidateNever]
    public Dictionary<string, ExamFinding> ExtraoralExam { get; set; } = [];
    [Microsoft.AspNetCore.Mvc.ModelBinding.Validation.ValidateNever]
    public Dictionary<string, ExamFinding> IntraoralExam { get; set; } = [];
    [Required] public Pain Pain { get; set; } = new();
    [Required] public RiskLevel CariesRisk { get; set; } = new();
    [Required] public RiskLevel PeriodontalRisk { get; set; } = new();

    [MaxLength(SectionRules.MaxListItems, ErrorMessage = "Máximo 50 diagnósticos")]
    public List<Diagnosis> Diagnoses { get; set; } = [];

    [Required] public Prognosis Prognosis { get; set; } = new();
    [Required] public PeriodontalDiagnosis PeriodontalDiagnosis { get; set; } = new();
    [Required] public MaintenanceInterval MaintenanceInterval { get; set; } = new();

    [MaxLength(4000, ErrorMessage = "Máximo 4000 caracteres")]
    public string Procedures { get; set; } = "";

    [MaxLength(1000, ErrorMessage = "Máximo 1000 caracteres")]
    public string Materials { get; set; } = "";

    [MaxLength(SectionRules.MaxListItems, ErrorMessage = "Máximo 50 exámenes")]
    public List<RequestedExam> RequestedExams { get; set; } = [];

    [MaxLength(1000, ErrorMessage = "Máximo 1000 caracteres")]
    public string ExamFindings { get; set; } = "";

    [MaxLength(4000, ErrorMessage = "Máximo 4000 caracteres")]
    public string Evolution { get; set; } = "";

    [MaxLength(4000, ErrorMessage = "Máximo 4000 caracteres")]
    public string Notes { get; set; } = "";

    public string NextVisit { get; set; } = "";

    [MaxLength(SectionRules.MaxListItems, ErrorMessage = "Máximo 50 tratamientos")]
    public List<PerformedTreatment> PerformedTreatments { get; set; } = [];

    public JsonElement? ChartSnapshot { get; set; }
    public ClinicalSnapshot? ClinicalSnapshot { get; set; }

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        var today = SectionRules.Today(validationContext);
        var date = Validation.ParseDate(Date);
        if (date > today) yield return SectionRules.Error("La fecha de la atención no puede ser futura", "date");

        if (!SectionRules.HasText(Reason, 3)) yield return SectionRules.Error("Describe el motivo de consulta", "reason");

        foreach (var error in SectionRules.ValidateOption(Asa, ClinicalHistoryKeys.Asa, "asa")) yield return error;
        foreach (var error in SectionRules.ValidateKeys(RiskAssessment, ClinicalHistoryKeys.Risks, "riskAssessment")) yield return error;

        foreach (var (field, message) in ExamSections.Findings(ExtraoralExam, "extraoralExam").Concat(ExamSections.Findings(IntraoralExam, "intraoralExam")))
            yield return SectionRules.Error(message, field);

        foreach (var (field, message) in ExamSections.UnknownKeys(ExtraoralExam, ClinicalHistoryKeys.Extraoral, "extraoralExam")
                     .Concat(ExamSections.UnknownKeys(IntraoralExam, ClinicalHistoryKeys.Intraoral, "intraoralExam")))
            yield return SectionRules.Error(message, field);

        if (Diagnoses.Count == 0) yield return SectionRules.Error("Registra al menos un diagnóstico", "diagnoses");
        foreach (var error in SectionRules.ValidateIds(Diagnoses.Select(item => item.Id), "diagnoses")) yield return error;
        foreach (var error in SectionRules.ValidateIds(RequestedExams.Select(item => item.Id), "requestedExams")) yield return error;
        foreach (var error in SectionRules.ValidateIds(PerformedTreatments.Select(item => item.Id), "performedTreatments")) yield return error;

        if (!SectionRules.IsDateOrEmpty(NextVisit)) yield return SectionRules.Error("Fecha inválida (formato AAAA-MM-DD)", "nextVisit");
        else if (Validation.ParseDate(NextVisit) is { } next && date is { } visit && next < visit)
            yield return SectionRules.Error("El próximo control debe ser igual o posterior a la fecha de la atención", "nextVisit");
    }
}

/// <summary>Subir un adjunto (multipart/form-data): file, kind, patientId.</summary>
public class UploadAttachmentRequest
{
    [Required(ErrorMessage = "Selecciona un archivo")]
    [Microsoft.AspNetCore.Mvc.FromForm(Name = "file")]
    public IFormFile? File { get; set; }

    [Required(ErrorMessage = "Selecciona el tipo de documento")]
    [Microsoft.AspNetCore.Mvc.FromForm(Name = "kind")]
    public string Kind { get; set; } = "";

    [Required(ErrorMessage = "Indica el paciente")]
    [Microsoft.AspNetCore.Mvc.FromForm(Name = "patientId")]
    public Guid? PatientId { get; set; }
}
