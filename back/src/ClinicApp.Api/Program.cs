using ClinicApp.Api.Common;
using ClinicApp.Api.Data;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding.Metadata;
using Microsoft.EntityFrameworkCore;
using Scalar.AspNetCore;

var builder = WebApplication.CreateBuilder(args);

// ───────────────────────── 1. SERVICIOS ─────────────────────────

// Base de datos: la cadena de conexión sale de appsettings.Development.json en desarrollo
// y de la variable de entorno ConnectionStrings__Default en producción.
var connectionString = builder.Configuration.GetConnectionString("Default")
    ?? throw new InvalidOperationException("Falta la cadena de conexión 'ConnectionStrings:Default'.");

builder.Services.AddDbContext<AppDbContext>(options =>
    options
        .UseNpgsql(connectionString)
        .UseSnakeCaseNamingConvention()); // Treatments → treatments, DurationMinutes → duration_minutes

builder.Services
    .AddControllers(options =>
    {
        // Los errores de validación usan los nombres del JSON ("name", no "Name"),
        // que son los nombres de los campos en los formularios del frontend.
        options.ModelMetadataDetailsProviders.Add(new SystemTextJsonValidationMetadataProvider());
    })
    .ConfigureApiBehaviorOptions(options =>
    {
        // Respuesta 400 cuando falla la validación: ValidationProblemDetails con el título en español.
        // El frontend (shared/lib/http.ts) muestra el título y marca cada campo de "errors".
        options.InvalidModelStateResponseFactory = context =>
            new BadRequestObjectResult(new ValidationProblemDetails(context.ModelState)
            {
                Title = "Revisa los datos ingresados",
                Status = StatusCodes.Status400BadRequest,
            });
    });

// Todas las respuestas de error en formato ProblemDetails, con títulos en español
// y sin detalles internos en producción (ver Common/ProblemDetailsSetup.cs).
builder.Services.AddProblemDetails(options => options.CustomizeProblemDetails = ProblemDetailsSetup.Customize);

// CORS: el navegador solo deja que el frontend (otro origen: localhost:5173) llame a la API
// si la API lo autoriza explícitamente. Los orígenes permitidos se leen de la configuración.
const string FrontendCorsPolicy = "Frontend";
var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];

builder.Services.AddCors(options =>
    options.AddPolicy(FrontendCorsPolicy, policy =>
        policy.WithOrigins(allowedOrigins).AllowAnyHeader().AllowAnyMethod()));

// En producción la API está detrás de nginx, que atiende el HTTPS y le pasa la petición por HTTP.
// nginx avisa en encabezados cuál era el esquema original (https) y la IP del cliente.
// Solo se confía en esos encabezados si vienen de la misma máquina (127.0.0.1), que es donde está nginx.
builder.Services.Configure<ForwardedHeadersOptions>(options =>
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto);

// Chequeo de salud: GET /api/health responde "Healthy" (200) si la API llega a la base,
// o "Unhealthy" (503) si no.
builder.Services.AddHealthChecks().AddDbContextCheck<AppDbContext>("database");

// Descripción OpenAPI de todos los endpoints (/openapi/v1.json).
builder.Services.AddOpenApi();

var app = builder.Build();

// ───────────────────────── 2. PIPELINE ─────────────────────────
// El orden importa: cada petición pasa por estas piezas de arriba abajo.

app.UseForwardedHeaders();      // primero, para que todo lo demás vea el esquema y la IP reales
app.UseExceptionHandler();      // atrapa cualquier excepción y responde 500 en formato ProblemDetails
app.UseStatusCodePages();       // da cuerpo ProblemDetails a los errores vacíos (ruta inexistente, 405...)

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.MapScalarApiReference(); // página para probar los endpoints: http://localhost:5000/scalar
}

// Sin UseHttpsRedirection: en producción nginx redirige http → https y en desarrollo se usa http.

app.UseCors(FrontendCorsPolicy);

app.UseAuthorization();

app.MapHealthChecks("/api/health");
app.MapControllers();

app.Run();
