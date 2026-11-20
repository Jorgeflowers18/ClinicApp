using System.ComponentModel.DataAnnotations;
using System.Text;
using ClinicApp.Api.Modules.ClinicalHistory;

namespace ClinicApp.Api.Tests.Unit;

public class ClinicalHistoryRulesTests
{
    private static List<ValidationResult> Validate(IValidatableObject section) =>
        section.Validate(new ValidationContext(section)).ToList();

    [Fact]
    public void Niega_antecedentes_no_se_combina_con_antecedentes_marcados()
    {
        var background = MedicalBackground.Empty();
        background.Denies = true;
        background.Conditions["diabetes"].Personal = true;

        Assert.Contains(Validate(background), error => error.MemberNames.Contains("denies"));
    }

    [Theory]
    [InlineData("otro", "Describe el antecedente")]
    [InlineData("cirugias", "Indica cuál y cuándo")]
    public void Antecedentes_con_detalle_lo_exigen(string key, string message)
    {
        var background = MedicalBackground.Empty();
        background.Conditions[key].Family = true;

        Assert.Contains(Validate(background), error => error.MemberNames.Contains($"conditions.{key}.detail") && error.ErrorMessage == message);
    }

    [Fact]
    public void Normalized_completa_las_19_claves()
    {
        var background = new MedicalBackground().Normalized();

        Assert.Equal(19, background.Conditions.Count);
    }

    [Fact]
    public void Una_clave_desconocida_es_un_error()
    {
        var background = MedicalBackground.Empty();
        background.Conditions["inventada"] = new MedicalCondition();

        Assert.Contains(Validate(background), error => error.MemberNames.Contains("conditions.inventada"));
    }

    [Fact]
    public void Consentimiento_pendiente_no_exige_firma_y_aceptado_si()
    {
        Assert.Empty(Validate(new DataConsent { Status = "pendiente" }));

        var errors = Validate(new DataConsent { Status = "aceptado", SignerName = "Al", SignerDocumentId = "12", Date = "" });
        Assert.Contains(errors, error => error.MemberNames.Contains("signerName"));
        Assert.Contains(errors, error => error.MemberNames.Contains("signerDocumentId"));
        Assert.Contains(errors, error => error.MemberNames.Contains("date"));
    }

    [Fact]
    public void Hallazgo_alterado_exige_descripcion()
    {
        Assert.Contains(Validate(new ExamFinding { Status = "alterado", Finding = "" }), error => error.MemberNames.Contains("finding"));
        Assert.Empty(Validate(new ExamFinding { Status = "normal" }));
    }

    [Theory]
    [InlineData("120/80", true)]
    [InlineData("", true)]
    [InlineData("120-80", false)]
    [InlineData("1200/80", false)]
    public void Presion_arterial_con_formato(string pressure, bool valid) =>
        Assert.Equal(valid, Validate(new Vitals { BloodPressure = pressure }).Count == 0);

    [Fact]
    public void Intervalo_otro_exige_texto_e_interconsulta_exige_detalle()
    {
        Assert.Contains(Validate(new MaintenanceInterval { Option = "otro", Other = "" }), error => error.MemberNames.Contains("other"));
        Assert.Contains(Validate(new RequestedExam { Kind = "interconsulta", Detail = "" }), error => error.MemberNames.Contains("detail"));
        Assert.Empty(Validate(new RequestedExam { Kind = "panoramica", Detail = "" }));
    }

    [Fact]
    public void Alertas_desconocidas_o_repetidas_son_errores()
    {
        var section = new AllergiesAndMedication { Alerts = ["latex", "latex", "inventada"] };

        var errors = Validate(section);

        Assert.Contains(errors, error => error.ErrorMessage!.Contains("inventada"));
        Assert.Contains(errors, error => error.ErrorMessage == "Alerta repetida");
    }

    [Fact]
    public void Ids_de_lista_obligatorios_y_sin_repetir()
    {
        var errors = SectionRules.ValidateIds(["a", "a", "", new string('x', 101)], "plan").ToList();

        Assert.Equal(3, errors.Count);
        Assert.Contains(errors, error => error.MemberNames.Contains("plan[1].id"));
    }

    [Theory]
    [InlineData(new byte[] { 0xFF, 0xD8, 0xFF, 0xE0 }, "image/jpeg")]
    [InlineData(new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A }, "image/png")]
    [InlineData(new byte[] { 0x25, 0x50, 0x44, 0x46, 0x2D, 0x31 }, "application/pdf")]
    [InlineData(new byte[] { 0x68, 0x6F, 0x6C, 0x61 }, null)]
    public void DetectMime_reconoce_por_los_primeros_bytes(byte[] header, string? expected) =>
        Assert.Equal(expected, AttachmentStorage.DetectMime(header));

    [Fact]
    public void DetectMime_reconoce_webp()
    {
        var header = Encoding.ASCII.GetBytes("RIFF\0\0\0\0WEBPVP8 ");

        Assert.Equal("image/webp", AttachmentStorage.DetectMime(header));
    }

    [Theory]
    [InlineData("rx inicial.jpg", "rx inicial.jpg")]
    [InlineData("../../etc/passwd", "passwd")]
    [InlineData(@"C:\fotos\caso\rx.png", "rx.png")]
    [InlineData("", "archivo")]
    public void CleanAlias_quita_carpetas_y_caracteres_de_control(string input, string expected) =>
        Assert.Equal(expected, AttachmentStorage.CleanAlias(input));
}
