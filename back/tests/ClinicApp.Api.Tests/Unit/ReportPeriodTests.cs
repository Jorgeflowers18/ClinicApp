using ClinicApp.Api.Common;
using ClinicApp.Api.Modules.Reports;
using ClinicApp.Api.Tests.Infrastructure;

namespace ClinicApp.Api.Tests.Unit;

public class ReportPeriodTests
{
    private static readonly ClinicClock Clock = new("America/Guayaquil", new FixedTimeProvider(DateTimeOffset.Parse("2026-11-17T12:00:00Z")));

    [Fact]
    public void Periodo_inclusivo_en_hora_de_la_clinica()
    {
        var period = ReportPeriod.TryCreate("2026-11-01", "2026-11-30", Clock, out var errors)!;

        Assert.Empty(errors);
        Assert.Equal(new DateTime(2026, 11, 1, 5, 0, 0, DateTimeKind.Utc), period.StartUtc);
        Assert.Equal(new DateTime(2026, 12, 1, 5, 0, 0, DateTimeKind.Utc), period.EndUtc);
        Assert.Equal(30, period.Days().Count());
    }

    [Theory]
    [InlineData(null, "2026-11-30", "from")]
    [InlineData("2026-11-30", "2026-11-01", "to")]
    [InlineData("2025-01-01", "2026-01-02", "to")]
    [InlineData("01/11/2026", "2026-11-30", "from")]
    public void Periodos_invalidos(string? from, string? to, string field)
    {
        Assert.Null(ReportPeriod.TryCreate(from, to, Clock, out var errors));
        Assert.Contains(errors, error => error.Field == field);
    }

    [Theory]
    [InlineData("2026-10-12", "lun 12")]
    [InlineData("2026-10-14", "mié 14")]
    [InlineData("2026-10-17", "sáb 17")]
    [InlineData("2026-10-18", "dom 18")]
    public void Etiqueta_del_dia_como_el_mock(string date, string expected) =>
        Assert.Equal(expected, ReportPeriod.DayLabel(DateOnly.Parse(date)));
}
