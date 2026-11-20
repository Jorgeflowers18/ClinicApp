using System.ComponentModel.DataAnnotations;
using System.Text.RegularExpressions;
using static ClinicApp.Api.Modules.ClinicalHistory.SectionRules;

namespace ClinicApp.Api.Modules.ClinicalHistory;

// Secciones de una atención (lo que se registra en cada consulta). Reglas de encounter-assessment.types.ts
// y encounterFormSchema del frontend. Cada una se guarda en su propia columna jsonb.

/// <summary>Signos vitales. Todo opcional (null o "").</summary>
public partial class Vitals : IValidatableObject
{
    public string BloodPressure { get; set; } = "";

    [Range(30, 220, ErrorMessage = "Valor entre 30 y 220")]
    public int? HeartRate { get; set; }

    [Range(5, 60, ErrorMessage = "Valor entre 5 y 60")]
    public int? RespiratoryRate { get; set; }

    [Range(50, 100, ErrorMessage = "Valor entre 50 y 100")]
    public int? Spo2 { get; set; }

    [Range(34.0, 42.0, ErrorMessage = "Valor entre 34 y 42")]
    public decimal? Temperature { get; set; }

    [Range(1.0, 300.0, ErrorMessage = "Valor entre 1 y 300")]
    public decimal? Weight { get; set; }

    [Range(30.0, 250.0, ErrorMessage = "Valor entre 30 y 250")]
    public decimal? Height { get; set; }

    [GeneratedRegex(@"^\d{2,3}/\d{2,3}$")]
    private static partial Regex BloodPressurePattern();

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        var pressure = BloodPressure.Trim();
        if (pressure.Length > 0 && !BloodPressurePattern().IsMatch(pressure)) yield return Error("Formato 120/80", "bloodPressure");
    }
}

/// <summary>Una estructura del examen extraoral o intraoral.</summary>
public class ExamFinding : IValidatableObject
{
    public string Status { get; set; } = "no_evaluado";

    [MaxLength(500, ErrorMessage = "Máximo 500 caracteres")]
    public string Finding { get; set; } = "";

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        foreach (var error in ValidateOption(Status, ClinicalHistoryKeys.ExamStatuses, "status")) yield return error;
        if (Status == "alterado" && !HasText(Finding, 3)) yield return Error("Describe el hallazgo", "finding");
    }
}

/// <summary>Examen extraoral (6 estructuras) o intraoral (8). Las que falten quedan "no_evaluado".</summary>
public static class ExamSections
{
    public static Dictionary<string, ExamFinding> Normalize(Dictionary<string, ExamFinding>? exam, IEnumerable<string> keys)
    {
        var result = exam ?? [];
        foreach (var key in keys) result.TryAdd(key, new ExamFinding());
        return result;
    }

    public static IEnumerable<(string Field, string Message)> UnknownKeys(Dictionary<string, ExamFinding> exam, IReadOnlyCollection<string> keys, string section) =>
        exam.Keys.Where(key => !keys.Contains(key)).Select(key => ($"{section}.{key}", "Estructura desconocida"));

    /// <summary>Reglas de cada estructura (estado válido, hallazgo si está alterado, largo), con su ruta.</summary>
    public static IEnumerable<(string Field, string Message)> Findings(Dictionary<string, ExamFinding> exam, string section)
    {
        foreach (var (key, finding) in exam)
        {
            if (finding is null)
            {
                yield return ($"{section}.{key}", "Dato inválido");
                continue;
            }
            foreach (var error in finding.Validate(new ValidationContext(finding)))
                yield return ($"{section}.{key}.{error.MemberNames.First()}", error.ErrorMessage ?? "Dato inválido");
            if (finding.Finding.Length > 500)
                yield return ($"{section}.{key}.finding", "Máximo 500 caracteres");
        }
    }
}

public class Pain
{
    [Range(0, 10, ErrorMessage = "Valor entre 0 y 10")]
    public int? Scale { get; set; }

    [MaxLength(500, ErrorMessage = "Máximo 500 caracteres")]
    public string Location { get; set; } = "";

    [MaxLength(500, ErrorMessage = "Máximo 500 caracteres")]
    public string Character { get; set; } = "";
}

/// <summary>Riesgo de caries o periodontal.</summary>
public class RiskLevel : IValidatableObject
{
    public string Level { get; set; } = "";

    [MaxLength(500, ErrorMessage = "Máximo 500 caracteres")]
    public string Factors { get; set; } = "";

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext) =>
        ValidateOption(Level, ClinicalHistoryKeys.RiskLevels, "level");
}

public class Diagnosis : IValidatableObject
{
    public string Id { get; set; } = "";

    [MaxLength(500, ErrorMessage = "Máximo 500 caracteres")]
    public string Description { get; set; } = "";

    [MaxLength(60, ErrorMessage = "Máximo 60 caracteres")]
    public string Tooth { get; set; } = "";

