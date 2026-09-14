# ClinicApp — API (.NET)

Carpeta reservada para la API REST en .NET del sistema de gestión clínica. Aún no se ha inicializado el proyecto.

El contrato completo que el frontend (`../front`) espera — endpoints, formato de error de validación (400), y notas de autenticación — está documentado en [`../documentacion/arquitectura-frontend.md`](../documentacion/arquitectura-frontend.md), sección "Endpoints que el backend .NET debe exponer".

Ver [`backlog.md`](./backlog.md) para el desglose de TODOs pendientes por módulo.

## Resumen rápido

- Autenticación basada en JWT (`POST /auth/login`, `POST /auth/logout`), con cookie `httpOnly` de refresh para restaurar sesión vía `GET /auth/me`.
- Errores de validación (400) en formato `ValidationProblemDetails` estándar de ASP.NET Core (`{ title, detail, errors: { campo: [mensajes] } }`).
- Recursos: `patients`, `appointments`, `professionals`, `clinical-history`, `treatments`, `treatment-assignments`, `inventory/items`.
- El frontend consume la API mediante `VITE_API_BASE_URL` (ver `../front/.env.example`) y hoy corre con datos mock (`VITE_USE_MOCK_API=true`) mientras esta API no existe.
