namespace ClinicApp.Api.Modules.Patients;

/// <summary>
/// Paciente de la clínica. Tabla <c>patients</c>. Los nombres de los campos son los de
/// <c>Patient</c> en el frontend (patient.types.ts).
///
/// Los textos opcionales se guardan como "" (no null), porque así los envía y espera el frontend.
/// </summary>
public class Patient
{
    public Guid Id { get; set; }

    /// <summary>
    /// N.° de historia clínica (123 → "HC-000123"). Lo asigna la secuencia <c>patient_record_number_seq</c>
    /// al insertar y nunca cambia.
    /// </summary>
    public int RecordNumber { get; set; }

    public string FirstName { get; set; } = "";
    public string LastName { get; set; } = "";

    /// <summary>Cédula o pasaporte. No es única en la base: los datos importados tienen repetidas.</summary>
    public string DocumentId { get; set; } = "";

    /// <summary>Nulable solo para datos importados con fechas imposibles; el formulario la exige.</summary>
    public DateOnly? BirthDate { get; set; }

    public string Gender { get; set; } = "";
    public string MaritalStatus { get; set; } = "";
    public string Occupation { get; set; } = "";
    public string Company { get; set; } = "";
    public string Nationality { get; set; } = "";
    public string Phone { get; set; } = "";
    public string Email { get; set; } = "";
    public string Address { get; set; } = "";
    public string City { get; set; } = "";
    public string Notes { get; set; } = "";
    public bool NotificationsEnabled { get; set; } = true;
    public string EmergencyContactName { get; set; } = "";
    public string EmergencyContactRelationship { get; set; } = "";
    public string EmergencyContactPhone { get; set; } = "";
    public string InsuranceProvider { get; set; } = "";
    public string InsurancePolicy { get; set; } = "";
    public bool ConsentSigned { get; set; }
    public string TreatmentStatus { get; set; } = PatientOptions.DefaultTreatmentStatus;

    /// <summary>Última visita. Por ahora se edita a mano; luego la calculará la historia clínica.</summary>
    public DateOnly? LastVisitAt { get; set; }

    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public Guid? CreatedByUserId { get; set; }
    public Guid? UpdatedByUserId { get; set; }

    /// <summary>Baja lógica: el paciente no se borra, porque tiene citas, tratamientos e historia.</summary>
    public DateTime? DeletedAt { get; set; }
    public Guid? DeletedByUserId { get; set; }

    public bool IsActive => DeletedAt is null;

    public string FullName => $"{FirstName} {LastName}".Trim();
}

/// <summary>Valores permitidos (los mismos del frontend).</summary>
public static class PatientOptions
{
    public static readonly string[] Genders = ["femenino", "masculino", "otro"];
    public static readonly string[] MaritalStatuses = ["", "soltero", "casado", "union_libre", "divorciado", "viudo"];
    public static readonly string[] TreatmentStatuses = ["activo", "en seguimiento", "pendiente", "inactivo"];
    public const string DefaultTreatmentStatus = "activo";

    /// <summary>123 → "HC-000123".</summary>
    public static string FormatRecordNumber(int number) => $"HC-{number:D6}";

    /// <summary>"HC-000123", "hc123" o "HC-123" → 123. Cualquier otra cosa → null.</summary>
    public static int? ParseRecordNumber(string text)
    {
        var value = text.Trim();
        if (!value.StartsWith("hc", StringComparison.OrdinalIgnoreCase)) return null;
        value = value[2..].TrimStart('-', ' ');
        return value.Length is > 0 and <= 9 && value.All(char.IsAsciiDigit) ? int.Parse(value) : null;
    }
}
