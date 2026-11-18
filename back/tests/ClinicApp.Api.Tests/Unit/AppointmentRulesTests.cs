using ClinicApp.Api.Modules.Appointments;

namespace ClinicApp.Api.Tests.Unit;

public class AppointmentRulesTests
{
    [Theory]
    [InlineData("programada", "confirmada", true)]
    [InlineData("programada", "completada", true)]
    [InlineData("programada", "no_asistio", true)]
    [InlineData("programada", "cancelada", true)]
    [InlineData("confirmada", "completada", true)]
    [InlineData("confirmada", "cancelada", true)]
    [InlineData("confirmada", "programada", false)]
    [InlineData("cancelada", "programada", false)]
    [InlineData("completada", "cancelada", false)]
    [InlineData("no_asistio", "completada", false)]
    public void CanChange_sigue_los_botones_del_frontend(string from, string to, bool expected) =>
        Assert.Equal(expected, AppointmentStatuses.CanChange(from, to));

    [Theory]
    [InlineData("programada", true)]
    [InlineData("confirmada", true)]
    [InlineData("completada", false)]
    [InlineData("cancelada", false)]
    [InlineData("no_asistio", false)]
    public void Solo_se_editan_programadas_y_confirmadas(string status, bool expected) =>
        Assert.Equal(expected, AppointmentStatuses.IsEditable(status));

    [Theory]
    [InlineData(9, 10, 10, 11, false)] // pegadas: no chocan
    [InlineData(9, 10, 9, 10, true)]
    [InlineData(9, 11, 10, 12, true)]
    [InlineData(10, 11, 9, 12, true)]  // contenida
    [InlineData(8, 9, 10, 11, false)]
    public void Overlap_detecta_choques(int startA, int endA, int startB, int endB, bool expected)
    {
        var day = new DateTime(2026, 11, 20, 0, 0, 0, DateTimeKind.Utc);

        Assert.Equal(expected, TimeRanges.Overlap(day.AddHours(startA), day.AddHours(endA), day.AddHours(startB), day.AddHours(endB)));
    }

    [Theory]
    [InlineData("09:00", "09:00", "La hora de fin debe ser posterior a la de inicio")]
    [InlineData("10:00", "09:00", "La hora de fin debe ser posterior a la de inicio")]
    [InlineData("09:00", "09:04", "La duración mínima es de 5 minutos")]
    [InlineData("06:00", "18:30", "La duración máxima es de 12 horas")]
    public void ValidateRange_rechaza_rangos_invalidos(string start, string end, string message)
    {
        var request = new AppointmentRequest { Date = "2026-11-20", StartTime = start, EndTime = end };

        Assert.Contains(request.ValidateRange(), error => error.Field == "endTime" && error.Message == message);
    }

    [Fact]
    public void ValidateRange_acepta_un_rango_normal() =>
        Assert.Empty(new AppointmentRequest { Date = "2026-11-20", StartTime = "09:00", EndTime = "09:30" }.ValidateRange());

    [Theory]
    [InlineData(null, true, false)]
    [InlineData("", true, false)]
    [InlineData("0199a000-0000-7000-8000-000000000001", true, true)]
    [InlineData("prof_1", false, false)]
    public void TryParseOptionalId_acepta_vacio_o_uuid(string? value, bool valid, bool hasValue)
    {
        Assert.Equal(valid, TimeSlotRequest.TryParseOptionalId(value, out var id));
        Assert.Equal(hasValue, id is not null);
    }
}
