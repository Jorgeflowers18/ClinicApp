# Tutorial — Fase 0: cimientos de la API

Guía paso a paso para crear la API de ClinicApp desde cero con .NET 10 y PostgreSQL. Cada lección explica qué se hace y por qué. Las decisiones de tecnología están en [`documentacion/decisiones-backend.md`](../../documentacion/decisiones-backend.md).

| Lección | Contenido | Estado |
|---|---|---|
| 1 | Herramientas, solución y proyecto Web API | ✅ |
| 2 | Base de datos PostgreSQL en Docker | ✅ |
| 3 | Entity Framework Core: conexión, primera tabla (`treatments`) y primera migración | ✅ |
| 4 | Endpoints del catálogo de tratamientos: controlador, DTO, validación, paginación y CORS | ✅ |
| 5 | Errores inesperados (500) en el formato del frontend, HTTPS y configuración de producción | ✅ |
| 6 | Usuarios, contraseñas, roles y JWT (`auth`) | Pendiente |

---

## Lección 1: herramientas, solución y proyecto Web API

### 1.1 Herramientas necesarias

| Herramienta | Para qué | Cómo comprobarla |
|---|---|---|
| **SDK de .NET 10** | Compilar y ejecutar la API. Incluye el comando `dotnet`. | `dotnet --list-sdks` debe mostrar `10.0.x` |
| **Docker Desktop** | Correr PostgreSQL sin instalarlo en Windows. | `docker --version` |
| **Editor** | VS Code con la extensión **C# Dev Kit**, o Visual Studio 2026 / Rider. | — |

Instalación del SDK en Windows (pide permisos de administrador):

```powershell
winget install --id Microsoft.DotNet.SDK.10 --exact
```

> **SDK y runtime.** El **SDK** sirve para *desarrollar* (compilar, crear proyectos, migraciones). El **runtime** solo sirve para *ejecutar* una aplicación ya compilada. En tu PC va el SDK; en el servidor basta el runtime de ASP.NET Core.

### 1.2 Fijar la versión del SDK: `global.json`

En la PC hay dos SDK instalados (9 y 10). Para que la carpeta `back/` use siempre el 10:

```bash
cd back
dotnet new globaljson --sdk-version 10.0.404 --roll-forward latestFeature
```

Crea `back/global.json`:

```json
{ "sdk": { "rollForward": "latestFeature", "version": "10.0.404" } }
```

`latestFeature` permite usar cualquier SDK `10.0.x` más nuevo que se instale, pero nunca saltar al 11. Así Jorge y Josue compilan con la misma versión aunque tengan otros SDK instalados.

### 1.3 Crear la solución

```bash
dotnet new sln -n ClinicApp
```

Crea `ClinicApp.slnx`. Una **solución** es solo un índice de proyectos: no tiene código. Sirve para que el editor y `dotnet build` sepan qué proyectos forman el sistema (más adelante puede haber un proyecto de pruebas). Desde .NET 10 el formato es `.slnx` (XML corto y legible) en lugar del antiguo `.sln`.

### 1.4 Crear el proyecto Web API

```bash
dotnet new webapi -n ClinicApp.Api -o src/ClinicApp.Api --use-controllers
dotnet sln ClinicApp.slnx add src/ClinicApp.Api/ClinicApp.Api.csproj
```

- `webapi` es la plantilla de API REST de ASP.NET Core.
- `-n` es el nombre del proyecto; `-o` la carpeta donde se crea.
- `--use-controllers` crea la API con **controladores** (una clase por recurso) en lugar de *Minimal APIs* (endpoints sueltos en `Program.cs`). Es la decisión tomada: más ordenado para un sistema con muchos módulos.
- La segunda línea agrega el proyecto a la solución.

### 1.5 `.gitignore` de .NET

```bash
dotnet new gitignore
```

Excluye del repositorio las carpetas `bin/` y `obj/` (resultados de compilar, se regeneran solas), archivos del editor y el `.env` con contraseñas.

### 1.6 Qué generó la plantilla

```text
back/
├── ClinicApp.slnx                     ← la solución
├── global.json                        ← versión del SDK
├── docker-compose.yml                 ← la base de datos (lección 2)
└── src/ClinicApp.Api/
    ├── ClinicApp.Api.csproj           ← el proyecto: versión de .NET y paquetes
    ├── Program.cs                     ← punto de entrada: configura y arranca la API
    ├── appsettings.json               ← configuración general
    ├── appsettings.Development.json   ← configuración que solo aplica en desarrollo
    ├── Properties/launchSettings.json ← cómo se ejecuta en tu PC (puertos)
    ├── ClinicApp.Api.http             ← peticiones de prueba para el editor
    ├── Controllers/WeatherForecastController.cs  ← endpoint de ejemplo
    └── WeatherForecast.cs                        ← modelo de ejemplo
```

**`ClinicApp.Api.csproj`** — el equivalente a `package.json` del frontend:

```xml
<Project Sdk="Microsoft.NET.Sdk.Web">
  <PropertyGroup>
    <TargetFramework>net10.0</TargetFramework>   <!-- versión de .NET -->
    <Nullable>enable</Nullable>                  <!-- el compilador avisa si algo puede ser null -->
    <ImplicitUsings>enable</ImplicitUsings>      <!-- importa automáticamente los namespaces comunes -->
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="Microsoft.AspNetCore.OpenApi" Version="10.0.15" />  <!-- un paquete NuGet -->
  </ItemGroup>
</Project>
```

Los paquetes vienen de **NuGet** (el «npm» de .NET) y se agregan con `dotnet add package <Nombre>`.

**`Program.cs`** — tiene dos mitades, y entender esto es la base de todo ASP.NET Core:

```csharp
var builder = WebApplication.CreateBuilder(args);

// ── 1. SERVICIOS: qué piezas tiene la aplicación ──
builder.Services.AddControllers();   // habilita los controladores
builder.Services.AddOpenApi();       // genera la descripción de los endpoints

var app = builder.Build();

// ── 2. PIPELINE: por dónde pasa cada petición, en orden ──
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();                // publica /openapi/v1.json solo en desarrollo
}
app.UseHttpsRedirection();
app.UseAuthorization();
app.MapControllers();                // conecta las rutas con los controladores

app.Run();
```

1. **Servicios** (`builder.Services.Add…`): se registran las piezas que la aplicación va a usar (controladores, base de datos, autenticación…). Esto se llama **inyección de dependencias**: luego cualquier controlador pide lo que necesita en su constructor y .NET se lo entrega.
2. **Pipeline** (`app.Use…` / `app.Map…`): cada petición HTTP pasa por estos pasos en orden, como una cadena (*middleware*). El orden importa: por ejemplo, la autenticación tiene que ir antes de la autorización.

