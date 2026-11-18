namespace ClinicApp.Api.Common;

/// <summary>
/// Fecha y hora "de la clínica". El servidor trabaja en UTC, pero las reglas como "no puede ser futura"
/// o "las citas de hoy" dependen del día en la zona horaria de la clínica (Ecuador por defecto).
///
/// La zona se configura en <c>Clinic:TimeZone</c> (variable de entorno <c>Clinic__TimeZone</c>) con su
/// nombre estándar IANA: <c>America/Guayaquil</c>, <c>America/Bogota</c>... Si el nombre no existe, la API
/// no arranca (mejor que trabajar con una zona equivocada sin saberlo).
/// </summary>
public class ClinicClock
{
    public const string DefaultTimeZone = "America/Guayaquil";

    private readonly TimeProvider _time;

    public ClinicClock(IConfiguration configuration, TimeProvider time)
        : this(configuration["Clinic:TimeZone"] ?? DefaultTimeZone, time)
    {
    }

    public ClinicClock(string timeZoneId, TimeProvider time)
    {
        _time = time;
        ZoneId = timeZoneId;
        try
        {
            Zone = TimeZoneInfo.FindSystemTimeZoneById(timeZoneId);
        }
        catch (TimeZoneNotFoundException exception)
        {
            throw new InvalidOperationException(
                $"La zona horaria '{timeZoneId}' (Clinic:TimeZone) no existe. Usa un nombre IANA, por ejemplo {DefaultTimeZone}.",
                exception);
        }
    }

    /// <summary>Zona horaria de la clínica.</summary>
    public TimeZoneInfo Zone { get; }

    /// <summary>Nombre IANA de la zona ("America/Guayaquil"), el que entiende PostgreSQL en AT TIME ZONE.</summary>
    public string ZoneId { get; }

    /// <summary>Momento actual en UTC.</summary>
    public DateTime UtcNow => _time.GetUtcNow().UtcDateTime;

    /// <summary>Fecha y hora actual en la clínica.</summary>
    public DateTime LocalNow => TimeZoneInfo.ConvertTimeFromUtc(UtcNow, Zone);

    /// <summary>El día de hoy en la clínica.</summary>
    public DateOnly Today => DateOnly.FromDateTime(LocalNow);

    /// <summary>Convierte una fecha y hora de la clínica (lo que escribe el usuario) a UTC.</summary>
    public DateTime ToUtc(DateOnly date, TimeOnly time) =>
        TimeZoneInfo.ConvertTimeToUtc(date.ToDateTime(time, DateTimeKind.Unspecified), Zone);

    /// <summary>Convierte un instante UTC a la hora de la clínica.</summary>
    public DateTime ToLocal(DateTime utc) =>
        TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(utc, DateTimeKind.Utc), Zone);

    /// <summary>Día de la clínica en que cae un instante UTC.</summary>
    public DateOnly LocalDate(DateTime utc) => DateOnly.FromDateTime(ToLocal(utc));

    /// <summary>
    /// Rango UTC <c>[from 00:00, to + 1 día 00:00)</c> para filtrar "del día from al día to, inclusive"
    /// en hora de la clínica.
    /// </summary>
    public (DateTime Start, DateTime End) UtcRange(DateOnly from, DateOnly to) =>
        (ToUtc(from, TimeOnly.MinValue), ToUtc(to.AddDays(1), TimeOnly.MinValue));
}
