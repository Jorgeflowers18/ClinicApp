using ClinicApp.Api.Common;
using ClinicApp.Api.Data;
using ClinicApp.Api.Modules.Appointments;
using ClinicApp.Api.Modules.Auth;
using ClinicApp.Api.Modules.ClinicalHistory;
using ClinicApp.Api.Modules.Finance;
using ClinicApp.Api.Modules.Institution;
using ClinicApp.Api.Modules.Inventory;
using ClinicApp.Api.Modules.Notifications;
using ClinicApp.Api.Modules.Reports;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Identity;
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
                Title = Validation.Title,
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
        policy.WithOrigins(allowedOrigins).AllowAnyHeader().AllowAnyMethod()
            .AllowCredentials())); // deja que el navegador mande y guarde la cookie de refresh

// Autenticación con JWT. La configuración (clave de firma, vida de los tokens) está en la sección "Auth".
var authOptions = AuthOptions.Load(builder.Configuration);
builder.Services.AddSingleton(authOptions);
builder.Services.AddSingleton<TokenService>();
builder.Services.AddSingleton<IPasswordHasher<User>, PasswordHasher<User>>();
builder.Services.AddSingleton<IEmailSender, LogEmailSender>();

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.MapInboundClaims = false; // conserva los nombres cortos: "sub", "role", "name"
        options.TokenValidationParameters = new()
        {
            ValidIssuer = authOptions.Issuer,
            ValidAudience = authOptions.Audience,
            IssuerSigningKey = authOptions.GetSigningKey(),
            NameClaimType = AuthClaims.Name,
            RoleClaimType = AuthClaims.Role,
            ClockSkew = TimeSpan.FromSeconds(30),
        };
    });

// Por defecto TODOS los endpoints piden sesión. Los públicos lo dicen con [AllowAnonymous].
// Cada controlador indica además qué roles pueden usarlo (tabla en backlog.md § Transversal).
builder.Services.AddAuthorizationBuilder()
    .SetFallbackPolicy(new AuthorizationPolicyBuilder().RequireAuthenticatedUser().Build());

builder.Services.AddClinicRateLimits();

// "Hoy" y conversión de horas en la zona horaria de la clínica (Clinic:TimeZone).
// TimeProvider permite que las pruebas simulen otra fecha.
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddSingleton<ClinicClock>();

// Inventario: la única pieza que cambia el stock (entradas, salidas FEFO).
// Scoped = una por petición, igual que el AppDbContext que usa.
builder.Services.AddScoped<StockService>();

// Agenda: candados y choques de horario. Crear o cancelar una cita deja su notificación pendiente.
builder.Services.AddScoped<AvailabilityService>();
builder.Services.AddScoped<IAppointmentEvents, AppointmentNotifications>();

// Notificaciones: el proveedor de envío (Notifications:Provider) está por elegir; "log" solo escribe en el log.
// Sin proveedor no se registran notificaciones. La tarea en segundo plano envía las pendientes y los recordatorios.
var notificationSettings = new NotificationSettings(builder.Configuration);
builder.Services.AddSingleton(notificationSettings);
switch (notificationSettings.Provider)
{
    case "" or "log":
        builder.Services.AddSingleton<INotificationSender, LogNotificationSender>();
        break;
    default:
        throw new InvalidOperationException($"Notifications:Provider \"{notificationSettings.Provider}\" no existe. Valores: \"log\" o vacío.");
}
builder.Services.AddScoped<NotificationComposer>();
builder.Services.AddSingleton<NotificationDispatcher>();
builder.Services.AddHostedService(services => services.GetRequiredService<NotificationDispatcher>());

// Finanzas: totales de la cartera calculados en la base.
builder.Services.AddScoped<FinanceCalculator>();

// Reportes: consultas agrupadas en la base.
builder.Services.AddScoped<ReportQueries>();

// Historia clínica: archivos en disco (Attachments:RootPath), nombres del catálogo para mostrar e imprimir,
// y la tarea que borra los adjuntos nunca guardados (y el protocolo de conservación, apagado por defecto).
builder.Services.AddSingleton<AttachmentStorage>();
builder.Services.AddScoped<ReferenceResolver>();
builder.Services.AddSingleton<AttachmentCleanupService>();
builder.Services.AddHostedService(services => services.GetRequiredService<AttachmentCleanupService>());

// En producción la API está detrás de nginx, que atiende el HTTPS y le pasa la petición por HTTP.
// nginx avisa en encabezados cuál era el esquema original (https) y la IP del cliente.
// Solo se confía en esos encabezados si vienen de la misma máquina (127.0.0.1), que es donde está nginx.
builder.Services.Configure<ForwardedHeadersOptions>(options =>
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto);

// Chequeo de salud: GET /api/health responde "Healthy" (200) si la API llega a la base,
// o "Unhealthy" (503) si no.
builder.Services.AddHealthChecks().AddDbContextCheck<AppDbContext>("database");

// Descripción OpenAPI de todos los endpoints (/openapi/v1.json).
builder.Services.AddOpenApi(options => options.AddDocumentTransformer<BearerSecuritySchemeTransformer>());

var app = builder.Build();

// Se crea al arrancar para que una zona horaria mal escrita detenga la API de inmediato.
app.Services.GetRequiredService<ClinicClock>();

// ───────────────────────── 2. PIPELINE ─────────────────────────
// El orden importa: cada petición pasa por estas piezas de arriba abajo.

app.UseForwardedHeaders();      // primero, para que todo lo demás vea el esquema y la IP reales
app.UseExceptionHandler();      // atrapa cualquier excepción y responde 500 en formato ProblemDetails
app.UseStatusCodePages();       // da cuerpo ProblemDetails a los errores vacíos (ruta inexistente, 405...)

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi().AllowAnonymous();
    app.MapScalarApiReference().AllowAnonymous(); // página para probar los endpoints: http://localhost:5000/scalar
}

// Sin UseHttpsRedirection: en producción nginx redirige http → https y en desarrollo se usa http.

app.UseCors(FrontendCorsPolicy);

app.UseRateLimiter();
app.UseAuthentication();   // lee el JWT del encabezado Authorization y arma el usuario (User)
app.UseAuthorization();    // decide si ese usuario puede usar el endpoint: 401 sin sesión, 403 sin el rol

app.MapHealthChecks("/api/health").AllowAnonymous();
app.MapControllers();

await app.SeedUsersAsync();
await app.SeedCatalogsAsync();
await app.SeedInstitutionAsync();

app.Run();

/// <summary>Visible para el proyecto de pruebas (WebApplicationFactory&lt;Program&gt;).</summary>
public partial class Program;
