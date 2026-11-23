# ClinicApp — API (.NET)

API REST en .NET 10 del sistema de gestión clínica, con PostgreSQL en Docker. Proyecto en construcción: la guía paso a paso de cómo se armó está en [`tutorial/fase-0.md`](./tutorial/fase-0.md).

**Para levantarla en desarrollo** (desde esta carpeta):

```bash
cp .env.example .env                 # solo la primera vez
docker compose up -d                 # base de datos PostgreSQL en el puerto 5433
dotnet tool restore                  # instala dotnet-ef (solo la primera vez)
dotnet ef database update --project src/ClinicApp.Api   # crea o actualiza las tablas
dotnet run --project src/ClinicApp.Api --launch-profile http   # API en http://localhost:5000
```

Al arrancar en desarrollo con la tabla `users` vacía, la API crea las cuentas de prueba del modo mock del frontend: `admin@clinica.com` / `admin123`, `recepcion@clinica.com` / `recepcion123` y `medico@clinica.com` / `medico123`. Para probar los endpoints: http://localhost:5000/scalar (inicia sesión con `POST /api/auth/login` y pega el `accessToken` en el campo **Bearer**) o el archivo [`src/ClinicApp.Api/ClinicApp.Api.http`](./src/ClinicApp.Api/ClinicApp.Api.http).

**Variables de entorno en producción** (nunca en `appsettings.json`):

| Variable | Ejemplo |
|---|---|
| `ConnectionStrings__Default` | `Host=localhost;Port=5432;Database=clinicapp;Username=clinicapp;Password=<secreta>` |
| `Auth__SigningKey` | 64 caracteres aleatorios (`openssl rand -base64 48`) |
| `Auth__FrontendBaseUrl` | `https://midominio.com` |
| `ASPNETCORE_URLS` | `http://127.0.0.1:5000` |
| `AllowedHosts` | `midominio.com` |
| `Seed__AdminEmail`, `Seed__AdminPassword` | Administrador inicial (solo la primera vez; mínimo 12 caracteres) |
| `Attachments__RootPath` | Carpeta de los adjuntos de la historia clínica, fuera de la carpeta de la app (por ejemplo `/var/lib/clinicapp/attachments`). **Debe estar en el respaldo diario**, junto con la base. |
| `Clinic__TimeZone` | Zona horaria IANA de la clínica (por defecto `America/Guayaquil`) |
| `Notifications__Provider` | Proveedor de envío de notificaciones. Vacío por ahora (no se registran notificaciones) hasta elegir el proveedor con la clínica. |

El contrato completo que el frontend (`../front`) espera — endpoints, formato de error de validación (400), y notas de autenticación — está documentado en [`../documentacion/arquitectura-frontend.md`](../documentacion/arquitectura-frontend.md), sección "Endpoints que el backend .NET debe exponer".

Ver [`backlog.md`](./backlog.md) para el desglose de TODOs pendientes por módulo y [`backlog-desgloce.md`](./backlog-desgloce.md) para el responsable y el orden de trabajo de cada módulo.

**Pruebas:** `dotnet test` desde `back/` (con la base de Docker levantada). Comandos y detalle en [`docs/pruebas.md`](./docs/pruebas.md).

## Resumen rápido

- Autenticación con JWT de 15 minutos (`Authorization: Bearer`) y cookie `httpOnly` de refresh de 7 días para restaurar la sesión al recargar (`POST /auth/refresh`). Todos los endpoints piden sesión salvo los de inicio de sesión, recuperación de contraseña, solicitud de acceso y `/health`. Cada módulo declara sus roles (`admin`, `recepcion`, `medico`).
- Errores de validación (400) en formato `ValidationProblemDetails` estándar de ASP.NET Core (`{ title, detail, errors: { campo: [mensajes] } }`).
- Los demás errores (401, 403, 404, 405, 409, 415, 429, 500) en formato `ProblemDetails` (`{ title, status, detail?, traceId }`) con títulos en español. Los 500 solo traen `detail` en desarrollo; en producción el detalle queda en el log, junto al `traceId`.
- Chequeo de salud en `GET /api/health`: `Healthy` (200) o `Unhealthy` (503) según si la API llega a la base.
- En producción la configuración va en variables de entorno (`ConnectionStrings__Default`, `ASPNETCORE_URLS`...), nunca en `appsettings.json`. Ver la lección 5 del tutorial.
- Recursos: `patients`, `appointments`, `professionals`, `rooms`, `schedule-blocks`, `clinical-history`, `treatments`, `treatment-assignments`, `inventory`, `notifications`, `finance`, `institution`, `reports`.
- El frontend consume la API mediante `VITE_API_BASE_URL` (ver `../front/.env.example`). Todos los módulos del frontend están conectados a la API; lo que falta está en [`backlog-desgloce.md`](./backlog-desgloce.md#pendientes-al-cerrar-los-planes-2026-11-17).
