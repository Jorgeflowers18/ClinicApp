# Pruebas del backend — ClinicApp

Proyecto: `back/tests/ClinicApp.Api.Tests` (xUnit). Hay dos tipos de prueba:

| Carpeta | Tipo | Qué prueba | Necesita la base |
|---|---|---|---|
| `Unit/` | Unitarias | Reglas sueltas sin base de datos: zona horaria, validaciones, cálculos, formatos | No |
| `Integration/` | Integración | La API completa: endpoints, roles, validación, base de datos y concurrencia | Sí |

## Requisitos

1. **SDK de .NET 10** (el mismo que la API).
2. **Para las pruebas de integración, PostgreSQL levantado** con Docker. Desde `back/`:
   ```bash
   docker compose up -d
   ```

## Cómo funcionan las de integración

- Levantan la API en memoria (`WebApplicationFactory`) y le hacen peticiones HTTP reales, con las cuentas de prueba (`admin@clinica.com`, `recepcion@clinica.com`, `medico@clinica.com`).
- **Usan su propia base, `clinicapp_test`,** en el mismo contenedor. **Al empezar la borran y la vuelven a crear** con todas las migraciones. La base de desarrollo (`clinicapp`) no se toca nunca.
- Los adjuntos de prueba van a una carpeta temporal que se borra al terminar.
- Para usar otra base, define la variable `CLINICAPP_TEST_DB` con una cadena de conexión de PostgreSQL antes de ejecutar.

## Comandos

Todos desde la carpeta `back/`.

| Qué | Comando |
|---|---|
| **Todas las pruebas** | `dotnet test` |
| Solo las unitarias (sin base de datos) | `dotnet test --filter "FullyQualifiedName~ClinicApp.Api.Tests.Unit"` |
| Solo las de integración | `dotnet test --filter "FullyQualifiedName~ClinicApp.Api.Tests.Integration"` |
| Las de un módulo (por ejemplo, pacientes) | `dotnet test --filter "FullyQualifiedName~PatientsTests"` |
| Una sola prueba | `dotnet test --filter "FullyQualifiedName~Cedula_repetida_responde_409_con_el_campo"` |
| Ver el nombre de cada prueba al ejecutarse | `dotnet test --logger "console;verbosity=normal"` |
| Listar las pruebas sin ejecutarlas | `dotnet test --list-tests` |

**Resultado esperado:** al final aparece `Correctas! - Con error: 0, Superado: N`. Si alguna falla, el mensaje dice qué petición se hizo, qué código se esperaba y qué respondió la API.

## Pruebas por módulo

| Módulo | Archivo | Qué cubre |
|---|---|---|
| Base | `Unit/ClinicClockTests.cs` | "Hoy" en la zona de la clínica, conversión a UTC, rangos de fechas y zona inválida |
| `patients` | `Unit/PatientRulesTests.cs` | Formato y búsqueda del N.° de historia, fechas, limpieza de textos y escape de comodines |
| | `Integration/PatientsTests.cs` | Roles, validación de cada campo, cédula repetida (también con altas simultáneas), búsqueda sin tildes, orden y paginación, baja lógica y reactivación |
| `inventory` | `Integration/SterilizationTests.cs` | "No futura" según el día de la clínica |

## Problemas comunes

| Síntoma | Causa y solución |
|---|---|
| `Failed to connect to 127.0.0.1:5433` | La base no está levantada: `docker compose up -d` |
| `database "clinicapp_test" is being accessed by other users` | Quedó otra ejecución abierta. Ciérrala y vuelve a ejecutar. |
| Error de compilación por un archivo en uso | La API está corriendo (`dotnet run`) y bloquea los archivos. Detenla antes de ejecutar las pruebas. |
