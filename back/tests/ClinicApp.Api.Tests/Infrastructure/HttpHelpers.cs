using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace ClinicApp.Api.Tests.Infrastructure;

/// <summary>Atajos para leer las respuestas JSON de la API en las pruebas.</summary>
public static class HttpHelpers
{
    public static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    /// <summary>Lee el cuerpo como JSON genérico (JsonNode) para revisar campos sin crear clases.</summary>
    public static async Task<JsonNode> JsonAsync(this HttpResponseMessage response)
    {
        var text = await response.Content.ReadAsStringAsync();
        return JsonNode.Parse(text) ?? throw new InvalidOperationException("Respuesta vacía");
    }

    /// <summary>Comprueba el código de estado y, si no coincide, muestra el cuerpo para entender el error.</summary>
    public static async Task<HttpResponseMessage> ShouldBe(this Task<HttpResponseMessage> request, HttpStatusCode expected)
    {
        var response = await request;
        if (response.StatusCode != expected)
        {
            var body = await response.Content.ReadAsStringAsync();
            Assert.Fail($"Se esperaba {(int)expected} {expected} y llegó {(int)response.StatusCode} {response.StatusCode}: {body}");
        }
        return response;
    }

    /// <summary>Envía JSON y comprueba el código. Devuelve el cuerpo como JsonNode (o null si no hay).</summary>
    public static async Task<JsonNode?> SendJson(this HttpClient client, HttpMethod method, string url, object? body, HttpStatusCode expected)
    {
        using var request = new HttpRequestMessage(method, url);
        if (body is not null) request.Content = JsonContent.Create(body, options: Json);
        var response = await client.SendAsync(request);
        var text = await response.Content.ReadAsStringAsync();
        if (response.StatusCode != expected)
        {
            Assert.Fail($"{method} {url}: se esperaba {(int)expected} y llegó {(int)response.StatusCode}: {text}");
        }
        return string.IsNullOrWhiteSpace(text) ? null : JsonNode.Parse(text);
    }

    public static Task<JsonNode?> GetJson(this HttpClient client, string url, HttpStatusCode expected = HttpStatusCode.OK) =>
        client.SendJson(HttpMethod.Get, url, null, expected);

    public static Task<JsonNode?> PostJson(this HttpClient client, string url, object? body, HttpStatusCode expected) =>
        client.SendJson(HttpMethod.Post, url, body, expected);

    public static Task<JsonNode?> PutJson(this HttpClient client, string url, object body, HttpStatusCode expected) =>
        client.SendJson(HttpMethod.Put, url, body, expected);

    public static Task<JsonNode?> PatchJson(this HttpClient client, string url, object body, HttpStatusCode expected) =>
        client.SendJson(HttpMethod.Patch, url, body, expected);

    public static Task<JsonNode?> Delete(this HttpClient client, string url, HttpStatusCode expected) =>
        client.SendJson(HttpMethod.Delete, url, null, expected);

    /// <summary>¿El 400/409 trae un error para este campo? (formato ValidationProblemDetails).</summary>
    public static bool HasError(this JsonNode? body, string field) =>
        body?["errors"]?[field] is JsonArray { Count: > 0 };

    public static string Str(this JsonNode? node, string property) => node?[property]?.GetValue<string>() ?? "";

    public static Guid Id(this JsonNode? node) => Guid.Parse(node.Str("id"));
}

/// <summary>Un TimeProvider que siempre devuelve la misma hora (para pruebas unitarias).</summary>
public sealed class FixedTimeProvider(DateTimeOffset now) : TimeProvider
{
    public DateTimeOffset Now { get; set; } = now;

    public override DateTimeOffset GetUtcNow() => Now;
}
