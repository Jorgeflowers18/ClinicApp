using System.ComponentModel.DataAnnotations;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using ClinicApp.ErrorHandling;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Hosting.Server;
using Microsoft.AspNetCore.Hosting.Server.Features;

var builder = WebApplication.CreateBuilder(args);
builder.WebHost.UseUrls("http://127.0.0.1:0");
builder.Logging.ClearProviders();
builder.Services.AddControllers();
builder.Services.AddClinicAppErrors();
await using var app = builder.Build();
app.UseClinicAppErrors();
app.MapControllers();
// These are test fixtures only, never production domain endpoints.
app.MapGet("/checks/internal", () => Task.FromException(new InvalidOperationException("SELECT password FROM patients at C:\\private\\db")));
app.MapGet("/checks/domain/{status:int}/{code}", (int status, string code) => Task.FromException(new ApiFailure(status, code, "Revisa los datos de esta operación.", recordId: "item-1")));
app.MapGet("/checks/forbidden", () => Results.StatusCode(403));
await app.StartAsync();
var address = app.Services.GetRequiredService<IServer>().Features.Get<IServerAddressesFeature>()!.Addresses.Single();
using var client = new HttpClient { BaseAddress = new Uri(address) };
int passed = 0;
void Check(bool condition, string name) { if (!condition) throw new Exception("FAILED: " + name); passed++; }
foreach (var (status, code, kind) in new[] {
    (400,"BUSINESS_RULE","business"), (409,"DUPLICATE_RECORD","duplicate"), (404,"NOT_FOUND","not-found"),
    (409,"UPDATE_CONFLICT","conflict"), (401,"UNAUTHENTICATED","authentication"), (403,"FORBIDDEN","authorization"),
    (507,"STORAGE_ERROR","storage") })
{
    using var response = await client.GetAsync($"/checks/domain/{status}/{code}");
    var json = await response.Content.ReadFromJsonAsync<JsonElement>();
    Check((int)response.StatusCode == status && json.GetProperty("kind").GetString() == kind, kind);
    Check(json.GetProperty("traceId").GetString() == response.Headers.GetValues("X-Request-ID").Single(), "trace correlation");
}
using (var response = await client.PostAsJsonAsync("/checks/model", new { name = "", rows = new[] { new { quantity = 0 } } }))
{
    var json = await response.Content.ReadFromJsonAsync<JsonElement>();
    Check(response.StatusCode == HttpStatusCode.BadRequest && json.GetProperty("code").GetString() == "VALIDATION_ERROR", "MVC validation");
    Check(json.GetProperty("errors").GetArrayLength() == 2, "all errors including dynamic row");
    Check(response.Content.Headers.ContentType?.MediaType == "application/problem+json", "problem media type");
}
using (var response = await client.GetAsync("/checks/internal"))
{
    var body = await response.Content.ReadAsStringAsync();
    Check(response.StatusCode == HttpStatusCode.InternalServerError, "internal status");
    Check(!body.Contains("SELECT") && !body.Contains("password") && !body.Contains("private"), "no sensitive details");
}
using (var response = await client.GetAsync("/checks/forbidden"))
    Check((await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("kind").GetString() == "authorization", "empty forbidden response");
using (var response = await client.GetAsync("/checks/missing"))
    Check((await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("kind").GetString() == "not-found", "missing endpoint");
Console.WriteLine($"{passed} backend checks passed.");
await app.StopAsync();

[ApiController, Route("checks/model")]
public class CheckController : ControllerBase
{
    [HttpPost] public IActionResult Save(CheckInput input) => Ok(input);
}
public sealed class CheckInput
{
    [Required(ErrorMessage = "Escribe el nombre.")] public string? Name { get; init; }
    public CheckRow[] Rows { get; init; } = [];
}
public sealed class CheckRow
{
    [Range(1, 100, ErrorMessage = "La cantidad debe ser mayor que cero.")] public int Quantity { get; init; }
}