**El controlador de ejemplo** muestra la forma de todo endpoint:

```csharp
[ApiController]                 // activa validación automática y errores 400 estándar
[Route("[controller]")]         // ruta = nombre de la clase sin "Controller" → /weatherforecast
public class WeatherForecastController : ControllerBase
{
    [HttpGet]                   // responde a GET
    public IEnumerable<WeatherForecast> Get() { … }   // lo que devuelve se convierte en JSON
}
```

ASP.NET Core convierte la respuesta a JSON en *camelCase* (`temperatureC`), igual que espera el frontend.

### 1.7 Puerto de desarrollo

En `Properties/launchSettings.json` se cambió el puerto `5280` que eligió la plantilla por **`5000`** (y `5001` para HTTPS), porque el frontend llama a `http://localhost:5000/api`.

### 1.8 Compilar y ejecutar

```bash
dotnet build                                            # compila toda la solución
dotnet run --project src/ClinicApp.Api --launch-profile http   # arranca la API
```

La consola muestra `Now listening on: http://localhost:5000`. Para probar:
- `http://localhost:5000/weatherforecast` en el navegador → JSON con 5 pronósticos al azar.
- `http://localhost:5000/openapi/v1.json` → la descripción de todos los endpoints.
- O abre `ClinicApp.Api.http` en el editor y pulsa **Send Request** sobre la petición.

Para detenerla: `Ctrl + C` en la consola.

> **Aviso esperado:** `Failed to determine the https port for redirect`. Sale porque el perfil `http` no tiene puerto HTTPS y `UseHttpsRedirection()` no sabe adónde redirigir. Lo ajustaremos en la lección 5: en producción el HTTPS lo pone nginx.

El controlador `WeatherForecast` es solo de ejemplo; se elimina en la lección 4, cuando exista el primer endpoint real.

---

## Lección 2: base de datos PostgreSQL en Docker

### 2.1 Por qué Docker

Docker corre programas dentro de **contenedores**: cajas aisladas que traen todo lo que el programa necesita. Así PostgreSQL no se instala en Windows: se baja una **imagen** (la plantilla, `postgres:17-alpine`) y se crea un contenedor a partir de ella. Se levanta cuando se necesita y se apaga cuando no, sin dejar nada instalado en la PC. Además, Jorge, Josue y el servidor usan exactamente la misma versión.

### 2.2 El archivo `back/docker-compose.yml`

**Docker Compose** describe en un archivo qué contenedores forman el proyecto, para no tener que escribir comandos largos.

```yaml
name: clinicapp                      # nombre del proyecto en Docker

services:
  db:                                # el servicio "db": la base de datos
    image: postgres:17-alpine        # PostgreSQL 17 sobre Alpine Linux (imagen liviana)
    container_name: clinicapp-db     # nombre fijo del contenedor
    restart: unless-stopped          # se reinicia solo, salvo que lo detengas tú
    environment:                     # variables que la imagen usa al crear la base
      POSTGRES_DB: ${POSTGRES_DB:-clinicapp}             # nombre de la base
      POSTGRES_USER: ${POSTGRES_USER:-clinicapp}         # usuario
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-clinicapp_dev}
      TZ: America/Guayaquil
    ports:
      - "${POSTGRES_PORT:-5433}:5432"   # puerto de tu PC : puerto dentro del contenedor
    volumes:
      - clinicapp-pgdata:/var/lib/postgresql/data   # dónde se guardan los datos
    healthcheck:                     # Docker comprueba cada 5 s si la base acepta conexiones
      test: ["CMD-SHELL", "pg_isready -U $${POSTGRES_USER} -d $${POSTGRES_DB}"]

volumes:
  clinicapp-pgdata:                  # volumen con nombre, administrado por Docker
```

**Tres ideas clave:**
- **`${POSTGRES_PASSWORD:-clinicapp_dev}`** lee la variable del archivo `back/.env`; si no existe, usa el valor después de `:-`. El `.env` no se sube al repositorio (está en `.gitignore`); `.env.example` sí, como modelo.
- **Puertos `5433:5432`:** dentro del contenedor PostgreSQL escucha en su puerto normal, el 5432. Hacia tu PC se publica en el **5433**, porque otros proyectos de la PC ya usan el 5432.
- **Volumen:** un contenedor se puede borrar y volver a crear en cualquier momento. Los datos no viven en el contenedor sino en el **volumen** `clinicapp-pgdata`, que sobrevive. Por eso apagar o recrear el contenedor no borra los datos.

### 2.3 Comandos del día a día

Todos se ejecutan desde la carpeta `back/`, con Docker Desktop abierto:

| Comando | Qué hace |
|---|---|
| `cp .env.example .env` | Solo la primera vez: crea el archivo de credenciales. |
| `docker compose up -d` | Levanta la base (`-d`: en segundo plano). La primera vez descarga la imagen. |
| `docker compose ps` | Estado: debe decir `healthy`. |
| `docker compose logs db` | Mensajes de PostgreSQL, por si algo falla. |
| `docker compose stop` | Apaga la base. **Los datos se conservan.** |
| `docker compose down` | Apaga y borra el contenedor. **Los datos se conservan** (siguen en el volumen). |
| `docker compose down -v` | Borra también el volumen: **se pierden todos los datos.** Solo para empezar de cero. |

> **Error frecuente:** `open //./pipe/dockerDesktopLinuxEngine: The system cannot find the file specified` significa que **Docker Desktop no está abierto**. Ábrelo, espera a que diga *Engine running* y repite el comando.

### 2.4 Entrar a la base

Con la consola de PostgreSQL que trae el propio contenedor:

```bash
docker exec -it clinicapp-db psql -U clinicapp -d clinicapp
```

Dentro de `psql`: `\dt` lista las tablas, `\d treatments` muestra las columnas de una tabla, `\q` sale.

Con un programa gráfico (**pgAdmin** o **DBeaver**), crea una conexión con: servidor `localhost`, puerto `5433`, base `clinicapp`, usuario `clinicapp`, contraseña `clinicapp_dev`.

---

## Lección 3: Entity Framework Core, primera tabla y primera migración

**Entity Framework Core (EF Core)** es el ORM de .NET: traduce entre clases de C# y tablas de la base de datos. Escribes una clase `Treatment` y EF Core crea la tabla `treatments`; consultas con C# y EF Core escribe el SQL.

