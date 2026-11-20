using System.Net;
using System.Net.Http.Json;
using System.Text.Json.Nodes;
using ClinicApp.Api.Modules.Finance;
using ClinicApp.Api.Tests.Infrastructure;

namespace ClinicApp.Api.Tests.Integration;

[Collection(ApiCollection.Name)]
public class FinanceTests(ApiFactory api)
{
    /// <summary>Un paciente con <paramref name="prices"/> tratamientos realizados del mismo tratamiento.</summary>
    private async Task<(HttpClient Admin, Guid PatientId, Guid TreatmentId)> SetupAsync(params decimal[] prices)
    {
        var admin = await api.As("admin");
        var patient = await admin.CreatePatientAsync();
        var treatment = await admin.PostJson("/api/treatments", new
        {
            name = $"Ortodoncia {TestData.Next()}", category = "Ortodoncia", durationMinutes = 45, price = 500, active = true, consumption = Array.Empty<object>(),
        }, HttpStatusCode.Created);

        foreach (var price in prices)
        {
            await admin.PostJson("/api/treatment-assignments", new
            {
                treatmentId = treatment.Id(), patientId = patient.Id(), date = TestData.TodayInClinic().Iso(), tooth = "",
                sourceKey = $"{Guid.NewGuid()}:{Guid.NewGuid()}", price,
            }, HttpStatusCode.Created);
        }

        return (admin, patient.Id(), treatment.Id());
    }

    private static object Payment(Guid patientId, Guid treatmentId, decimal amount, string? date = null) => new
    {
        patientId, treatmentId, date = date ?? TestData.TodayInClinic().Iso(), amount, method = "transferencia", reference = "TRX-1", observations = "",
    };

    private static async Task<JsonNode> RowAsync(HttpClient client, Guid patientId, Guid treatmentId)
    {
        var rows = (await client.GetJson("/api/finance/portfolio"))!.AsArray();
        return rows.Single(row => row.Str("patientId") == patientId.ToString() && row.Str("treatmentId") == treatmentId.ToString())!;
    }

    [Fact]
    public async Task La_cartera_suma_todos_los_tratamientos_realizados_del_mismo_tratamiento()
    {
        var (admin, patientId, treatmentId) = await SetupAsync(300, 200);

        var row = await RowAsync(admin, patientId, treatmentId);

        Assert.Equal(500m, row["total"]!.GetValue<decimal>());
        Assert.Equal(500m, row["pending"]!.GetValue<decimal>());
        Assert.Equal("parcial", row.Str("status"));
    }

