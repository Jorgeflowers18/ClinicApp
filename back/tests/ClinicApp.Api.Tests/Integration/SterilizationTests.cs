using System.Net;
using ClinicApp.Api.Tests.Infrastructure;

namespace ClinicApp.Api.Tests.Integration;

[Collection(ApiCollection.Name)]
public class SterilizationTests(ApiFactory api)
{
    private async Task<object> CycleBodyAsync(HttpClient client, DateOnly date)
    {
        var item = await client.PostJson("/api/inventory/items", new
        {
            name = $"Pinza {TestData.Next()}",
            category = "Instrumental",
            unit = "unidad",
            kind = "instrumental",
            minStock = 0,
            unitCost = 10,
        }, HttpStatusCode.Created);

        return new
        {
            itemIds = new[] { item.Id() },
            performedAt = date.Iso(),
            result = "aprobado",
            responsibleProfessionalId = await client.ProfessionalIdAsync(),
        };
    }

    [Fact]
    public async Task Hoy_en_la_clinica_se_acepta_y_manana_se_rechaza()
    {
        var client = await api.As("admin");
        var today = TestData.TodayInClinic();

        await client.PostJson("/api/inventory/sterilization-cycles", await CycleBodyAsync(client, today), HttpStatusCode.Created);

        var error = await client.PostJson("/api/inventory/sterilization-cycles", await CycleBodyAsync(client, today.AddDays(1)), HttpStatusCode.BadRequest);
        Assert.True(error.HasError("performedAt"));
    }
}
