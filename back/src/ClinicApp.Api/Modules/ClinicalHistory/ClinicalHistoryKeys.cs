namespace ClinicApp.Api.Modules.ClinicalHistory;

/// <summary>
/// Valores permitidos de la historia clínica. Son los mismos de los tipos del frontend
/// (background.types.ts, encounter-assessment.types.ts y clinical-history.types.ts).
/// Si el frontend agrega una opción, hay que agregarla aquí también.
/// </summary>
public static class ClinicalHistoryKeys
{
    /// <summary>Los 19 antecedentes médicos personales y familiares.</summary>
    public static readonly string[] MedicalConditions =
    [
        "hipertension", "diabetes", "cardiopatia", "renal", "hepatica", "tiroides", "asma", "epilepsia",
        "hemorragico", "anemia", "osteoporosis", "cancer", "autoinmune", "infectocontagiosa",
        "hospitalizaciones", "cirugias", "embarazo", "ansiedad", "otro",
    ];

    /// <summary>Antecedentes que exigen el detalle (cuál, cuándo) cuando se marcan.</summary>
    public static readonly string[] ConditionsWithDetail = ["hospitalizaciones", "cirugias", "otro"];

    /// <summary>Las 8 alertas médicas.</summary>
    public static readonly string[] MedicalAlerts =
        ["anticoagulantes", "bifosfonatos", "corticoides", "inmunosupresores", "insulina", "profilaxis", "marcapasos", "latex"];

    public static readonly string[] YesNo = ["", "si", "no"];
    public static readonly string[] BruxismPatterns = ["", "diurno", "nocturno", "ambos"];
    public static readonly string[] HygieneQualities = ["", "adecuada", "deficiente"];
    public static readonly string[] HygieneAids = ["cepillo", "hilo", "interdental", "enjuague", "irrigador"];

    /// <summary>Los 14 antecedentes odontológicos.</summary>
    public static readonly string[] DentalBackground =
    [
        "atencion_previa", "experiencia_negativa", "sangrado_gingival", "movilidad", "perdida_dentaria", "trauma",
        "tratamiento_periodontal", "cirugia_oral", "implantes", "ortodoncia", "endodoncia", "protesis",
        "reaccion_anestesia", "complicaciones",
    ];

    /// <summary>Los 10 antecedentes periodontales.</summary>
    public static readonly string[] PeriodontalBackground =
    [
        "sangrado_espontaneo", "sangrado_cepillado", "halitosis", "supuracion", "migracion", "sensibilidad_radicular",
        "dolor_gingival", "perdida_periodontitis", "historia_familiar", "estres",
    ];

    public static readonly string[] TreatmentPhases =
        ["", "urgencia", "sistemica", "higienica", "quirurgica", "restauradora", "protesica", "mantenimiento"];

    public static readonly string[] ConsentStatuses = ["pendiente", "aceptado", "rechazado"];
    public static readonly string[] Signers = ["paciente", "representante"];

    /// <summary>Los 10 tipos de examen complementario.</summary>
    public static readonly string[] ExamKinds =
    [
        "radiografia_periapical", "bitewing", "panoramica", "cbct", "fotografias", "modelos", "pruebas_pulpares",
        "laboratorio", "interconsulta", "biopsia",
    ];

    public static readonly string[] ExamRequestStatuses = ["pendiente", "recibido"];

    /// <summary>Tipos de adjunto: los 10 exámenes, más el consentimiento y otros documentos.</summary>
    public static readonly string[] AttachmentKinds = [.. ExamKinds, "consentimiento", "otro"];

    public static readonly string[] Asa = ["", "I", "II", "III", "IV"];
    public static readonly string[] Risks = ["hemorragico", "infeccioso", "ambulatorio"];
    public static readonly string[] ExamStatuses = ["normal", "alterado", "no_evaluado"];
    public static readonly string[] Extraoral = ["simetria", "ganglios", "atm", "apertura", "musculos", "piel_labios"];
    public static readonly string[] Intraoral = ["mucosa", "paladar", "lengua", "glandulas", "frenillos", "encia", "oclusion", "protesis"];
    public static readonly string[] RiskLevels = ["", "bajo", "moderado", "alto"];
    public static readonly string[] Priorities = ["", "alta", "media", "baja"];
    public static readonly string[] Prognosis = ["", "favorable", "reservado", "desfavorable", "depende"];
    public static readonly string[] Gingival = ["", "salud", "gingivitis", "no_inducida"];
    public static readonly string[] Stages = ["", "I", "II", "III", "IV"];
    public static readonly string[] Extents = ["", "localizada", "generalizada", "molar_incisivo"];
    public static readonly string[] Grades = ["", "A", "B", "C"];
    public static readonly string[] Stability = ["", "estable", "remision", "inestable"];
    public static readonly string[] PeriImplant = ["", "salud", "mucositis", "periimplantitis", "deficiencia"];
    public static readonly string[] Maintenance = ["", "3", "4", "6", "otro"];
}
