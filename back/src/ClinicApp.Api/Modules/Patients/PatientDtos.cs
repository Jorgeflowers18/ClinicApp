using System.ComponentModel.DataAnnotations;
using ClinicApp.Api.Common;

namespace ClinicApp.Api.Modules.Patients;

/// <summary>
/// Lo que la API devuelve: la forma de <c>Patient</c> en el frontend (patient.types.ts), más
/// <c>deletedAt</c> (null si el paciente está activo). Las fechas vacías van como "".
/// </summary>
public record PatientDto(
    Guid Id,
    string ClinicalRecordNumber,
    string FirstName,
    string LastName,
    string DocumentId,
    string? DocumentType,
    string BirthDate,
    string Gender,
    string MaritalStatus,
    string Occupation,
    string Company,
    string Nationality,
    string Phone,
    string Email,
    string Address,
    string City,
    string Notes,
    bool NotificationsEnabled,
    string EmergencyContactName,
    string EmergencyContactRelationship,
    string EmergencyContactPhone,
    string InsuranceProvider,
    string InsurancePolicy,
    bool ConsentSigned,
    string TreatmentStatus,
    string LastVisitAt,
    DateTime CreatedAt,
    DateTime? DeletedAt)
{
    public static PatientDto FromEntity(Patient patient) => new(
        patient.Id,
        PatientOptions.FormatRecordNumber(patient.RecordNumber),
        patient.FirstName,
        patient.LastName,
        patient.DocumentId,
        patient.DocumentType.Length == 0 ? null : patient.DocumentType,
        FormatDate(patient.BirthDate),
        patient.Gender,
        patient.MaritalStatus,
        patient.Occupation,
        patient.Company,
        patient.Nationality,
        patient.Phone,
        patient.Email,
        patient.Address,
        patient.City,
        patient.Notes,
        patient.NotificationsEnabled,
        patient.EmergencyContactName,
        patient.EmergencyContactRelationship,
        patient.EmergencyContactPhone,
        patient.InsuranceProvider,
        patient.InsurancePolicy,
        patient.ConsentSigned,
        patient.TreatmentStatus,
        FormatDate(patient.LastVisitAt),
        patient.CreatedAt,
        patient.DeletedAt);

    public static string FormatDate(DateOnly? date) => date?.ToString(IsoDateAttribute.Format) ?? "";
}

/// <summary>
/// Crear o editar un paciente: la forma de <c>PatientFormValues</c> (patientSchema del frontend).
/// <c>clinicalRecordNumber</c> no se recibe: lo asigna el servidor y es de solo lectura.
/// </summary>
public class PatientRequest
{
    [Required(ErrorMessage = "Mínimo 2 caracteres")]
    [MinLength(2, ErrorMessage = "Mínimo 2 caracteres")]
    [MaxLength(80, ErrorMessage = "Máximo 80 caracteres")]
    public string FirstName { get; set; } = "";

    [Required(ErrorMessage = "Mínimo 2 caracteres")]
    [MinLength(2, ErrorMessage = "Mínimo 2 caracteres")]
    [MaxLength(80, ErrorMessage = "Máximo 80 caracteres")]
    public string LastName { get; set; } = "";

    [Required(ErrorMessage = "Documento inválido")]
    [MinLength(5, ErrorMessage = "Documento inválido")]
    [MaxLength(20, ErrorMessage = "Máximo 20 caracteres")]
    public string DocumentId { get; set; } = "";

    /// <summary><c>cedula</c> (valida el dígito verificador), <c>pasaporte</c>, <c>otro</c>, o vacío/null.</summary>
    [AllowedValues("", "cedula", "pasaporte", "otro", null, ErrorMessage = "Tipo de documento inválido")]
    public string? DocumentType { get; set; }

    /// <summary>"YYYY-MM-DD". Que no sea futura ni anterior a 1900 lo revisa el controlador.</summary>
    [Required(ErrorMessage = "La fecha de nacimiento es obligatoria")]
    [IsoDate]
    public string BirthDate { get; set; } = "";

    [Required(ErrorMessage = "Selecciona un género")]
    [AllowedValues("femenino", "masculino", "otro", ErrorMessage = "Selecciona un género")]
    public string Gender { get; set; } = "";

    [AllowedValues("", "soltero", "casado", "union_libre", "divorciado", "viudo", null, ErrorMessage = "Estado civil inválido")]
    public string? MaritalStatus { get; set; }

    [MaxLength(120, ErrorMessage = "Máximo 120 caracteres")]
    public string? Occupation { get; set; }

    [MaxLength(120, ErrorMessage = "Máximo 120 caracteres")]
    public string? Company { get; set; }

    [MaxLength(60, ErrorMessage = "Máximo 60 caracteres")]
    public string? Nationality { get; set; }

    /// <summary>Opcional (hay pacientes sin teléfono); si viene, con al menos 7 dígitos.</summary>
    [MaxLength(30, ErrorMessage = "Máximo 30 caracteres")]
    public string? Phone { get; set; }

