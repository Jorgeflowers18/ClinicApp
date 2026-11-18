using System.Net.Http.Headers;
using System.Net.Http.Json;
using ClinicApp.Api.Data;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace ClinicApp.Api.Tests.Infrastructure;

/// <summary>
/// Levanta la API completa en memoria contra una base de PostgreSQL <b>solo para pruebas</b>
/// (<c>clinicapp_test</c>, en el mismo contenedor de desarrollo). Al empezar la borra y la vuelve a crear
/// con todas las migraciones, así cada ejecución parte de cero y nunca toca la base de desarrollo.
///
/// La cadena de conexión se puede cambiar con la variable de entorno <c>CLINICAPP_TEST_DB</c>.
/// </summary>
public class ApiFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
    public const string DefaultConnection =
        "Host=localhost;Port=5433;Database=clinicapp_test;Username=clinicapp;Password=clinicapp_dev;Include Error Detail=true";

    public static string ConnectionString =>
        Environment.GetEnvironmentVariable("CLINICAPP_TEST_DB") is { Length: > 0 } value ? value : DefaultConnection;

    /// <summary>Carpeta temporal para los adjuntos de las pruebas (se borra al terminar).</summary>
    public string AttachmentsRoot { get; } = Path.Combine(Path.GetTempPath(), "clinicapp-tests", Guid.NewGuid().ToString("N"));

    private readonly Dictionary<string, string> _tokens = [];
    private readonly SemaphoreSlim _loginLock = new(1, 1);

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        // Development: crea las cuentas de prueba (admin@clinica.com, recepcion@clinica.com, medico@clinica.com)
        // y usa la clave de firma de appsettings.Development.json.
        builder.UseEnvironment("Development");

        // UseSetting (y no ConfigureAppConfiguration): Program.cs lee la cadena de conexión antes de
        // construir la app, y solo estos valores ya están disponibles en ese momento.
        builder.UseSetting("ConnectionStrings:Default", ConnectionString);
        builder.UseSetting("Attachments:RootPath", AttachmentsRoot);
        builder.UseSetting("Notifications:Provider", "log");
        builder.UseSetting("Notifications:DispatchIntervalSeconds", "1");
        builder.UseSetting("Logging:LogLevel:Default", "Warning");
    }

    public async Task InitializeAsync()
    {
        // La base se prepara antes de arrancar la API, porque al arrancar se crean las cuentas de prueba.
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql(ConnectionString)
            .UseSnakeCaseNamingConvention()
            .Options;

        await using var db = new AppDbContext(options);
        await db.Database.EnsureDeletedAsync();
        await db.Database.MigrateAsync();

        _ = Server; // arranca la API
    }

    async Task IAsyncLifetime.DisposeAsync()
    {
        await base.DisposeAsync();
        if (Directory.Exists(AttachmentsRoot)) Directory.Delete(AttachmentsRoot, recursive: true);
    }

    /// <summary>Cliente sin sesión.</summary>
    public HttpClient Anonymous() => CreateClient();

    /// <summary>Cliente con la sesión del rol pedido ("admin", "recepcion" o "medico").</summary>
    public async Task<HttpClient> As(string role)
    {
        var client = CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", await TokenAsync(role));
        return client;
    }

    /// <summary>
    /// Inicia sesión una sola vez por rol y reutiliza el token (dura 15 minutos), para no chocar con el
    /// límite de intentos de login por minuto.
    /// </summary>
    private async Task<string> TokenAsync(string role)
    {
        await _loginLock.WaitAsync();
        try
        {
            if (_tokens.TryGetValue(role, out var cached)) return cached;

            using var client = CreateClient();
            var response = await client.PostAsJsonAsync("/api/auth/login", new { email = $"{role}@clinica.com", password = $"{role}123" });
            response.EnsureSuccessStatusCode();
            var body = await response.Content.ReadFromJsonAsync<LoginBody>();
            return _tokens[role] = body!.AccessToken;
        }
        finally
        {
            _loginLock.Release();
        }
    }

    /// <summary>Contexto de base de datos para preparar o revisar datos directamente.</summary>
    public AsyncServiceScopeDb Db() => new(Services.CreateAsyncScope());

    private sealed record LoginBody(string AccessToken);
}

/// <summary>Un AppDbContext con su scope: <c>await using var scope = factory.Db();</c>.</summary>
public sealed class AsyncServiceScopeDb(AsyncServiceScope scope) : IAsyncDisposable
{
    public AppDbContext Context { get; } = scope.ServiceProvider.GetRequiredService<AppDbContext>();

    public ValueTask DisposeAsync() => scope.DisposeAsync();
}

/// <summary>Todas las pruebas de integración comparten la misma API y la misma base.</summary>
[CollectionDefinition(Name)]
public class ApiCollection : ICollectionFixture<ApiFactory>
{
    public const string Name = "api";
}
