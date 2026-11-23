using System.Net;
using ClinicApp.Api.Tests.Infrastructure;

namespace ClinicApp.Api.Tests.Integration;

[Collection(ApiCollection.Name)]
public class InventoryOptionsTests(ApiFactory api)
{
    [Fact]
    public async Task Opciones_trae_todos_los_insumos_sin_paginar_y_solo_lo_del_selector()
    {
        var admin = await api.As("admin");
        var stamp = TestData.Next();
        // Más de una página de 100: el selector no debe depender de juntar páginas.
        for (var index = 0; index < 101; index++)
        {
            await admin.PostJson("/api/inventory/items", new
            {
                name = $"Opción {stamp} {index:D3}", category = "Consumibles", unit = "unidad",
                kind = index == 0 ? "instrumental" : "consumible", minStock = 0, unitCost = 1,
            }, HttpStatusCode.Created);
        }

        // El médico también la usa (formulario de tratamientos).
        var options = (await (await api.As("medico")).GetJson("/api/inventory/items/options"))!.AsArray();
        var mine = options.Where(item => item.Str("name").StartsWith($"Opción {stamp} ")).ToList();
        Assert.Equal(101, mine.Count);
        Assert.Equal(mine.Select(item => item.Str("name")).Order(StringComparer.Ordinal), mine.Select(item => item.Str("name")));

        var first = mine[0]!.AsObject();
        Assert.Equal(["id", "name", "unit", "kind"], first.Select(property => property.Key));
        Assert.Equal("instrumental", first.Str("kind"));
        Assert.Equal("unidad", first.Str("unit"));

        Assert.Equal((await admin.GetJson("/api/inventory/items?pageSize=1"))!["totalItems"]!.GetValue<int>(), options.Count);
    }
}
