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
| `patients` | `Unit/PatientRulesTests.cs` | Formato y búsqueda del N.° de historia, fechas, limpieza de textos, escape de comodines, cédula ecuatoriana (verificador) y teléfono opcional |
| | `Integration/PatientsTests.cs` | Roles, validación de cada campo, tipo de documento y teléfono opcional, cédula repetida (también con altas simultáneas), búsqueda sin tildes, filtros (estado, género, fecha de registro), orden y paginación, baja lógica, lista de dados de baja (solo admin) y reactivación |
| `inventory` | `Integration/SterilizationTests.cs` | "No futura" según el día de la clínica |
| `appointments` (catálogos) | `Integration/ProfessionalsAndRoomsTests.cs` | Semilla de desarrollo y vínculo del médico, roles, desactivar, vincular usuarios sin repetir, nombre único de consultorio, responsable de esterilización existente y activo, FK que impide borrar un profesional con ciclos |
| `appointments` (agenda) | `Unit/AppointmentRulesTests.cs` | Cambios de estado permitidos, citas editables, choque de rangos (citas pegadas), duración y lectura de ids opcionales |
| | `Integration/AppointmentsTests.cs` | Hora de la clínica a UTC, roles, validaciones, paciente dado de baja y profesional inactivo, los 4 mensajes de choque, citas pegadas y canceladas, 10 agendados simultáneos (1 gana), edición, estados, listas por rango y paciente, nombre del paciente en la cita, bloqueos, 409 al borrar un tratamiento con citas y citas futuras del profesional |
| `treatments` (realizados) | `Integration/TreatmentAssignmentsTests.cs` | Registro completado con descuento FEFO y movimientos con asignación y paciente, idempotencia por `sourceKey` (también 10 reintentos simultáneos), `409` con otro paciente, registro sin stock, precio del catálogo, validaciones, roles, listas por paciente y por tratamiento, `409` al borrar un tratamiento realizado |
| `clinical-history` | `Unit/ClinicalHistoryRulesTests.cs` | Reglas de las secciones (niega antecedentes, detalle obligatorio, consentimiento, hallazgos, PA, intervalo, interconsulta, alertas, ids de lista), tipo de archivo por los primeros bytes y limpieza del nombre |
| | `Integration/ClinicalHistoryTests.cs` | Roles, historia vacía, revisiones y versiones, guardados simultáneos, validación por campo, referencias inválidas, `references` y 409 al borrar un tratamiento del plan, atención idempotente, una cita por atención, validación de la atención, orden y notas con autor, lista con búsqueda sin tildes, los 4 formatos de adjunto, rechazos, vínculo y quitado, limpieza de huérfanos y protocolo de conservación (simulación y real) |
| | `Integration/ClinicalArchiveTests.cs` | Archivo clínico: catálogo (nombres únicos sin tildes, versión, archivar categoría, etiqueta repetida), adjuntar con metadatos (examen recibido, auditoría, revisión), duplicados por SHA-256 (también de adjuntos sin huella; otro paciente sí puede), validación de cada vínculo, edición de un adjunto anterior (versión 0), vínculo con el examen que no se reasigna, archivar y restaurar con concurrencia, roles |
| | `Integration/EncounterRegistrationTests.cs` | Registro de la atención en una transacción: tratamiento realizado con profesional, costo e insumos; propuesto que sale de la historia, examen pendiente y cita completada; reintento sin duplicar ni descontar; reutiliza un registro previo por pasos; si falla no queda nada; dos registros simultáneos de la misma cita; cita cancelada con aviso; tratamiento realizado ajeno; roles |
| `institution` | `Integration/InstitutionTests.cs` | Perfil creado al arrancar, roles, sedes (el servidor da el UUID, reordenar, quitar, cambiar la principal), "Sede N" para sedes sin nombre, ids inválidos, repetidos o ajenos, validación de RUC, correo, sitio web y logo (sin SVG), dos principales, endpoint público sin sesión y sin datos internos |
| `notifications` | `Unit/NotificationRulesTests.cs` | Formato de hora (12 h) y fecha en español, reemplazo de todas las variables de la plantilla |
| | `Integration/NotificationsTests.cs` | Confirmación pendiente al agendar y enviada después, paciente sin notificaciones, cancelación que descarta la confirmación, proveedor caído (3 intentos y `fallida`), un solo recordatorio, sin proveedor no se registra nada, reporte con búsqueda y fechas (con `patientName` y `message`, sin el destinatario), roles y plantilla |
| | `Integration/AlertsTests.cs` | Alertas del día: citas activas de hoy (sin las canceladas), cumpleaños (sin los dados de baja), stock crítico y envíos fallidos; el médico no ve stock ni envíos; sin sesión, 401 |
| `finance` | `Integration/FinanceTests.cs` | Suma de todas las asignaciones, pago parcial y completo, anulación (sin motivo, dos veces), saldo excedido, tratamiento no realizado, fecha futura, pagos simultáneos que no superan el saldo, redondeo (3 × 33,33), resúmenes de tratamiento y de paciente, 400 con varios pacientes, médico sin acceso y estado de la fila |
| `reports` | `Unit/ReportPeriodTests.cs` | Periodo inclusivo en hora de la clínica, periodos inválidos y etiquetas de los días ("lun 12") |
| | `Integration/ReportsTests.cs` | Datos conocidos en marzo de 2031: resumen, agenda por día de la clínica (también una cita a las 23:30), estados, ocupación con bloqueo recortado y "Sin consultorio", productividad, tratamientos con ingreso estimado; inventario del día; roles y periodo inválido |
| `openapi` | `Integration/OpenApiTests.cs` | El documento OpenAPI declara los números solo como `integer`/`number` (sin `string` ni `pattern`), para que los tipos generados en el frontend no queden como `number | string` |

## Problemas comunes

| Síntoma | Causa y solución |
|---|---|
| `Failed to connect to 127.0.0.1:5433` | La base no está levantada: `docker compose up -d` |
| `database "clinicapp_test" is being accessed by other users` | Quedó otra ejecución abierta. Ciérrala y vuelve a ejecutar. |
| Error de compilación por un archivo en uso | La API está corriendo (`dotnet run`) y bloquea los archivos. Detenla antes de ejecutar las pruebas. |

**Tareas en segundo plano:** en las pruebas, el envío automático de notificaciones no corre solo (`Notifications:DispatchIntervalSeconds` = 3600). Las pruebas llaman a `NotificationDispatcher.RunOnceAsync` y `AttachmentCleanupService.RunOnceAsync` cuando lo necesitan, para que el resultado no dependa del tiempo.