    public string Priority { get; set; } = "";

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (!HasText(Description, 3)) yield return Error("Describe el diagnóstico", "description");
        foreach (var error in ValidateOption(Priority, ClinicalHistoryKeys.Priorities, "priority")) yield return error;
    }
}

public class Prognosis : IValidatableObject
{
    public string Level { get; set; } = "";

    [MaxLength(1000, ErrorMessage = "Máximo 1000 caracteres")]
    public string Notes { get; set; } = "";

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext) =>
        ValidateOption(Level, ClinicalHistoryKeys.Prognosis, "level");
}

/// <summary>Diagnóstico periodontal (clasificación 2017).</summary>
public class PeriodontalDiagnosis : IValidatableObject
{
    public string Gingival { get; set; } = "";
    public string Stage { get; set; } = "";
    public string Extent { get; set; } = "";
    public string Grade { get; set; } = "";
    public string Stability { get; set; } = "";
    public string PeriImplant { get; set; } = "";

    [MaxLength(500, ErrorMessage = "Máximo 500 caracteres")]
    public string Smoking { get; set; } = "";

    [MaxLength(500, ErrorMessage = "Máximo 500 caracteres")]
    public string Diabetes { get; set; } = "";

    [MaxLength(500, ErrorMessage = "Máximo 500 caracteres")]
    public string OtherFactors { get; set; } = "";

    [Range(0, 32, ErrorMessage = "Valor entre 0 y 32")]
    public int? TeethLostToPerio { get; set; }

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext) =>
        ValidateOption(Gingival, ClinicalHistoryKeys.Gingival, "gingival")
            .Concat(ValidateOption(Stage, ClinicalHistoryKeys.Stages, "stage"))
            .Concat(ValidateOption(Extent, ClinicalHistoryKeys.Extents, "extent"))
            .Concat(ValidateOption(Grade, ClinicalHistoryKeys.Grades, "grade"))
            .Concat(ValidateOption(Stability, ClinicalHistoryKeys.Stability, "stability"))
            .Concat(ValidateOption(PeriImplant, ClinicalHistoryKeys.PeriImplant, "periImplant"));
}

public class MaintenanceInterval : IValidatableObject
{
    public string Option { get; set; } = "";

    [MaxLength(100, ErrorMessage = "Máximo 100 caracteres")]
    public string Other { get; set; } = "";

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        foreach (var error in ValidateOption(Option, ClinicalHistoryKeys.Maintenance, "option")) yield return error;
        if (Option == "otro" && !HasText(Other, 2)) yield return Error("Indica el intervalo", "other");
    }
}

/// <summary>Examen complementario solicitado en la atención.</summary>
public class RequestedExam : IValidatableObject
{
    public string Id { get; set; } = "";
    public string Kind { get; set; } = "";

    [MaxLength(300, ErrorMessage = "Máximo 300 caracteres")]
    public string Detail { get; set; } = "";

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        foreach (var error in ValidateOption(Kind, ClinicalHistoryKeys.ExamKinds, "kind")) yield return error;
        if (Kind == "interconsulta" && !HasText(Detail, 3))
            yield return Error("Indica el especialista o el motivo de la interconsulta", "detail");
    }
}

/// <summary>Tratamiento realizado en la atención (con su costo cobrado).</summary>
public class PerformedTreatment : IValidatableObject
{
    public string Id { get; set; } = "";

    /// <summary>Tratamiento del catálogo. null solo en ítems de texto libre antiguos.</summary>
    public Guid? TreatmentId { get; set; }

    /// <summary>Solo se guarda en los ítems de texto libre (sin treatmentId).</summary>
    [MaxLength(300, ErrorMessage = "Máximo 300 caracteres")]
    public string Description { get; set; } = "";

    [MaxLength(60, ErrorMessage = "Máximo 60 caracteres")]
    public string Tooth { get; set; } = "";

    [Range(typeof(decimal), "0", "1000000", ParseLimitsInInvariantCulture = true, ErrorMessage = "Revisa el costo")]
    public decimal Cost { get; set; }

    /// <summary>Tratamiento realizado registrado en el módulo Tratamientos (treatment_assignments).</summary>
    public string? AssignmentId { get; set; }

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (TreatmentId is null && !HasText(Description, 2)) yield return Error("Describe el tratamiento", "description");
    }
}

/// <summary>Copia de alertas, alergias y medicación vigentes al registrar la atención.</summary>
public class ClinicalSnapshot : IValidatableObject
{
    public List<string> Alerts { get; set; } = [];

    [MaxLength(MaxListItems, ErrorMessage = "Máximo 50 alergias")]
    public List<Allergy> Allergies { get; set; } = [];

    [MaxLength(MaxListItems, ErrorMessage = "Máximo 50 medicamentos")]
    public List<Medication> Medications { get; set; } = [];

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext) =>
        ValidateKeys(Alerts, ClinicalHistoryKeys.MedicalAlerts, "alerts");
}
