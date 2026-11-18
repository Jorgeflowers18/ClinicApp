using ClinicApp.Api.Modules.Notifications;

namespace ClinicApp.Api.Tests.Unit;

public class NotificationRulesTests
{
    [Theory]
    [InlineData(10, 0, "10:00 am")]
    [InlineData(15, 30, "3:30 pm")]
    [InlineData(12, 0, "12:00 pm")]
    [InlineData(0, 5, "12:05 am")]
    public void FormatTime_usa_formato_de_12_horas(int hour, int minute, string expected) =>
        Assert.Equal(expected, TemplateRenderer.FormatTime(new DateTime(2026, 9, 12, hour, minute, 0)));

    [Fact]
    public void FormatDate_en_espanol() =>
        Assert.Equal("12 de septiembre", TemplateRenderer.FormatDate(new DateTime(2026, 9, 12, 10, 0, 0)));

    [Fact]
    public void Render_reemplaza_todas_las_variables()
    {
        var message = TemplateRenderer.Render(NotificationTemplate.DefaultMessage,
            new TemplateRenderer.Values("María González", "Sonrisas", new DateTime(2026, 9, 12, 10, 0, 0), "Dra. Carla Ríos"));

        Assert.Equal(
            "Hola María González, te escribimos desde Sonrisas para recordarte tu cita del 12 de septiembre a las 10:00 am con Dra. Carla Ríos. " +
            "Si necesitas reprogramar, contáctanos con anticipación. ¡Te esperamos!",
            message);
        Assert.DoesNotContain("[", message);
    }
}
