using System.ComponentModel.DataAnnotations;
using System.Globalization;
using ClinicApp.Api.Common;

namespace ClinicApp.Api.Modules.Appointments;

/// <summary>
/// Cita: la forma de <c>Appointment</c> del frontend. <c>start</c> y <c>end</c> en ISO UTC. <c>PatientName</c>
/// ("Nombres Apellidos") evita que la agenda tenga que cargar a todos los pacientes para mostrar sus nombres.
/// </summary>
public record AppointmentDto(
    Guid Id,
    Guid PatientId,
    string PatientName,
    Guid ProfessionalId,
    Guid? TreatmentId,
    Guid? RoomId,
    DateTime Start,
    DateTime End,
    string Status,
    string? Notes,
    DateTime CreatedAt)
{
    public static AppointmentDto FromEntity(Appointment appointment, string patientName) => new(
        appointment.Id, appointment.PatientId, patientName, appointment.ProfessionalId, appointment.TreatmentId, appointment.RoomId,
        appointment.Start, appointment.End, appointment.Status, appointment.Notes, appointment.CreatedAt);
}

/// <summary>Bloqueo: la forma de <c>ScheduleBlock</c> del frontend.</summary>
public record ScheduleBlockDto(Guid Id, Guid? ProfessionalId, Guid? RoomId, DateTime Start, DateTime End, string Reason, DateTime CreatedAt)
{
    public static ScheduleBlockDto FromEntity(ScheduleBlock block) => new(
        block.Id, block.ProfessionalId, block.RoomId, block.Start, block.End, block.Reason, block.CreatedAt);
}

/// <summary>
/// Fecha y horas tal como las escribe el usuario en el formulario: <c>date</c> "YYYY-MM-DD" y
/// <c>startTime</c>/<c>endTime</c> "HH:mm", en hora de la clínica. La API las convierte a UTC.
/// </summary>
public abstract class TimeSlotRequest
{
    public const string TimePattern = @"^([01]\d|2[0-3]):[0-5]\d$";

    [Required(ErrorMessage = "La fecha es obligatoria")]
    [IsoDate]
    public string Date { get; set; } = "";

    [Required(ErrorMessage = "La hora de inicio es obligatoria")]
    [RegularExpression(TimePattern, ErrorMessage = "Hora inválida (formato HH:mm)")]
    public string StartTime { get; set; } = "";

    [Required(ErrorMessage = "La hora de fin es obligatoria")]
    [RegularExpression(TimePattern, ErrorMessage = "Hora inválida (formato HH:mm)")]
    public string EndTime { get; set; } = "";

    // Métodos (no propiedades): la validación automática de MVC lee todas las propiedades públicas
    // y fallaría al convertir una hora inválida antes de responder el 400.
    public DateOnly GetDate() => Validation.ParseDate(Date)!.Value;
    public TimeOnly GetStart() => TimeOnly.ParseExact(StartTime, "HH:mm", CultureInfo.InvariantCulture);
    public TimeOnly GetEnd() => TimeOnly.ParseExact(EndTime, "HH:mm", CultureInfo.InvariantCulture);

    /// <summary>Reglas del rango: la hora de fin después de la de inicio, de 5 minutos a 12 horas.</summary>
    public IEnumerable<(string Field, string Message)> ValidateRange()
    {
        var (start, end) = (GetStart(), GetEnd());
        var duration = end - start;
        if (end <= start) yield return ("endTime", "La hora de fin debe ser posterior a la de inicio");
        else if (duration < TimeSpan.FromMinutes(5)) yield return ("endTime", "La duración mínima es de 5 minutos");
        else if (duration > TimeSpan.FromHours(12)) yield return ("endTime", "La duración máxima es de 12 horas");
    }

    /// <summary>Inicio y fin en UTC, según la zona horaria de la clínica.</summary>
    public (DateTime Start, DateTime End) ToUtc(ClinicClock clock) =>
        (clock.ToUtc(GetDate(), GetStart()), clock.ToUtc(GetDate(), GetEnd()));

    /// <summary>
    /// Los selectores del frontend envían "" cuando no se eligió nada. Convierte "" o null en null y
    /// un UUID válido en Guid; cualquier otra cosa es un error de ese campo.
    /// </summary>
    public static bool TryParseOptionalId(string? value, out Guid? id)
    {
        id = null;
        if (string.IsNullOrWhiteSpace(value)) return true;
        if (!Guid.TryParse(value, out var parsed)) return false;
        id = parsed;
        return true;
    }
}

/// <summary>Crear o editar una cita: la forma de <c>AppointmentFormValues</c> (appointmentSchema).</summary>
public class AppointmentRequest : TimeSlotRequest
{
    [Required(ErrorMessage = "Selecciona un paciente")]
    public string PatientId { get; set; } = "";

    [Required(ErrorMessage = "Selecciona un profesional")]
    public string ProfessionalId { get; set; } = "";

    public string? TreatmentId { get; set; }

    public string? RoomId { get; set; }

    [MaxLength(1000, ErrorMessage = "Máximo 1000 caracteres")]
    public string? Notes { get; set; }
}

/// <summary>Cambiar el estado: <c>{ status }</c>.</summary>
public class AppointmentStatusRequest
{
    [Required(ErrorMessage = "El estado es obligatorio")]
    [AllowedValues(AppointmentStatuses.Programada, AppointmentStatuses.Confirmada, AppointmentStatuses.Cancelada,
        AppointmentStatuses.Completada, AppointmentStatuses.NoAsistio, ErrorMessage = "Estado de cita desconocido")]
    public string Status { get; set; } = "";
}

/// <summary>Crear un bloqueo: la forma de <c>ScheduleBlockFormValues</c> (scheduleBlockSchema).</summary>
public class ScheduleBlockRequest : TimeSlotRequest
{
    public string? ProfessionalId { get; set; }

    public string? RoomId { get; set; }

    [Required(ErrorMessage = "Describe el motivo del bloqueo")]
    [MinLength(3, ErrorMessage = "Describe el motivo del bloqueo")]
    [MaxLength(300, ErrorMessage = "Máximo 300 caracteres")]
    public string Reason { get; set; } = "";
}
