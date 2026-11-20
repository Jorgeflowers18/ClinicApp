using System.ComponentModel.DataAnnotations;
using static ClinicApp.Api.Modules.ClinicalHistory.SectionRules;

namespace ClinicApp.Api.Modules.ClinicalHistory;

// Secciones de la historia clínica (las que se mantienen entre visitas). Cada una se guarda en su propia
// columna jsonb y se recibe tal cual en PUT /clinical-history/patients/:patientId. Las reglas son las de
// background.types.ts y clinical-history.types.ts del frontend.

/// <summary>Antecedentes médicos personales y familiares.</summary>
public class MedicalBackground : IValidatableObject
{
    /// <summary>«Niega antecedentes relevantes»: excluyente con el resto.</summary>
    public bool Denies { get; set; }

    /// <summary>
    /// Las 19 claves de <see cref="ClinicalHistoryKeys.MedicalConditions"/>. ValidateNever: se valida en
    /// Validate(), para que los errores salgan como "conditions.otro.detail" (el campo del formulario).
    /// </summary>
    [Microsoft.AspNetCore.Mvc.ModelBinding.Validation.ValidateNever]
    public Dictionary<string, MedicalCondition> Conditions { get; set; } = [];

    public static MedicalBackground Empty() => new MedicalBackground().Normalized();

    /// <summary>Completa las claves que falten, vacías.</summary>
    public MedicalBackground Normalized()
    {
        foreach (var key in ClinicalHistoryKeys.MedicalConditions)
        {
            Conditions.TryAdd(key, new MedicalCondition());
        }
        return this;
    }

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        foreach (var key in Conditions.Keys.Where(key => !ClinicalHistoryKeys.MedicalConditions.Contains(key)))
            yield return Error("Antecedente desconocido", $"conditions.{key}");

        foreach (var (key, condition) in Conditions)
        {
            if (condition is null) yield return Error("Dato inválido", $"conditions.{key}");
            else if (condition.Detail.Length > 500) yield return Error("Máximo 500 caracteres", $"conditions.{key}.detail");
        }
        if (Conditions.Values.Any(condition => condition is null)) yield break;

        var marked = Conditions.Where(entry => entry.Value.IsMarked).Select(entry => entry.Key).ToList();
        if (Denies && marked.Count > 0)
            yield return Error("«Niega antecedentes relevantes» no se puede marcar junto con otros antecedentes", "denies");

        foreach (var key in ClinicalHistoryKeys.ConditionsWithDetail.Where(marked.Contains))
        {
            if (!HasText(Conditions[key].Detail, 3))
                yield return Error(key == "otro" ? "Describe el antecedente" : "Indica cuál y cuándo", $"conditions.{key}.detail");
        }
    }
}

public class MedicalCondition
{
    public bool Personal { get; set; }
    public bool Family { get; set; }

    [MaxLength(500, ErrorMessage = "Máximo 500 caracteres")]
    public string Detail { get; set; } = "";

    [System.Text.Json.Serialization.JsonIgnore]
    public bool IsMarked => Personal || Family;
}

/// <summary>Alergias, medicación actual y alertas médicas.</summary>
public class AllergiesAndMedication : IValidatableObject
{
    [MaxLength(MaxListItems, ErrorMessage = "Máximo 50 alergias")]
    public List<Allergy> Allergies { get; set; } = [];

    [MaxLength(MaxListItems, ErrorMessage = "Máximo 50 medicamentos")]
    public List<Medication> Medications { get; set; } = [];

    public List<string> Alerts { get; set; } = [];

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext) =>
        ValidateIds(Allergies.Select(item => item.Id), "allergies")
            .Concat(ValidateIds(Medications.Select(item => item.Id), "medications"))
            .Concat(ValidateKeys(Alerts, ClinicalHistoryKeys.MedicalAlerts, "alerts"))
            .Concat(Alerts.Count != Alerts.Distinct().Count() ? [Error("Alerta repetida", "alerts")] : []);
}

public class Allergy : IValidatableObject
{
    public string Id { get; set; } = "";
    public string Reaction { get; set; } = "";

    [MaxLength(200, ErrorMessage = "Máximo 200 caracteres")]
    public string Substance { get; set; } = "";

    [MaxLength(300, ErrorMessage = "Máximo 300 caracteres")]
    public string Manifestation { get; set; } = "";

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (!HasText(Reaction, 2)) yield return Error("Indica la alergia o reacción", "reaction");
        if (Reaction.Length > 200) yield return Error("Máximo 200 caracteres", "reaction");
    }
}

