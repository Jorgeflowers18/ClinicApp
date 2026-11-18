using ClinicApp.Api.Common;
using ClinicApp.Api.Tests.Infrastructure;

namespace ClinicApp.Api.Tests.Unit;

public class ClinicClockTests
{
    private static ClinicClock At(string utc, string zone = "America/Guayaquil") =>
        new(zone, new FixedTimeProvider(DateTimeOffset.Parse(utc)));

    [Fact]
    public void Today_usa_el_dia_de_la_clinica_y_no_el_de_UTC()
    {
        // 02:00 UTC del 16 = 21:00 del 15 en Ecuador (UTC−5).
        var clock = At("2026-11-16T02:00:00Z");

        Assert.Equal(new DateOnly(2026, 11, 15), clock.Today);
    }

    [Fact]
    public void Otra_zona_horaria_cambia_el_dia()
    {
        // La misma hora ya es el 16 en Tokio (UTC+9).
        var clock = At("2026-11-16T02:00:00Z", "Asia/Tokyo");

        Assert.Equal(new DateOnly(2026, 11, 16), clock.Today);
    }

    [Fact]
    public void ToUtc_convierte_la_hora_local_de_la_clinica()
    {
        var clock = At("2026-11-16T12:00:00Z");

        var utc = clock.ToUtc(new DateOnly(2026, 11, 20), new TimeOnly(9, 0));

        Assert.Equal(new DateTime(2026, 11, 20, 14, 0, 0, DateTimeKind.Utc), utc);
    }

    [Fact]
    public void UtcRange_incluye_el_ultimo_dia_completo()
    {
        var clock = At("2026-11-16T12:00:00Z");

        var (start, end) = clock.UtcRange(new DateOnly(2026, 11, 1), new DateOnly(2026, 11, 30));

        Assert.Equal(new DateTime(2026, 11, 1, 5, 0, 0, DateTimeKind.Utc), start);
        Assert.Equal(new DateTime(2026, 12, 1, 5, 0, 0, DateTimeKind.Utc), end);
    }

    [Fact]
    public void Una_zona_inexistente_detiene_el_arranque()
    {
        var error = Assert.Throws<InvalidOperationException>(() => At("2026-11-16T12:00:00Z", "America/NoExiste"));

        Assert.Contains("America/NoExiste", error.Message);
    }
}
