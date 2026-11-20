using ClinicApp.Api.Common;
using ClinicApp.Api.Modules.Patients;

namespace ClinicApp.Api.Tests.Unit;

public class PatientRulesTests
{
    [Theory]
    [InlineData(1, "HC-000001")]
    [InlineData(825, "HC-000825")]
    [InlineData(1234567, "HC-1234567")]
    public void FormatRecordNumber_rellena_con_ceros(int number, string expected) =>
        Assert.Equal(expected, PatientOptions.FormatRecordNumber(number));

    [Theory]
    [InlineData("HC-000123", 123)]
    [InlineData("hc123", 123)]
    [InlineData("HC 45", 45)]
    [InlineData("Pérez", null)]
    [InlineData("HC-", null)]
    [InlineData("1712345678", null)]
    public void ParseRecordNumber_reconoce_el_formato_de_historia(string text, int? expected) =>
        Assert.Equal(expected, PatientOptions.ParseRecordNumber(text));

    [Fact]
    public void ValidateDates_rechaza_nacimiento_futuro_y_anterior_a_1900()
    {
        var today = new DateOnly(2026, 11, 17);

        Assert.Contains(new PatientRequest { BirthDate = "2026-11-18" }.ValidateDates(today), error => error.Field == "birthDate");
        Assert.Contains(new PatientRequest { BirthDate = "1899-12-31" }.ValidateDates(today), error => error.Field == "birthDate");
        Assert.Empty(new PatientRequest { BirthDate = "2026-11-17" }.ValidateDates(today));
    }

    [Fact]
    public void ValidateDates_rechaza_ultima_visita_futura()
    {
        var errors = new PatientRequest { BirthDate = "1990-01-01", LastVisitAt = "2030-01-01" }.ValidateDates(new DateOnly(2026, 11, 17));

        Assert.Contains(errors, error => error.Field == "lastVisitAt");
    }

    [Fact]
    public void ApplyTo_limpia_textos_y_usa_valores_por_defecto()
    {
        var request = new PatientRequest
        {
            FirstName = "  Ana ",
            LastName = " Ruiz",
            DocumentId = " 1712345678 ",
            BirthDate = "1990-01-01",
            Gender = "femenino",
            Phone = "0991234567",
            Email = " ANA@Correo.com ",
            Occupation = null,
            TreatmentStatus = null,
        };
        var patient = new Patient();

        request.ApplyTo(patient);

        Assert.Equal("Ana", patient.FirstName);
        Assert.Equal("1712345678", patient.DocumentId);
        Assert.Equal("ana@correo.com", patient.Email);
        Assert.Equal("", patient.Occupation);
        Assert.Equal("activo", patient.TreatmentStatus);
        Assert.Equal(new DateOnly(1990, 1, 1), patient.BirthDate);
    }

    [Theory]
    [InlineData("50%", @"%50\%%")]
    [InlineData("a_b", @"%a\_b%")]
    public void ContainsPattern_escapa_comodines(string search, string expected) =>
        Assert.Equal(expected, TextSearch.ContainsPattern(search));

    [Theory]
    [InlineData("1710034065", true)]   // verificador 5 correcto
    [InlineData("1710034066", false)]  // verificador incorrecto
    [InlineData("2510034065", false)]  // provincia 25 no existe
    [InlineData("1770034065", false)]  // tercer dígito mayor que 5
    [InlineData("171003406", false)]   // 9 dígitos
    [InlineData("17100340A5", false)]
    public void IsEcuadorianId_valida_provincia_tercer_digito_y_verificador(string value, bool expected) =>
        Assert.Equal(expected, PatientOptions.IsEcuadorianId(value));

    [Theory]
    [InlineData("", true)]
    [InlineData(null, true)]
    [InlineData("099 123 4567", true)]
    [InlineData("+593 (2) 222-2222 ext. 12", true)]
    [InlineData("12345", false)]       // menos de 7 dígitos
    [InlineData("099-ABC-4567", false)]
    public void IsValidOptionalPhone_acepta_vacio_o_7_digitos(string? value, bool expected) =>
        Assert.Equal(expected, PatientOptions.IsValidOptionalPhone(value));

    [Fact]
    public void ValidateRules_exige_cedula_valida_solo_con_tipo_cedula()
    {
        Assert.Contains(new PatientRequest { DocumentType = "cedula", DocumentId = "1710034066" }.ValidateRules(), error => error.Field == "documentId");
        Assert.Empty(new PatientRequest { DocumentType = "cedula", DocumentId = "1710034065" }.ValidateRules());
        Assert.Empty(new PatientRequest { DocumentType = "pasaporte", DocumentId = "AB123456" }.ValidateRules());
        Assert.Empty(new PatientRequest { DocumentType = null, DocumentId = "1710034066" }.ValidateRules());
    }
}
