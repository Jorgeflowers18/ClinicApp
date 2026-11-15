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

El contrato completo que el frontend (`../front`) espera — endpoints, formato de error de validación (400), y notas de autenticación — está documentado en [`../documentacion/arquitectura-frontend.md`](../documentacion/arquitectura-frontend.md), sección "Endpoints que el backend .NET debe exponer".

Ver [`backlog.md`](./backlog.md) para el desglose de TODOs pendientes por módulo y [`backlog-desgloce.md`](./backlog-desgloce.md) para el responsable y el orden de trabajo de cada módulo.

## Resumen rápido

- Autenticación basada en JWT (`POST /auth/login`, `POST /auth/logout`), con cookie `httpOnly` de refresh para restaurar sesión vía `GET /auth/me`.
- Errores de validación (400) en formato `ValidationProblemDetails` estándar de ASP.NET Core (`{ title, detail, errors: { campo: [mensajes] } }`).
- Los demás errores (404, 405, 409, 415, 500) en formato `ProblemDetails` (`{ title, status, detail?, traceId }`) con títulos en español. Los 500 solo traen `detail` en desarrollo; en producción el detalle queda en el log, junto al `traceId`.
- Chequeo de salud en `GET /api/health`: `Healthy` (200) o `Unhealthy` (503) según si la API llega a la base.
- En producción la configuración va en variables de entorno (`ConnectionStrings__Default`, `ASPNETCORE_URLS`...), nunca en `appsettings.json`. Ver la lección 5 del tutorial.
- Recursos: `patients`, `appointments`, `professionals`, `rooms`, `schedule-blocks`, `clinical-history`, `treatments`, `treatment-assignments`, `inventory`, `notifications`, `finance`, `institution`, `reports`.
- El frontend consume la API mediante `VITE_API_BASE_URL` (ver `../front/.env.example`) y hoy corre con datos mock (`VITE_USE_MOCK_API=true`) mientras esta API no existe.