    [MaxLength(254, ErrorMessage = "Máximo 254 caracteres")]
    [RegularExpression(Validation.OptionalEmailPattern, ErrorMessage = "Correo inválido")]
    public string? Email { get; set; }

    [MaxLength(250, ErrorMessage = "Máximo 250 caracteres")]
    public string? Address { get; set; }

    [MaxLength(120, ErrorMessage = "Máximo 120 caracteres")]
    public string? City { get; set; }

    [MaxLength(2000, ErrorMessage = "Máximo 2000 caracteres")]
    public string? Notes { get; set; }

    /// <summary>Si no viene, true (los pacientes nuevos reciben notificaciones por defecto).</summary>
    public bool NotificationsEnabled { get; set; } = true;

    [MaxLength(120, ErrorMessage = "Máximo 120 caracteres")]
    public string? EmergencyContactName { get; set; }

    [MaxLength(60, ErrorMessage = "Máximo 60 caracteres")]
    public string? EmergencyContactRelationship { get; set; }

    [MaxLength(30, ErrorMessage = "Máximo 30 caracteres")]
    public string? EmergencyContactPhone { get; set; }

    [MaxLength(120, ErrorMessage = "Máximo 120 caracteres")]
    public string? InsuranceProvider { get; set; }

    [MaxLength(60, ErrorMessage = "Máximo 60 caracteres")]
    public string? InsurancePolicy { get; set; }

    public bool ConsentSigned { get; set; }

    [AllowedValues("activo", "en seguimiento", "pendiente", "inactivo", null, ErrorMessage = "Estado de tratamiento inválido")]
    public string? TreatmentStatus { get; set; }

    [IsoDate]
    public string? LastVisitAt { get; set; }

    /// <summary>
    /// Reglas que dependen de "hoy" en la clínica. Los errores usan los nombres del JSON.
    /// </summary>
    public IEnumerable<(string Field, string Message)> ValidateDates(DateOnly today)
    {
        var birthDate = Validation.ParseDate(BirthDate);
        if (birthDate > today) yield return ("birthDate", "La fecha de nacimiento no puede ser futura");
        if (birthDate < new DateOnly(1900, 1, 1)) yield return ("birthDate", "La fecha de nacimiento no puede ser anterior a 1900");

        var lastVisit = Validation.ParseDate(LastVisitAt);
        if (lastVisit > today) yield return ("lastVisitAt", "La última visita no puede ser futura");
    }

    /// <summary>Reglas entre campos: cédula según el tipo de documento y teléfonos opcionales.</summary>
    public IEnumerable<(string Field, string Message)> ValidateRules()
    {
        if (DocumentType == "cedula" && !PatientOptions.IsEcuadorianId(DocumentId.Trim()))
            yield return ("documentId", "La cédula debe tener 10 dígitos y un dígito verificador válido");
        if (!PatientOptions.IsValidOptionalPhone(Phone))
            yield return ("phone", "Ingresa un teléfono válido o deja el campo vacío");
        if (!PatientOptions.IsValidOptionalPhone(EmergencyContactPhone))
            yield return ("emergencyContactPhone", "Ingresa un teléfono válido o deja el campo vacío");
    }

    /// <summary>Copia el formulario en la entidad (crear y editar). No toca el N.° de historia.</summary>
    public void ApplyTo(Patient patient)
    {
        patient.FirstName = FirstName.Trim();
        patient.LastName = LastName.Trim();
        patient.DocumentId = DocumentId.Trim();
        patient.DocumentType = DocumentType ?? "";
        patient.BirthDate = Validation.ParseDate(BirthDate);
        patient.Gender = Gender;
        patient.MaritalStatus = MaritalStatus ?? "";
        patient.Occupation = Validation.Clean(Occupation);
        patient.Company = Validation.Clean(Company);
        patient.Nationality = Validation.Clean(Nationality);
        patient.Phone = Validation.Clean(Phone);
        patient.Email = Validation.Clean(Email).ToLowerInvariant();
        patient.Address = Validation.Clean(Address);
        patient.City = Validation.Clean(City);
        patient.Notes = Validation.Clean(Notes);
        patient.NotificationsEnabled = NotificationsEnabled;
        patient.EmergencyContactName = Validation.Clean(EmergencyContactName);
        patient.EmergencyContactRelationship = Validation.Clean(EmergencyContactRelationship);
        patient.EmergencyContactPhone = Validation.Clean(EmergencyContactPhone);
        patient.InsuranceProvider = Validation.Clean(InsuranceProvider);
        patient.InsurancePolicy = Validation.Clean(InsurancePolicy);
        patient.ConsentSigned = ConsentSigned;
        patient.TreatmentStatus = string.IsNullOrEmpty(TreatmentStatus) ? PatientOptions.DefaultTreatmentStatus : TreatmentStatus;
        patient.LastVisitAt = Validation.ParseDate(LastVisitAt);
    }
}
