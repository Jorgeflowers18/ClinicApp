using ClinicApp.Api.Common;

namespace ClinicApp.Api.Modules.Reports;

/// <summary>
/// Periodo de un reporte: <c>from</c> y <c>to</c> en "YYYY-MM-DD", obligatorios e <b>inclusivos</b>, en hora de la
/// clínica. Se convierten al rango UTC <c>[from 00:00, to + 1 día 00:00)</c>. Máximo 366 días.
/// </summary>
public sealed record ReportPeriod(DateOnly From, DateOnly To, DateTime StartUtc, DateTime EndUtc)
{
    public const int MaxDays = 366;

    /// <summary>Días del periodo, en orden (para llenar con cero los días sin citas).</summary>
    public IEnumerable<DateOnly> Days()
    {
        for (var day = From; day <= To; day = day.AddDays(1)) yield return day;
    }

    /// <summary>Valida y convierte. Devuelve los errores por campo si el periodo no es válido.</summary>
    public static ReportPeriod? TryCreate(string? from, string? to, ClinicClock clock, out List<(string Field, string Message)> errors)
    {
        errors = [];
        var attribute = new IsoDateAttribute();
        if (string.IsNullOrWhiteSpace(from) || !attribute.IsValid(from)) errors.Add(("from", "Indica la fecha inicial (AAAA-MM-DD)"));
        if (string.IsNullOrWhiteSpace(to) || !attribute.IsValid(to)) errors.Add(("to", "Indica la fecha final (AAAA-MM-DD)"));
        if (errors.Count > 0) return null;

        var start = Validation.ParseDate(from)!.Value;
        var end = Validation.ParseDate(to)!.Value;
        if (start > end) errors.Add(("to", "La fecha final debe ser igual o posterior a la inicial"));
        else if (end.DayNumber - start.DayNumber + 1 > MaxDays) errors.Add(("to", $"El periodo no puede superar {MaxDays} días"));
        if (errors.Count > 0) return null;

        var (startUtc, endUtc) = clock.UtcRange(start, end);
        return new ReportPeriod(start, end, startUtc, endUtc);
    }

    private static readonly string[] DayNames = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

    /// <summary>Etiqueta del día como en el mock (date-fns "EEE d" en español): "lun 12".</summary>
    public static string DayLabel(DateOnly day) => $"{DayNames[(int)day.DayOfWeek]} {day.Day}";
}
