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

    /// <summary>
    /// Tipo de documento: <c>cedula</c>, <c>pasaporte</c>, <c>otro</c> o "" (sin indicar: datos anteriores o
    /// importados). Con <c>cedula</c> se valida el dígito verificador.
    /// </summary>
    public string DocumentType { get; set; } = "";

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
    public static readonly string[] DocumentTypes = ["cedula", "pasaporte", "otro"];

    /// <summary>
    /// Cédula ecuatoriana: 10 dígitos, provincia 01-24 o 30, tercer dígito menor que 6 y dígito verificador
    /// (módulo 10). Es el mismo cálculo que <c>isEcuadorianId</c> del frontend; no consulta al Registro Civil.
    /// </summary>
    public static bool IsEcuadorianId(string value)
    {
        if (value.Length != 10 || !value.All(char.IsAsciiDigit)) return false;
        var province = int.Parse(value[..2]);
        if (!(province is >= 1 and <= 24 || province == 30) || value[2] - '0' > 5) return false;

        var sum = 0;
        for (var index = 0; index < 9; index++)
        {
            var weighted = (value[index] - '0') * (index % 2 == 0 ? 2 : 1);
            sum += weighted > 9 ? weighted - 9 : weighted;
        }
        return (10 - sum % 10) % 10 == value[9] - '0';
    }

    /// <summary>Teléfono opcional: vacío, o con al menos 7 dígitos (se aceptan +, espacios, guiones, paréntesis y "ext.").</summary>
    public static bool IsValidOptionalPhone(string? value)
    {
        var text = value?.Trim() ?? "";
        return text.Length == 0
            || (System.Text.RegularExpressions.Regex.IsMatch(text, @"^\+?[\d\s().-]+(?:\s*(?:ext\.?|x)\s*\d{1,6})?$", System.Text.RegularExpressions.RegexOptions.IgnoreCase)
                && text.Count(char.IsAsciiDigit) >= 7);
    }
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
