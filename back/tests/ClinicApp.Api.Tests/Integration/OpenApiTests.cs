using System.Net;
using System.Text.Json.Nodes;
using ClinicApp.Api.Tests.Infrastructure;

namespace ClinicApp.Api.Tests.Integration;

/// <summary>
/// El documento OpenAPI (solo en desarrollo) es la fuente de los tipos del frontend (<c>npm run api:types</c>).
/// </summary>
[Collection(ApiCollection.Name)]
public class OpenApiTests(ApiFactory api)
{
    private static IEnumerable<JsonObject> Schemas(JsonNode? node)
    {
        if (node is JsonObject obj)
        {
            if (obj.ContainsKey("type")) yield return obj;
            foreach (var (_, child) in obj)
                foreach (var schema in Schemas(child)) yield return schema;
        }
        else if (node is JsonArray array)
        {
            foreach (var child in array)
                foreach (var schema in Schemas(child)) yield return schema;
        }
    }

    private static List<string> Types(JsonObject schema) => schema["type"] switch
    {
        JsonArray list => list.Select(item => item!.GetValue<string>()).ToList(),
        JsonValue value when value.TryGetValue<string>(out var single) => [single],
        _ => [],
    };

    [Fact]
    public async Task Los_numeros_se_documentan_solo_como_numeros()
    {
        var response = await api.Anonymous().GetAsync("/openapi/v1.json");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var document = await response.JsonAsync();

        var numeric = Schemas(document).Where(schema => Types(schema).Any(type => type is "integer" or "number")).ToList();

        Assert.NotEmpty(numeric);
        Assert.All(numeric, schema =>
        {
            Assert.DoesNotContain("string", Types(schema));
            Assert.Null(schema["pattern"]);
        });

        // Un caso conocido: el precio de un tratamiento y el total de una página.
        var schemas = document["components"]!["schemas"]!;
        Assert.DoesNotContain("string", Types(schemas["TreatmentDto"]!["properties"]!["price"]!.AsObject()));
        Assert.DoesNotContain("string", Types(schemas["PagedResultOfPatientDto"]!["properties"]!["totalItems"]!.AsObject()));
    }
}