La primera tabla es el **catálogo de tratamientos**, del módulo `treatments` ([`backlog-desgloce.md` § 5](../backlog-desgloce.md#5-treatments)).

### 3.1 Paquetes NuGet

```bash
cd back
dotnet add src/ClinicApp.Api package Npgsql.EntityFrameworkCore.PostgreSQL --version 10.0.3
dotnet add src/ClinicApp.Api package Microsoft.EntityFrameworkCore.Design --version 10.0.15
dotnet add src/ClinicApp.Api package EFCore.NamingConventions --version 10.0.1
```

| Paquete | Para qué |
|---|---|
| `Npgsql.EntityFrameworkCore.PostgreSQL` | El «traductor» de EF Core para PostgreSQL. Trae EF Core consigo. |
| `Microsoft.EntityFrameworkCore.Design` | Lo usa la herramienta de migraciones al generar código. No se publica con la API. |
| `EFCore.NamingConventions` | Nombra tablas y columnas en `snake_case` (`duration_minutes`), la convención de PostgreSQL. |

> **Versiones:** NuGet ya ofrece EF Core 11, pero corresponde a .NET 11. Siempre se usa la misma versión mayor que el proyecto: **.NET 10 → EF Core 10**. Para ver las disponibles: `dotnet package search <Paquete> --exact-match`.

### 3.2 La herramienta `dotnet-ef`

```bash
dotnet new tool-manifest
dotnet tool install dotnet-ef --version 10.0.15
```

`dotnet-ef` es el comando que crea y aplica migraciones. Se instala como **herramienta local**: queda anotada en `back/dotnet-tools.json`, y quien clone el repositorio la instala con `dotnet tool restore`, con la misma versión.

### 3.3 La entidad: `Modules/Treatments/Treatment.cs`

Una **entidad** es una clase cuyas propiedades son las columnas de una tabla:

```csharp
public class Treatment
{
    public Guid Id { get; set; }              // clave primaria (EF la reconoce por llamarse Id)
    public string Name { get; set; } = "";
    public string Category { get; set; } = "";
    public string? Description { get; set; }  // "?" = opcional → la columna admite NULL
    public int DurationMinutes { get; set; }
    public decimal Price { get; set; }        // decimal para dinero, nunca double
    public bool Active { get; set; } = true;
    public DateTime CreatedAt { get; set; }   // siempre en UTC
}
```

- **`{ get; set; }`** declara una *propiedad*: un campo que se puede leer y escribir.
- **`string?`**: con `<Nullable>enable</Nullable>` en el `.csproj`, un `string` sin `?` nunca puede ser `null`. EF Core usa eso para decidir si la columna es `NOT NULL`.
- **`Guid`** es un UUID. Si al guardar el `Id` está vacío, EF Core lo genera.
- Los insumos que consume cada tratamiento se agregan cuando exista la tabla de insumos (módulo de inventario).

### 3.4 La configuración: `Modules/Treatments/TreatmentConfiguration.cs`

Lo que EF Core no puede deducir de la clase se indica aparte:

```csharp
public class TreatmentConfiguration : IEntityTypeConfiguration<Treatment>
{
    public void Configure(EntityTypeBuilder<Treatment> builder)
    {
        builder.Property(treatment => treatment.Name).HasMaxLength(120);   // varchar(120)
        builder.Property(treatment => treatment.Category).HasMaxLength(80);
        builder.Property(treatment => treatment.Description).HasMaxLength(1000);
        builder.Property(treatment => treatment.Price).HasPrecision(10, 2); // numeric(10,2)
    }
}
```

`treatment => treatment.Name` es una **lambda**: una función corta que aquí le dice a EF Core «la propiedad `Name`». Sin `HasMaxLength`, el texto sería ilimitado.

### 3.5 El `DbContext`: `Data/AppDbContext.cs`

El `DbContext` representa la base de datos en el código. Cada `DbSet` es una tabla:

```csharp
public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<Treatment> Treatments => Set<Treatment>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);
    }
}
```

- **`(DbContextOptions<AppDbContext> options)`** junto al nombre de la clase es un **constructor primario**: la clase recibe las opciones (a qué base conectarse) y se las pasa a `DbContext`. Esas opciones se configuran en `Program.cs`.
- **`ApplyConfigurationsFromAssembly`** busca todas las clases de configuración del proyecto, como `TreatmentConfiguration`, sin tener que listarlas a mano.

### 3.6 La cadena de conexión

En `appsettings.Development.json`:

```json
"ConnectionStrings": {
  "Default": "Host=localhost;Port=5433;Database=clinicapp;Username=clinicapp;Password=clinicapp_dev"
}
```

Son los mismos datos del `docker-compose.yml`. Esta contraseña es solo de desarrollo. En producción la cadena **no se escribe en archivos del repositorio**: se pasa como variable de entorno `ConnectionStrings__Default` (el doble guion bajo equivale a entrar en la sección `ConnectionStrings`).

### 3.7 Registrar la base de datos en `Program.cs`

En la mitad de **servicios**:

```csharp
var connectionString = builder.Configuration.GetConnectionString("Default")
    ?? throw new InvalidOperationException("Falta la cadena de conexión 'ConnectionStrings:Default'.");

builder.Services.AddDbContext<AppDbContext>(options =>
    options
        .UseNpgsql(connectionString)
        .UseSnakeCaseNamingConvention());
```

- **`??`** significa «si lo de la izquierda es `null`, haz lo de la derecha». Si falta la cadena, la API se niega a arrancar con un mensaje claro, en lugar de fallar más tarde.
- **`AddDbContext`** registra `AppDbContext` en la inyección de dependencias. Desde ahora cualquier controlador puede pedirlo en su constructor. .NET crea un `AppDbContext` nuevo por cada petición HTTP y lo cierra al terminar.

### 3.8 Crear la migración

Una **migración** es un archivo de C# con los cambios del esquema desde la migración anterior. Se guarda en el repositorio: así la base de Josue, la tuya y la del servidor se construyen igual.

```bash
dotnet ef migrations add CrearTratamientos --project src/ClinicApp.Api --output-dir Data/Migrations
```

EF Core compara las entidades con la última migración y genera tres archivos en `Data/Migrations/`:

| Archivo | Qué es |
|---|---|
| `…_CrearTratamientos.cs` | **Léelo siempre antes de aplicarlo.** `Up()` aplica el cambio; `Down()` lo deshace. |
| `…_CrearTratamientos.Designer.cs` | Metadatos para EF Core. No se edita. |
| `AppDbContextModelSnapshot.cs` | Foto del modelo actual, para calcular la próxima migración. No se edita. |

El `Up()` generado:

```csharp
migrationBuilder.CreateTable(
    name: "treatments",
    columns: table => new
    {
        id = table.Column<Guid>(type: "uuid", nullable: false),
        name = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
        description = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
        price = table.Column<decimal>(type: "numeric(10,2)", precision: 10, scale: 2, nullable: false),
        created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
        // …
    },
    constraints: table => table.PrimaryKey("pk_treatments", x => x.id));
```

Se ve cada decisión de las clases: `string?` → `nullable: true`, `HasMaxLength(120)` → `varchar(120)`, `HasPrecision(10, 2)` → `numeric(10,2)`, nombres en `snake_case`.

### 3.9 Aplicar la migración

Con la base levantada (`docker compose up -d`):

```bash
dotnet ef database update --project src/ClinicApp.Api
```

EF Core se conecta con la cadena de conexión, ve qué migraciones faltan y las ejecuta. Para comprobarlo:

```bash
docker exec clinicapp-db psql -U clinicapp -d clinicapp -c "\d treatments"
```

Además de `treatments` aparece la tabla `__EFMigrationsHistory`: ahí EF Core anota qué migraciones ya se aplicaron, para no repetirlas.

### 3.10 Comandos de migraciones

| Comando | Qué hace |
|---|---|
| `dotnet ef migrations add <Nombre>` | Crea una migración con los cambios del modelo. Nombre en PascalCase que describa el cambio. |
| `dotnet ef migrations remove` | Borra la **última** migración, solo si todavía no se aplicó. |
| `dotnet ef database update` | Aplica las migraciones pendientes. |
| `dotnet ef database update <Nombre>` | Vuelve la base a esa migración (ejecuta los `Down()`). |
| `dotnet ef migrations list` | Lista las migraciones y cuáles faltan aplicar. |

> **Regla de oro:** una migración que ya está en `main` (o aplicada en el servidor) **no se edita ni se borra**. Si algo quedó mal, se corrige con una migración nueva. Tú y Josue van a crear migraciones en paralelo: antes de crear una, haz `git pull` para partir de la última.

---

## Lección 4: endpoints del catálogo de tratamientos

Objetivo: los cinco endpoints que el frontend ya llama desde `front/src/modules/treatments/api/treatments.api.ts`.

| Método y ruta | Qué hace | Respuesta |
|---|---|---|
| `GET /api/treatments?page&pageSize&search` | Lista paginada, con búsqueda por nombre o categoría | `200` + `{ items, page, pageSize, totalItems, totalPages }` |
| `GET /api/treatments?active=true` | Todos los activos, sin paginar | `200` + arreglo |
| `GET /api/treatments/{id}` | Un tratamiento | `200`, o `404` |
| `POST /api/treatments` | Crear | `201` + el tratamiento, o `400` |
| `PUT /api/treatments/{id}` | Editar | `200` + el tratamiento, `400` o `404` |
| `DELETE /api/treatments/{id}` | Eliminar | `204`, o `404` |

Archivos nuevos:

```text
src/ClinicApp.Api/
├── Common/Paging.cs                          ← paginación, compartida por todos los módulos
└── Modules/Treatments/
    ├── Treatment.cs                          ← entidad (lección 3)
    ├── TreatmentConfiguration.cs             ← configuración de la tabla (lección 3)
    ├── TreatmentDtos.cs                      ← lo que entra y sale por la API
    └── TreatmentsController.cs               ← los endpoints
```

Se borró el ejemplo `WeatherForecast` y la carpeta `Controllers/`: cada controlador vive en la carpeta de su módulo.

### 4.1 Entidad y DTO: por qué son clases distintas

Un **DTO** (*Data Transfer Object*) es la forma de los datos que viajan por la API. La **entidad** es la forma de la tabla. Se separan porque:

- **El contrato no depende de la tabla.** Se puede renombrar una columna o dividir una tabla sin romper el frontend.
- **No se expone de más.** Cuando existan usuarios, la entidad tendrá la contraseña cifrada; el DTO nunca la incluye.
- **No se acepta de más.** Si el controlador recibiera la entidad, alguien podría mandar `id` o `createdAt` y cambiarlos. `TreatmentRequest` solo tiene los campos que el formulario puede editar.

En `TreatmentDtos.cs` hay dos:

```csharp
// Lo que SALE: misma forma que Treatment del frontend.
public record TreatmentDto(Guid Id, string Name, string Category, string? Description,
    int DurationMinutes, decimal Price, bool Active,
    IReadOnlyList<TreatmentConsumptionDto> Consumption, DateTime CreatedAt)
{
    public static TreatmentDto FromEntity(Treatment treatment) => new(…);
}

// Lo que ENTRA: misma forma que TreatmentFormValues del frontend.
public class TreatmentRequest
{
    [Required(ErrorMessage = "El nombre es obligatorio")]
    [MinLength(2, ErrorMessage = "Mínimo 2 caracteres")]
    public string Name { get; set; } = "";
    // …
    public void ApplyTo(Treatment treatment) { … }   // copia los datos a la entidad
}
```

- Un **`record`** es una clase pensada para datos: se declara en una línea, sus valores no cambian y dos `record` con los mismos datos son iguales. Ideal para respuestas.
- **`FromEntity`** convierte entidad → DTO, y **`ApplyTo`** copia request → entidad. Así la conversión está en un solo lugar.
- `Consumption` se devuelve vacío por ahora: el frontend siempre espera ese arreglo y los insumos llegan con el módulo de inventario.

### 4.2 Validación con atributos

Los atributos entre corchetes (`[Required]`, `[MinLength]`, `[MaxLength]`, `[Range]`) son **reglas de validación**. Replican las del esquema de Zod del frontend (`treatmentSchema`).

> **¿Por qué validar dos veces?** La validación del frontend es para **ayudar** al usuario. La de la API es la **barrera real**: cualquiera puede llamar a la API sin pasar por el formulario (con `curl`, por ejemplo).

Como el controlador tiene `[ApiController]`, .NET valida **antes** de ejecutar el método. Si algo falla, responde `400` solo, sin que escribas un `if`:

```json
{
  "title": "Revisa los datos ingresados",
  "status": 400,
  "errors": {
    "name": ["Mínimo 2 caracteres"],
    "price": ["El precio debe estar entre 0 y 99 999 999,99"],
    "durationMinutes": ["La duración debe estar entre 5 y 1440 minutos"]
  }
}
```

Es el formato `ValidationProblemDetails` que espera `front/src/shared/lib/http.ts`. Dos ajustes en `Program.cs` lo dejan igual al frontend:

```csharp
builder.Services
    .AddControllers(options =>
    {
        // Claves de "errors" con los nombres del JSON ("name"), no los de C# ("Name").
        options.ModelMetadataDetailsProviders.Add(new SystemTextJsonValidationMetadataProvider());
    })
    .ConfigureApiBehaviorOptions(options =>
    {
        // Título en español (por defecto: "One or more validation errors occurred.").
        options.InvalidModelStateResponseFactory = context =>
            new BadRequestObjectResult(new ValidationProblemDetails(context.ModelState)
            {
                Title = "Revisa los datos ingresados",
                Status = StatusCodes.Status400BadRequest,
            });
    });
```

Los nombres en camelCase importan: la historia clínica marca en rojo cada campo según su nombre (por ejemplo, `dataConsent.signerName`).

> **Error real que encontramos: la configuración regional.** La primera versión de la regla del precio era `[Range(typeof(decimal), "0", "99999999.99")]` y respondía **500**. .NET convertía el texto `"99999999.99"` con el idioma de Windows: en español el separador decimal es la **coma**, así que `"99999999.99"` no era un número válido. En el servidor Linux, en inglés, sí habría funcionado: el clásico «en mi máquina no anda». La corrección es `ParseLimitsInInvariantCulture = true`, que lee los límites siempre con punto. **Lección:** cada vez que conviertas texto a número o fecha, piensa en qué idioma se está leyendo.

### 4.3 El controlador: `TreatmentsController.cs`

```csharp
[ApiController]
[Route("api/treatments")]
public class TreatmentsController(AppDbContext db) : ControllerBase
{
```

- **`[Route("api/treatments")]`**: todas las rutas de esta clase empiezan así. El prefijo `/api` coincide con `VITE_API_BASE_URL=http://localhost:5000/api`.
- **`(AppDbContext db)`**: el controlador **pide** la base de datos en su constructor y .NET se la entrega, porque la registramos con `AddDbContext` (lección 3). Eso es la **inyección de dependencias**.

**Crear:**

```csharp
[HttpPost]
public async Task<ActionResult<TreatmentDto>> Create(TreatmentRequest request, CancellationToken cancellationToken)
{
    var treatment = new Treatment { Id = Guid.CreateVersion7(), CreatedAt = DateTime.UtcNow };
    request.ApplyTo(treatment);

    db.Treatments.Add(treatment);                  // todavía no toca la base
    await db.SaveChangesAsync(cancellationToken);  // aquí se ejecuta el INSERT

    return CreatedAtAction(nameof(Get), new { id = treatment.Id }, TreatmentDto.FromEntity(treatment));
}
```

- **`async` / `await`**: la consulta a la base tarda unos milisegundos; mientras espera, el servidor atiende otras peticiones en lugar de quedarse bloqueado. Toda operación con la base se hace con `await`.
- **`Task<ActionResult<TreatmentDto>>`**: el método devuelve «más tarde» (`Task`) un resultado HTTP que puede ser un `TreatmentDto` (200) u otra respuesta (404, 400…).
- **`CancellationToken`**: si el usuario cierra la página, .NET cancela la consulta en curso. Se pasa a cada método `…Async`.
- **`Guid.CreateVersion7()`**: genera un UUID v7, que empieza con la fecha y hora. Así los registros nuevos quedan ordenados en el índice de la base.
- **`CreatedAtAction`**: responde `201 Created` con el encabezado `Location: /api/treatments/{id}`, la convención REST para «se creó aquí».

**Editar**, la idea clave de EF Core, el **seguimiento de cambios**:

```csharp
var treatment = await db.Treatments.FirstOrDefaultAsync(item => item.Id == id, cancellationToken);
if (treatment is null) return TreatmentNotFound();

request.ApplyTo(treatment);                    // solo cambias el objeto en memoria…
await db.SaveChangesAsync(cancellationToken);  // …y EF Core genera el UPDATE de lo que cambió
```

EF Core recuerda cómo estaba el objeto al leerlo. Al guardar, compara y escribe solo las columnas que cambiaron. No hay que escribir el `UPDATE`.

**Listar:**

```csharp
var treatments = db.Treatments.AsNoTracking();

if (!string.IsNullOrWhiteSpace(query.Search))
{
    var pattern = $"%{query.Search.Trim()}%";
    treatments = treatments.Where(treatment =>
        EF.Functions.ILike(treatment.Name, pattern) || EF.Functions.ILike(treatment.Category, pattern));
}

var page = await treatments.OrderBy(treatment => treatment.Name).ToPagedResultAsync(query, cancellationToken);
```

- **`AsNoTracking()`**: solo vamos a leer, así EF Core no guarda la copia para comparar. Es más rápido.
- **La consulta se arma por partes y se ejecuta al final.** `Where` y `OrderBy` no tocan la base: van armando el SQL. La consulta se ejecuta recién con un método `…Async` (`ToListAsync`, `CountAsync`, `FirstOrDefaultAsync`). Por eso se puede agregar el filtro de búsqueda solo si hace falta.
- **`EF.Functions.ILike`** es el `ILIKE` de PostgreSQL: busca sin distinguir mayúsculas («ENDO» encuentra «Endodoncia»).
- El texto de búsqueda **nunca se pega dentro del SQL**: EF Core lo envía como parámetro. Eso evita la **inyección SQL**.

**No encontrado:**

```csharp
private ObjectResult TreatmentNotFound() =>
    Problem(statusCode: StatusCodes.Status404NotFound, title: "Tratamiento no encontrado");
```

`Problem(...)` responde en formato `ProblemDetails`; el frontend muestra el `title` como mensaje.

**`{id:guid}`** en `[HttpGet("{id:guid}")]` es una **restricción de ruta**: si el id no tiene forma de UUID, la ruta ni siquiera coincide.

> **Una ruta, dos respuestas.** El frontend usa la misma URL para dos cosas: `GET /treatments` (lista paginada) y `GET /treatments?active=true` (arreglo de activos). Por eso `List` devuelve `IActionResult`, que admite cualquier forma de respuesta. Es un contrato heredado del frontend; lo normal sería que siempre respondiera con la misma forma.

### 4.4 La paginación compartida: `Common/Paging.cs`

```csharp
public record PageQuery(int Page = 1, int PageSize = 10, string? Search = null) { … }

public record PagedResult<T>(IReadOnlyList<T> Items, int Page, int PageSize, int TotalItems, int TotalPages);

public static async Task<PagedResult<T>> ToPagedResultAsync<T>(this IQueryable<T> query, PageQuery pageQuery, …)
{
    var totalItems = await query.CountAsync(cancellationToken);        // SELECT count(*)
    var items = await query.Skip((page - 1) * pageSize).Take(pageSize)  // LIMIT / OFFSET
                           .ToListAsync(cancellationToken);
    …
}
```

- **`[FromQuery] PageQuery query`** en el controlador hace que .NET llene el objeto con `?page=1&pageSize=10&search=…` de la URL.
- **`PagedResult<T>`** es **genérico**: la `T` es «cualquier tipo». Sirve para `PagedResult<TreatmentDto>` y mañana para `PagedResult<PatientDto>`.
- **`this IQueryable<T> query`** la convierte en un **método de extensión**: se llama como si fuera parte de cualquier consulta (`treatments.ToPagedResultAsync(...)`). Josue la puede reutilizar en pacientes.
- `SafePageSize` limita a 100 filas por página, para que nadie pida la tabla entera de una vez.

### 4.5 CORS

El frontend corre en `http://localhost:5173` y la API en `http://localhost:5000`: son **orígenes distintos**. Por seguridad, el navegador bloquea esas llamadas salvo que la API diga explícitamente «este origen puede llamarme». Eso es **CORS**.

```csharp
const string FrontendCorsPolicy = "Frontend";
var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];

builder.Services.AddCors(options =>
    options.AddPolicy(FrontendCorsPolicy, policy =>
        policy.WithOrigins(allowedOrigins).AllowAnyHeader().AllowAnyMethod()));
// …
app.UseCors(FrontendCorsPolicy);   // en el pipeline, antes de UseAuthorization
```

Los orígenes están en `appsettings.Development.json` (`"Cors": { "AllowedOrigins": [ "http://localhost:5173" ] }`). En producción el frontend y la API van detrás del mismo nginx y el mismo dominio, así que no hace falta CORS.

Antes de un `POST` con JSON, el navegador manda una pregunta previa (`OPTIONS`, *preflight*). La API responde `Access-Control-Allow-Origin: http://localhost:5173` y recién entonces el navegador envía el `POST`. Un origen no permitido no recibe ese encabezado y el navegador bloquea la respuesta.

> CORS no protege la API de `curl` ni de otros programas: solo controla qué **páginas web** pueden usarla desde un navegador. La protección real llega con la autenticación (lección 6).

### 4.6 Probar los endpoints

Con la base y la API levantadas (`docker compose up -d` y `dotnet run --project src/ClinicApp.Api --launch-profile http`), hay tres formas:

1. **Scalar** (página web): abre **http://localhost:5000/scalar**. Lista todos los endpoints a partir de `/openapi/v1.json` y permite probarlos con **Test Request**. Viene del paquete `Scalar.AspNetCore` y solo se publica en desarrollo (`app.MapScalarApiReference()` dentro del `if (app.Environment.IsDevelopment())`).
2. **`ClinicApp.Api.http`**: abre el archivo en el editor y pulsa **Send Request** sobre cada petición. Trae ejemplos de crear, ver, editar, eliminar, un `400` y un `404`. En VS Code necesita la extensión **REST Client**. Encadena peticiones: `{{crear.response.body.id}}` usa el id que devolvió el `POST` anterior.
3. **`curl`** desde la consola. En Windows, si el JSON tiene tildes, escríbelo en un archivo UTF-8 y envíalo con `--data-binary @archivo.json`: escrito directo en la consola, las tildes llegan dañadas.

Resultados esperados: `201` al crear, `200` al listar y editar, `400` con los mensajes en español ante datos inválidos, `204` al eliminar y `404` al pedir un id que no existe.

> **¿Y el frontend?** Todavía no se puede probar contra la API real. `VITE_USE_MOCK_API=false` cambia **todos** los módulos a la vez, incluido el inicio de sesión, y `/auth/login` aún no existe. Se podrá en cuanto esté la lección 6.

### 4.7 Lo que queda pendiente en este módulo

- **Insumos del tratamiento** (`consumption`): cuando exista la tabla de insumos del inventario. Hasta entonces la API ignora la lista que manda el formulario y devuelve una vacía.
- **Eliminar un tratamiento ya usado:** cuando existan los tratamientos realizados, `DELETE` debe responder `409` y sugerir desactivarlo.
- **Autorización:** cualquiera puede llamar a estos endpoints hasta que exista `auth` (lección 6).

---

## Lección 5: errores, HTTPS y configuración de producción

Objetivo: que la API se comporte bien cuando algo sale mal y que esté lista para correr en el servidor. Al terminar la lección 4 quedaban tres problemas:

1. **Errores inesperados.** Si la base se cae, la API devolvía la traza técnica completa (en desarrollo) o una respuesta sin formato. El frontend no sabía qué mostrar.
2. **Aviso de HTTPS.** Al arrancar con el perfil `http` aparecía `Failed to determine the https port for redirect`.
3. **Configuración de producción.** Faltaba decidir dónde van la contraseña de la base y el resto de los valores del servidor.

Archivos nuevos o cambiados:

```text
src/ClinicApp.Api/
├── Common/ProblemDetailsSetup.cs    ← nuevo: títulos en español y detalle solo en desarrollo
├── Program.cs                       ← errores, encabezados de nginx, chequeo de salud
├── appsettings.json                 ← logs con TraceId
├── appsettings.Development.json     ← logs sin TraceId (más limpios en desarrollo)
└── ClinicApp.Api.csproj             ← paquete del chequeo de salud
```

### 5.1 Un solo formato para todos los errores: ProblemDetails

**ProblemDetails** es un formato estándar (RFC 9457) para describir errores en JSON. Ya lo usábamos en los `400` de validación y en el `404` de "Tratamiento no encontrado". Ahora lo usan **todos** los errores:

```json
{
  "type": "https://tools.ietf.org/html/rfc9110#section-15.6.1",
  "title": "Ocurrió un error inesperado",
  "status": 500,
  "traceId": "00-7e20282cec3d96d04e083afad4510b63-ed68b80d834a6e62-00"
}
```

El frontend (`shared/lib/http.ts`) muestra `detail` si existe y, si no, `title`. Por eso los títulos van en español.

En `Program.cs` son tres piezas:

```csharp
// Servicio: sabe escribir ProblemDetails. Customize ajusta cada error antes de enviarlo.
builder.Services.AddProblemDetails(options => options.CustomizeProblemDetails = ProblemDetailsSetup.Customize);

// Pipeline:
app.UseExceptionHandler();   // atrapa cualquier excepción y responde 500
app.UseStatusCodePages();    // da cuerpo a los errores que salían vacíos
```

| Situación | Antes | Ahora |
|---|---|---|
| Excepción sin atrapar (la base está caída) | `500` con la traza técnica | `500` "Ocurrió un error inesperado" |
| Ruta que no existe (`/api/no-existe`) | `404` sin cuerpo | `404` "Recurso no encontrado" |
| Método que no existe (`PATCH /api/treatments`) | `405` sin cuerpo | `405` "Método no permitido" |
| `POST` sin `Content-Type: application/json` | `415` "Unsupported Media Type" | `415` "Formato de datos no soportado" |
| `404` escrito en el controlador | "Tratamiento no encontrado" | igual: no se toca |

> Si el usuario cierra la página mientras la API espera a la base, el `CancellationToken` de la lección 4 cancela la consulta. `UseExceptionHandler` reconoce ese caso: no lo registra como error y responde `499` (el cliente cerró la conexión).

### 5.2 `Common/ProblemDetailsSetup.cs`: títulos y detalle

`Customize` se ejecuta con **cada** error antes de enviarlo. Hace dos cosas:

**1. Traduce los títulos genéricos.** .NET los escribe en inglés ("Not Found"). Un diccionario los cambia por su versión en español, pero solo si el título es el genérico. Así se respeta "Tratamiento no encontrado", que escribimos nosotros:

```csharp
if (IsDefaultTitle(problem.Title, status) && SpanishTitles.TryGetValue(status, out var title))
{
    problem.Title = title;
}
```

**2. Decide si se muestra el mensaje de la excepción.**

```csharp
var exception = context.Exception
    ?? context.HttpContext.Features.Get<IExceptionHandlerFeature>()?.Error;

if (exception is not null)
{
    var environment = context.HttpContext.RequestServices.GetRequiredService<IHostEnvironment>();
    problem.Detail = environment.IsDevelopment() ? exception.Message : null;
}
```

- **En desarrollo** el `500` trae `detail` con el mensaje (por ejemplo `"An exception has been raised that is likely due to a transient failure."`). Sirve para depurar.
- **En producción** nunca: el mensaje de una excepción puede revelar nombres de tablas, consultas o rutas del servidor, y eso ayuda a un atacante. El usuario ve "Ocurrió un error inesperado" y el detalle completo queda en el log.

> **Lo que encontramos al probar.** La primera versión usaba solo `context.Exception`, y en desarrollo el `detail` no aparecía. Con una línea de depuración vimos por qué: cuando la API usa controladores, .NET escribe el error con el escritor de MVC (`DefaultApiProblemDetailsWriter`), que arma un contexto nuevo **sin** la excepción. La excepción sigue guardada en la petición, en `IExceptionHandlerFeature`, y de ahí se lee. Lección: si un valor llega vacío y no sabes por qué, imprime la pila de llamadas (`Environment.StackTrace`) para ver quién te está llamando.

### 5.3 El orden del pipeline

Cada petición atraviesa los *middlewares* de arriba abajo, y la respuesta vuelve de abajo arriba. Por eso el orden importa:

```csharp
app.UseForwardedHeaders();   // 1. corrige esquema e IP con lo que dice nginx (5.4)
app.UseExceptionHandler();   // 2. envuelve todo lo de abajo: si algo lanza una excepción, la atrapa
app.UseStatusCodePages();    // 3. al volver, si la respuesta es un error vacío, le pone cuerpo
// ... Scalar (solo en desarrollo), CORS, autorización
app.MapHealthChecks("/api/health");
app.MapControllers();
```

`UseExceptionHandler` va casi primero porque solo atrapa las excepciones de lo que está **debajo** de él.

### 5.4 HTTPS: lo hace nginx, no la API

En producción el esquema es este:

```text
navegador ──HTTPS──► nginx (puerto 443, tiene el certificado) ──HTTP──► API (127.0.0.1:5000)
```

nginx tiene el certificado, atiende el HTTPS y redirige `http://` a `https://`. A la API le llega HTTP desde la misma máquina. Por eso:

- **Se quitó `app.UseHttpsRedirection()`.** En producción nginx ya redirige, y en desarrollo usamos `http`. Con eso desapareció el aviso del arranque.
- **Se agregó `UseForwardedHeaders`.** Como a la API le llega HTTP desde `127.0.0.1`, creería que todas las peticiones son HTTP y vienen de nginx. nginx manda dos encabezados con los datos reales: `X-Forwarded-Proto: https` y `X-Forwarded-For: <IP del cliente>`. `UseForwardedHeaders` los lee. Esto importará en la lección 6: la cookie de sesión `Secure` y el límite de intentos de inicio de sesión por IP dependen de saber el esquema y la IP reales.

```csharp
builder.Services.Configure<ForwardedHeadersOptions>(options =>
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto);
```

> **Seguridad:** por defecto .NET solo confía en esos encabezados si la petición viene de `127.0.0.1`, que es donde está nginx. Si alguien llamara a la API directamente con un `X-Forwarded-For` falso, se ignoraría. Por la misma razón, en producción la API escucha solo en `127.0.0.1`, no en una IP pública.

### 5.5 Chequeo de salud: `GET /api/health`

Una ruta que responde si la API funciona **y** llega a la base:

| Estado | Respuesta |
|---|---|
| Todo bien | `200` `Healthy` |
| La base no responde | `503` `Unhealthy` |

```csharp
builder.Services.AddHealthChecks().AddDbContextCheck<AppDbContext>("database");  // hace un SELECT 1
app.MapHealthChecks("/api/health");
```

Necesita el paquete `Microsoft.Extensions.Diagnostics.HealthChecks.EntityFrameworkCore`. Va bajo `/api` para que nginx también lo deje pasar. Sirve para revisar el servidor después de cada despliegue (`curl https://dominio/api/health`) y para conectar un monitor gratuito que avise si la API se cae.

> **Lo que encontramos al instalarlo.** `dotnet add package` sin versión intentó instalar la `11.0.0`, que es para .NET 11. Los paquetes de Microsoft siguen la versión de .NET: en un proyecto `net10.0` se fija la misma versión que los demás, con `--version 10.0.15`.

### 5.6 Configuración: capas y variables de entorno

.NET arma la configuración leyendo varias fuentes en orden. Cada una **pisa** a la anterior:

| Orden | Fuente | Qué ponemos ahí |
|---|---|---|
| 1 | `appsettings.json` | Valores comunes y **sin secretos**. Se sube a git. |
| 2 | `appsettings.{Entorno}.json` | `appsettings.Development.json`: la conexión a la base de Docker local y el CORS de Vite. Su contraseña es de desarrollo y no protege nada real. |
| 3 | Variables de entorno | **Producción:** la contraseña real de la base y la URL de escucha. |
| 4 | Argumentos de `dotnet run` | Casi nunca. |

El **entorno** lo decide la variable `ASPNETCORE_ENVIRONMENT`. El perfil `http` de `launchSettings.json` la pone en `Development`. **Si no existe, .NET asume `Production`.** Es la opción segura: en el servidor no hay que acordarse de nada para que Scalar y los detalles de error queden apagados.

Las variables de entorno usan `__` (dos guiones bajos) donde el JSON usa niveles:

| JSON (`appsettings`) | Variable de entorno |
|---|---|
| `ConnectionStrings:Default` | `ConnectionStrings__Default` |
| `Cors:AllowedOrigins` (primer elemento) | `Cors__AllowedOrigins__0` |

En el servidor, la API correrá como servicio de `systemd` (decisión en `documentacion/decisiones-backend.md` § 3). Referencia para la fase de despliegue:

```ini
# /etc/clinicapp/api.env   (permisos 600: solo lo lee root)
ASPNETCORE_ENVIRONMENT=Production
ASPNETCORE_URLS=http://127.0.0.1:5000
ConnectionStrings__Default=Host=localhost;Port=5432;Database=clinicapp;Username=clinicapp;Password=<contraseña-larga-y-aleatoria>
AllowedHosts=midominio.com
```

```ini
# /etc/systemd/system/clinicapp-api.service
[Service]
EnvironmentFile=/etc/clinicapp/api.env
WorkingDirectory=/opt/clinicapp/api
ExecStart=/opt/clinicapp/api/ClinicApp.Api
Restart=always
User=clinicapp
```

- `ASPNETCORE_URLS=http://127.0.0.1:5000`: la API solo escucha dentro del servidor. Desde internet solo se llega por nginx.
- `AllowedHosts`: la API rechaza peticiones que digan venir de otro dominio.
- **No hace falta CORS en producción:** frontend y API comparten dominio detrás de nginx.

> **Regla:** ninguna contraseña real va en un archivo que se suba a git. Si alguna se sube por error, se cambia; borrarla del repositorio no basta, porque queda en el historial.

Si falta la cadena de conexión, la API no arranca y lo dice claro. Lo probamos arrancando en producción sin la variable:

```text
Unhandled exception. System.InvalidOperationException: Falta la cadena de conexión 'ConnectionStrings:Default'.
```

Es mejor fallar al arrancar que arrancar "bien" y fallar en la primera petición de la clínica.

### 5.7 Logs y `traceId`: encontrar un error que te reportan

Cada respuesta de error trae un `traceId`. Si la clínica reporta "me salió un error", con ese código se busca la traza completa en el log del servidor. Para eso cada línea del log tiene que llevar el `TraceId`. En `appsettings.json`:

```json
"Console": {
  "FormatterName": "simple",
  "FormatterOptions": { "IncludeScopes": true }
}
```

Con eso el log de un `500` empieza así:

```text
fail: Microsoft.AspNetCore.Diagnostics.ExceptionHandlerMiddleware[1]
      => SpanId:ed68b80d834a6e62, TraceId:7e20282cec3d96d04e083afad4510b63, ... => RequestPath:/api/treatments
      An unhandled exception has occurred while executing the request.
```

El `TraceId` del log coincide con el segundo bloque del `traceId` de la respuesta (`00-`**`7e20282c…`**`-ed68b80d…-00`). En el servidor se buscará con `journalctl -u clinicapp-api | grep 7e20282c`.

En `appsettings.Development.json`, `IncludeScopes` vuelve a `false` para que la consola de desarrollo no se llene.

> **Lo que encontramos al probar.** Con solo `FormatterOptions`, el `TraceId` no aparecía. Faltaba `"FormatterName": "simple"`: sin él .NET no sabe a qué formato de consola aplicarle las opciones. Lo confirmamos buscando el `traceId` de la respuesta dentro del log: 0 coincidencias antes del cambio, 3 después.

### 5.8 Probarlo

**En desarrollo**, con la base y la API levantadas:

```bash
curl http://localhost:5000/api/health          # Healthy
curl http://localhost:5000/api/no-existe       # 404 "Recurso no encontrado"
docker compose stop db                         # apaga la base a propósito
curl http://localhost:5000/api/health          # 503 Unhealthy
curl http://localhost:5000/api/treatments      # 500 "Ocurrió un error inesperado" + detail
docker compose start db                        # la vuelve a encender
```

Las dos primeras también están en `ClinicApp.Api.http`.

**Simular producción en tu máquina**, sin perfil de arranque y con la configuración en variables (Git Bash):

```bash
env ASPNETCORE_ENVIRONMENT=Production \
    ASPNETCORE_URLS=http://127.0.0.1:5000 \
    "ConnectionStrings__Default=Host=localhost;Port=5433;Database=clinicapp;Username=clinicapp;Password=clinicapp_dev" \
    dotnet run --project src/ClinicApp.Api --no-launch-profile
```

Resultados que obtuvimos:

| Prueba | Desarrollo | Producción |
|---|---|---|
| `/api/health` con la base encendida | `200` Healthy | `200` Healthy |
| `/api/treatments` con la base apagada | `500` con `detail` | `500` **sin** `detail`; la traza solo en el log |
| `/scalar` y `/openapi/v1.json` | disponibles | `404` |
| Arrancar sin cadena de conexión | — | no arranca, con mensaje claro |

> En Bash, una variable con `;` en el valor va entre comillas **completa** y precedida de `env`. Escrita como `'Nombre=valor' comando`, Bash la toma como el nombre de un programa (`command not found`). Nos pasó en la primera prueba.

### 5.9 Lo que queda para la fase de despliegue

- **Migraciones en el servidor:** sin el SDK de .NET instalado allá. La opción prevista es `dotnet ef migrations bundle`, que genera un ejecutable que aplica las migraciones pendientes.
- **nginx:** la ruta `/api` hacia `127.0.0.1:5000`, con `proxy_set_header X-Forwarded-For` y `X-Forwarded-Proto`, más el certificado HTTPS (Let's Encrypt).
- **Usuario y servicio `systemd`**, y la contraseña real de PostgreSQL generada en el servidor.
- **Respaldos diarios con `pg_dump`** (`decisiones-backend.md` § 3).

Con esto la base de la API está completa. La lección 6 agrega usuarios, contraseñas, roles y JWT: con ella el frontend podrá dejar los datos de ejemplo y usar la API real.