public class Medication : IValidatableObject
{
    public string Id { get; set; } = "";
    public string Name { get; set; } = "";

    [MaxLength(200, ErrorMessage = "Máximo 200 caracteres")]
    public string Dose { get; set; } = "";

    [MaxLength(300, ErrorMessage = "Máximo 300 caracteres")]
    public string Indication { get; set; } = "";

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (!HasText(Name, 2)) yield return Error("Indica el medicamento", "name");
        if (Name.Length > 200) yield return Error("Máximo 200 caracteres", "name");
    }
}

/// <summary>Hábitos y factores de riesgo.</summary>
public class Habits : IValidatableObject
{
    public HabitWithDetail Tobacco { get; set; } = new();
    public HabitWithDetail Alcohol { get; set; } = new();
    public Bruxism Bruxism { get; set; } = new();
    public HabitAnswer MouthBreathing { get; set; } = new();
    public Hygiene Hygiene { get; set; } = new();
    public HabitWithDetail CariogenicDiet { get; set; } = new();

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext) =>
        ValidateOption(Tobacco.Answer, ClinicalHistoryKeys.YesNo, "tobacco.answer")
            .Concat(ValidateOption(Alcohol.Answer, ClinicalHistoryKeys.YesNo, "alcohol.answer"))
            .Concat(ValidateOption(CariogenicDiet.Answer, ClinicalHistoryKeys.YesNo, "cariogenicDiet.answer"))
            .Concat(ValidateOption(Bruxism.Answer, ClinicalHistoryKeys.YesNo, "bruxism.answer"))
            .Concat(ValidateOption(Bruxism.Pattern, ClinicalHistoryKeys.BruxismPatterns, "bruxism.pattern"))
            .Concat(ValidateOption(MouthBreathing.Answer, ClinicalHistoryKeys.YesNo, "mouthBreathing.answer"))
            .Concat(ValidateOption(Hygiene.Answer, ClinicalHistoryKeys.YesNo, "hygiene.answer"))
            .Concat(ValidateOption(Hygiene.Quality, ClinicalHistoryKeys.HygieneQualities, "hygiene.quality"))
            .Concat(ValidateKeys(Hygiene.Aids, ClinicalHistoryKeys.HygieneAids, "hygiene.aids"));
}

public class HabitAnswer
{
    public string Answer { get; set; } = "";
}

public class HabitWithDetail : HabitAnswer
{
    [MaxLength(300, ErrorMessage = "Máximo 300 caracteres")]
    public string Detail { get; set; } = "";
}

public class Bruxism : HabitAnswer
{
    public string Pattern { get; set; } = "";
}

public class Hygiene : HabitAnswer
{
    public string Quality { get; set; } = "";

    [Range(0, 10, ErrorMessage = "Revisa el número de cepillados")]
    public int? BrushingPerDay { get; set; }

    public List<string> Aids { get; set; } = [];
}

/// <summary>Antecedentes odontológicos.</summary>
public class DentalBackground : IValidatableObject
{
    public List<string> Items { get; set; } = [];

    [MaxLength(1000, ErrorMessage = "Máximo 1000 caracteres")]
    public string Notes { get; set; } = "";

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext) =>
        ValidateKeys(Items, ClinicalHistoryKeys.DentalBackground, "items");
}

/// <summary>Antecedentes y síntomas periodontales.</summary>
public class PeriodontalBackground : IValidatableObject
{
    public List<string> Items { get; set; } = [];

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext) =>
        ValidateKeys(Items, ClinicalHistoryKeys.PeriodontalBackground, "items");
}

/// <summary>Tratamiento propuesto (un ítem del plan por fases).</summary>
public class ProposedTreatment : IValidatableObject
{
    public string Id { get; set; } = "";

    /// <summary>Tratamiento del catálogo. null solo en ítems de texto libre antiguos.</summary>
    public Guid? TreatmentId { get; set; }

    /// <summary>Solo se guarda en los ítems de texto libre (sin treatmentId); en los demás el nombre sale del catálogo.</summary>
    [MaxLength(300, ErrorMessage = "Máximo 300 caracteres")]
    public string Description { get; set; } = "";

    [MaxLength(60, ErrorMessage = "Máximo 60 caracteres")]
    public string Tooth { get; set; } = "";

    public string Phase { get; set; } = "";

