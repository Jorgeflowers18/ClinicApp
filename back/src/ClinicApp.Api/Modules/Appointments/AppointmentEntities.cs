namespace ClinicApp.Api.Modules.Appointments;

/// <summary>Cita de la agenda. Tabla <c>appointments</c>. Las horas se guardan en UTC.</summary>
public class Appointment
{
    public Guid Id { get; set; }
    public Guid PatientId { get; set; }
    public Guid ProfessionalId { get; set; }
    public Guid? TreatmentId { get; set; }
    public Guid? RoomId { get; set; }
    public DateTime Start { get; set; }
    public DateTime End { get; set; }
    public string Status { get; set; } = AppointmentStatuses.Programada;
    public string? Notes { get; set; }
    public DateTime CreatedAt { get; set; }
    public Guid? CreatedByUserId { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public DateTime? StatusChangedAt { get; set; }
    public Guid? StatusChangedByUserId { get; set; }
}

/// <summary>
/// Bloqueo puntual de horario (vacaciones, almuerzo, mantenimiento) de un profesional, de un consultorio
/// o de ambos. Tabla <c>schedule_blocks</c>. No es recurrente.
/// </summary>
public class ScheduleBlock
{
    public Guid Id { get; set; }
    public Guid? ProfessionalId { get; set; }
    public Guid? RoomId { get; set; }
    public DateTime Start { get; set; }
    public DateTime End { get; set; }
    public string Reason { get; set; } = "";
    public DateTime CreatedAt { get; set; }
    public Guid? CreatedByUserId { get; set; }
}

/// <summary>Estados de una cita (los mismos del frontend) y qué cambios se permiten.</summary>
public static class AppointmentStatuses
{
    public const string Programada = "programada";
    public const string Confirmada = "confirmada";
    public const string Cancelada = "cancelada";
    public const string Completada = "completada";
    public const string NoAsistio = "no_asistio";

    public static readonly string[] All = [Programada, Confirmada, Cancelada, Completada, NoAsistio];

    /// <summary>
    /// Cambios permitidos: los mismos botones del detalle de la cita en el frontend.
    /// cancelada, completada y no_asistio son finales.
    /// </summary>
    private static readonly Dictionary<string, string[]> Transitions = new()
    {
        [Programada] = [Confirmada, Completada, NoAsistio, Cancelada],
        [Confirmada] = [Completada, NoAsistio, Cancelada],
        [Cancelada] = [],
        [Completada] = [],
        [NoAsistio] = [],
    };

    public static bool CanChange(string from, string to) =>
        Transitions.TryGetValue(from, out var allowed) && allowed.Contains(to);

    /// <summary>Solo se editan (fecha, profesional...) las citas que todavía no ocurrieron ni se cancelaron.</summary>
    public static bool IsEditable(string status) => status is Programada or Confirmada;
}

/// <summary>Regla de choque de horarios, compartida por citas y bloqueos.</summary>
public static class TimeRanges
{
    /// <summary>
    /// Dos rangos chocan si uno empieza antes de que termine el otro. Una cita que termina a las 10:00
    /// no choca con otra que empieza a las 10:00.
    /// </summary>
    public static bool Overlap(DateTime startA, DateTime endA, DateTime startB, DateTime endB) =>
        startA < endB && endA > startB;
}