    [Fact]
    public async Task Pagos_parcial_completo_y_anulacion()
    {
        var (admin, patientId, treatmentId) = await SetupAsync(100);

        var partial = await admin.PostJson("/api/finance/payments", Payment(patientId, treatmentId, 40), HttpStatusCode.Created);
        Assert.Equal("Ana Morales", partial.Str("registeredBy"));
        Assert.Equal(60m, (await RowAsync(admin, patientId, treatmentId))["pending"]!.GetValue<decimal>());

        await admin.PostJson("/api/finance/payments", Payment(patientId, treatmentId, 60), HttpStatusCode.Created);
        Assert.Equal("al_dia", (await RowAsync(admin, patientId, treatmentId)).Str("status"));

        // Anular sin motivo: 400. Con motivo: el saldo vuelve. Dos veces: 409.
        await admin.PostJson($"/api/finance/payments/{partial.Id()}/void", new { reason = "" }, HttpStatusCode.BadRequest);
        var voided = await admin.PostJson($"/api/finance/payments/{partial.Id()}/void", new { reason = "Transferencia rechazada" }, HttpStatusCode.OK);
        Assert.Equal("anulado", voided.Str("status"));
        Assert.Equal(40m, (await RowAsync(admin, patientId, treatmentId))["pending"]!.GetValue<decimal>());
        await admin.PostJson($"/api/finance/payments/{partial.Id()}/void", new { reason = "Otra vez" }, HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task No_se_paga_mas_que_el_saldo_ni_un_tratamiento_que_no_tiene()
    {
        var (admin, patientId, treatmentId) = await SetupAsync(100);
        var (_, _, otherTreatment) = await SetupAsync(50);

        var tooMuch = await admin.PostJson("/api/finance/payments", Payment(patientId, treatmentId, 100.01m), HttpStatusCode.Conflict);
        Assert.True(tooMuch.HasError("amount"));

        var notReceived = await admin.PostJson("/api/finance/payments", Payment(patientId, otherTreatment, 10), HttpStatusCode.BadRequest);
        Assert.True(notReceived.HasError("treatmentId"));

        var future = await admin.PostJson("/api/finance/payments", Payment(patientId, treatmentId, 10, TestData.TodayInClinic().AddDays(1).Iso()), HttpStatusCode.BadRequest);
        Assert.True(future.HasError("date"));

        var invalid = await admin.PostJson("/api/finance/payments",
            new { patientId, treatmentId, date = TestData.TodayInClinic().Iso(), amount = 0, method = "bitcoin" }, HttpStatusCode.BadRequest);
        Assert.True(invalid.HasError("amount"));
        Assert.True(invalid.HasError("method"));
    }

    [Fact]
    public async Task Pagos_simultaneos_no_superan_el_saldo()
    {
        var (admin, patientId, treatmentId) = await SetupAsync(100);

        var responses = await Task.WhenAll(Enumerable.Range(0, 5).Select(_ =>
            admin.PostAsync("/api/finance/payments", JsonContent.Create(Payment(patientId, treatmentId, 60)))));

        Assert.Equal(1, responses.Count(response => response.StatusCode == HttpStatusCode.Created));
        Assert.Equal(40m, (await RowAsync(admin, patientId, treatmentId))["pending"]!.GetValue<decimal>());
    }

    [Fact]
    public async Task Montos_sin_errores_de_redondeo()
    {
        var (admin, patientId, treatmentId) = await SetupAsync(99.99m);

        for (var i = 0; i < 3; i++) await admin.PostJson("/api/finance/payments", Payment(patientId, treatmentId, 33.33m), HttpStatusCode.Created);

        var row = await RowAsync(admin, patientId, treatmentId);
        Assert.Equal(0m, row["pending"]!.GetValue<decimal>());
        Assert.Equal("al_dia", row.Str("status"));
    }

    [Fact]
    public async Task Resumenes_de_tratamiento_y_de_paciente()
    {
        var (admin, patientId, treatmentId) = await SetupAsync(120);
        await admin.PostJson("/api/finance/payments", Payment(patientId, treatmentId, 20), HttpStatusCode.Created);

        var treatment = await admin.GetJson($"/api/finance/treatments/{treatmentId}/summary?patientId={patientId}");
        Assert.Equal(120m, treatment!["totalValue"]!.GetValue<decimal>());
        Assert.Equal(100m, treatment["pendingBalance"]!.GetValue<decimal>());
        Assert.Single(treatment["payments"]!.AsArray());
        Assert.Empty(treatment["installments"]!.AsArray());
        Assert.Null(treatment["invoice"]);

        // Sin patientId y con un solo paciente, se usa ese.
        var single = await admin.GetJson($"/api/finance/treatments/{treatmentId}/summary");
        Assert.Equal(patientId.ToString(), single.Str("patientId"));

        var patient = await admin.GetJson($"/api/finance/patients/{patientId}/summary");
        Assert.Equal(1, patient!["totalTreatments"]!.GetValue<int>());
        Assert.Equal(20m, patient["totalPaid"]!.GetValue<decimal>());
        Assert.Equal(100m, patient["totalPending"]!.GetValue<decimal>());
        Assert.Equal(1, patient["paymentCount"]!.GetValue<int>());
    }

    [Fact]
    public async Task Resumen_sin_paciente_de_un_tratamiento_con_varios_pacientes_da_400()
    {
        var (admin, _, treatmentId) = await SetupAsync(100);
        var other = await admin.CreatePatientAsync();
        await admin.PostJson("/api/treatment-assignments", new
        {
            treatmentId, patientId = other.Id(), date = TestData.TodayInClinic().Iso(), tooth = "", sourceKey = $"{Guid.NewGuid()}:x", price = 10,
        }, HttpStatusCode.Created);

        var error = await admin.GetJson($"/api/finance/treatments/{treatmentId}/summary", HttpStatusCode.BadRequest);

        Assert.True(error.HasError("patientId"));
    }

    [Fact]
    public async Task El_medico_no_ve_montos()
    {
        var (_, patientId, treatmentId) = await SetupAsync(10);
        var medico = await api.As("medico");

        await medico.GetJson("/api/finance/portfolio", HttpStatusCode.Forbidden);
        await medico.GetJson($"/api/finance/patients/{patientId}/summary", HttpStatusCode.Forbidden);
        await medico.GetJson($"/api/finance/treatments/{treatmentId}/summary", HttpStatusCode.Forbidden);
        await medico.PostJson("/api/finance/payments", Payment(patientId, treatmentId, 1), HttpStatusCode.Forbidden);
        await (await api.As("recepcion")).GetJson("/api/finance/portfolio");
    }

    [Fact]
    public void Estado_de_la_fila()
    {
        Assert.Equal("al_dia", new FinanceTotals(Guid.Empty, Guid.Empty, 100, 100, 1, 1).Status);
        Assert.Equal("parcial", new FinanceTotals(Guid.Empty, Guid.Empty, 100, 30, 1, 1).Status);
        Assert.Equal(0, new FinanceTotals(Guid.Empty, Guid.Empty, 100, 130, 1, 1).Pending);
    }
}