    public string PlannedDate { get; set; } = "";

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        foreach (var error in ValidateOption(Phase, ClinicalHistoryKeys.TreatmentPhases, "phase")) yield return error;
        if (!IsDateOrEmpty(PlannedDate)) yield return Error("Fecha inválida (formato AAAA-MM-DD)", "plannedDate");
        if (TreatmentId is null && !HasText(Description, 2)) yield return Error("Describe el tratamiento", "description");
    }
}

/// <summary>Consentimiento de almacenamiento y tratamiento de datos.</summary>
public class DataConsent : IValidatableObject
{
    public string Status { get; set; } = "pendiente";
    public string Signer { get; set; } = "paciente";

    [MaxLength(120, ErrorMessage = "Máximo 120 caracteres")]
    public string SignerName { get; set; } = "";

    [MaxLength(20, ErrorMessage = "Máximo 20 caracteres")]
    public string SignerDocumentId { get; set; } = "";

    public string Date { get; set; } = "";

    /// <summary>Documento firmado (debe estar en los adjuntos de la historia).</summary>
    public string? AttachmentId { get; set; }

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        foreach (var error in ValidateOption(Status, ClinicalHistoryKeys.ConsentStatuses, "status")) yield return error;
        foreach (var error in ValidateOption(Signer, ClinicalHistoryKeys.Signers, "signer")) yield return error;
        if (Status == "pendiente") yield break;

        if (!HasText(SignerName, 3)) yield return Error("Indica el nombre de quien firma", "signerName");
        if (!HasText(SignerDocumentId, 5)) yield return Error("Indica la cédula de quien firma", "signerDocumentId");
        foreach (var error in SignedDate(Date, validationContext, "Indica la fecha de la decisión")) yield return error;
    }

    /// <summary>Fecha obligatoria, válida y no futura.</summary>
    internal static IEnumerable<ValidationResult> SignedDate(string date, ValidationContext context, string missing)
    {
        if (string.IsNullOrWhiteSpace(date)) yield return Error(missing, "date");
        else if (!IsDateOrEmpty(date)) yield return Error("Fecha inválida (formato AAAA-MM-DD)", "date");
        else if (ClinicApp.Api.Common.Validation.ParseDate(date) > Today(context)) yield return Error("La fecha no puede ser futura", "date");
    }
}

/// <summary>Declaración de veracidad del paciente.</summary>
public class TruthDeclaration : IValidatableObject
{
    public bool Accepted { get; set; }
    public string Signer { get; set; } = "paciente";

    [MaxLength(120, ErrorMessage = "Máximo 120 caracteres")]
    public string SignerName { get; set; } = "";

    [MaxLength(20, ErrorMessage = "Máximo 20 caracteres")]
    public string SignerDocumentId { get; set; } = "";

    public string Date { get; set; } = "";

    /// <summary>Profesional tratante ("" si no se eligió). Que exista lo revisa el controlador.</summary>
    [MaxLength(100, ErrorMessage = "Profesional inválido")]
    public string ProfessionalId { get; set; } = "";

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        foreach (var error in ValidateOption(Signer, ClinicalHistoryKeys.Signers, "signer")) yield return error;
        if (!Accepted) yield break;

        if (!HasText(SignerName, 3)) yield return Error("Indica el nombre del paciente o representante", "signerName");
        if (!HasText(SignerDocumentId, 5)) yield return Error("Indica la C.I.", "signerDocumentId");
        foreach (var error in DataConsent.SignedDate(Date, validationContext, "Indica la fecha")) yield return error;
    }
}

/// <summary>Examen solicitado en una atención, con su seguimiento (pendiente / recibido).</summary>
public class ExamRequest : IValidatableObject
{
    public string Id { get; set; } = "";
    public string Kind { get; set; } = "";

    [MaxLength(300, ErrorMessage = "Máximo 300 caracteres")]
    public string Detail { get; set; } = "";

    public string Status { get; set; } = "pendiente";

    /// <summary>Atención que lo solicitó (debe ser una atención del paciente).</summary>
    public string EncounterId { get; set; } = "";

    public string RequestedAt { get; set; } = "";

    /// <summary>Documento del resultado (debe estar en los adjuntos de la historia).</summary>
    public string? AttachmentId { get; set; }

    public string? ReceivedAt { get; set; }

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext) =>
        ValidateOption(Kind, ClinicalHistoryKeys.ExamKinds, "kind")
            .Concat(ValidateOption(Status, ClinicalHistoryKeys.ExamRequestStatuses, "status"))
            .Concat(string.IsNullOrWhiteSpace(EncounterId) ? [Error("Indica la atención que lo solicitó", "encounterId")] : []);
}
