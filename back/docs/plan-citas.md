# Plan de implementación — citas y bloqueos (`appointments`, parte 2)

- **Responsable:** Jorge Flores
- **Orden:** 3 de [`backlog-desgloce.md`](../backlog-desgloce.md)
- **Estado:** en revisión. Ninguna decisión aprobada.
- **Depende de:** `patients` y `ClinicClock` (ya implementados) y los catálogos de profesionales y consultorios (ya implementados).
- **Detalle de endpoints:** [`backlog.md` § `appointments`](../backlog.md#appointments)
- **Contrato del frontend:** `front/src/modules/appointments/types/appointment.types.ts` (`appointmentSchema`, `Appointment`, `scheduleBlockSchema`, `ScheduleBlock`) y `api/appointments.api.ts` (`findAppointmentConflict` y `findScheduleBlockConflict` describen los choques).

## 1. Objetivo y alcance

Los 8 endpoints de la agenda:
- **Citas:** listar, listar por paciente, ver, crear, editar y cambiar de estado.
- **Bloqueos de horario:** listar, crear y borrar.

La API valida la disponibilidad del profesional y del consultorio (`409` ante un choque), **también cuando dos personas agendan a la vez**.

**Fuera de alcance:**
- **Notificaciones de confirmación y cancelación:** este plan deja el punto donde se disparan (`IAppointmentEvents`), y `notifications` las implementa (orden 7).
- **Bloqueos recurrentes** ("todos los lunes"): es un cambio de modelo.

## 2. Decisiones

| # | Decisión | Propuesta |
|---|---|---|
| A1 | Fecha y hora | El frontend envía `date` + `startTime` + `endTime` **en hora de la clínica**. La API las convierte a UTC con `ClinicClock` y devuelve `start`/`end` en ISO UTC, como espera `Appointment`. El mock lo hacía con la hora del navegador, y fallaba si el navegador estaba en otra zona. |
| A2 | `GET /appointments` sin filtros | Acepta `from`/`to` (fechas de la clínica, inclusivas), `patientId` y `professionalId`. **Sin `from`/`to` devuelve todas,** porque es lo que pide hoy el frontend. Con algunos miles de citas al año alcanza para empezar. Queda pendiente que el frontend envíe el rango que muestra el calendario. |
| A3 | Qué cuenta como ocupado | Toda cita no cancelada (también `completada` y `no_asistio`) y todo bloqueo, igual que el mock. Los bloqueos sí se pueden superponer entre sí. |
| A4 | Dos agendados a la vez | Dentro de una transacción, la API toma un **candado de PostgreSQL** por profesional y por consultorio (`pg_advisory_xact_lock`) antes de revisar choques. El segundo espera a que termine el primero y entonces ve su cita: uno recibe `201` y el otro `409`. |
| A5 | Cambios de estado permitidos | Los mismos botones del frontend: `programada → confirmada`; `programada` o `confirmada` → `completada`, `no_asistio` o `cancelada`. `cancelada`, `completada` y `no_asistio` son finales. Otro cambio: `409`. Repetir el mismo estado: `200` sin cambios. |
| A6 | Editar una cita | Solo si está `programada` o `confirmada` (`409` si no). Se revisan los choques excluyendo la propia cita. |
| A7 | Citas en el pasado | Se permiten, para registrar tarde una cita que ya ocurrió. Duración: de 5 minutos a 12 horas, en el mismo día. |
| A8 | Tratamiento de la cita | Opcional. Debe existir y estar activo. Al tener citas, un tratamiento no se puede borrar: `DELETE /treatments/:id` responde `409` ("desactívalo en su lugar"). |

## 3. Archivos

### Nuevos

```text
back/docs/plan-citas.md                             ← este plan (se borra al terminar)
back/src/ClinicApp.Api/Modules/Appointments/
├── AppointmentEntities.cs          ← Appointment, ScheduleBlock, AppointmentStatuses
├── AppointmentConfiguration.cs     ← tablas, CHECK, índices
├── AppointmentDtos.cs              ← AppointmentRequest, AppointmentDto, StatusRequest, ScheduleBlockRequest, ScheduleBlockDto
├── AvailabilityService.cs          ← candados (A4) y búsqueda de choques (los mismos mensajes del mock)
├── IAppointmentEvents.cs           ← "se creó" / "se canceló" una cita; sin efecto hasta notifications
├── AppointmentsController.cs       ← /api/appointments
└── ScheduleBlocksController.cs     ← /api/schedule-blocks
back/src/ClinicApp.Api/Data/Migrations/<fecha>_CrearCitas.cs (+ .Designer.cs)
```

### Modificados

| Archivo | Cambio |
|---|---|
| `Data/AppDbContext.cs` | `DbSet` de las 2 tablas |
| `Modules/Treatments/TreatmentsController.cs` | `409` al borrar un tratamiento con citas (A8) |
| `Program.cs` | Registrar `AvailabilityService` e `IAppointmentEvents` (sin efecto) |
| `ClinicApp.Api.http`, `docs/*`, `backlog.md`, `backlog-desgloce.md` | Documentación |

## 4. Entidades

### `Appointment` → tabla `appointments`

| Atributo | Tipo C# | Columna | Reglas |
|---|---|---|---|
| `Id` | `Guid` | `uuid` PK | |
| `PatientId` | `Guid` | `uuid` FK → `patients` (restrict) | Activo (no dado de baja) al crear. Índice `(patient_id, start)`. |
| `ProfessionalId` | `Guid` | `uuid` FK → `professionals` (restrict) | Activo. Índice `(professional_id, start)`. |
| `TreatmentId` | `Guid?` | `uuid` FK → `treatments` (restrict) | A8 |
| `RoomId` | `Guid?` | `uuid` FK → `rooms` (restrict) | Activo. Índice `(room_id, start)`. |
| `Start` / `End` | `DateTime` | `timestamptz` | UTC (A1). `CHECK (end > start)`. Índice `start`. |
| `Status` | `string` | `varchar(15)` | Los 5 estados (`CHECK`). Nace `programada`. |
| `Notes` | `string?` | `varchar(1000)` null | |
| `CreatedAt` | `DateTime` | `timestamptz` | |
| `CreatedByUserId` | `Guid?` | `uuid` FK → `users` (set null) | Auditoría |
| `UpdatedAt` | `DateTime?` | `timestamptz` null | |
| `StatusChangedAt` | `DateTime?` | `timestamptz` null | Último cambio de estado |
| `StatusChangedByUserId` | `Guid?` | `uuid` FK → `users` (set null) | |

### `ScheduleBlock` → tabla `schedule_blocks`

| Atributo | Tipo C# | Columna | Reglas |
|---|---|---|---|
| `Id` | `Guid` | `uuid` PK | |
| `ProfessionalId` | `Guid?` | `uuid` FK → `professionals` (restrict) | |
| `RoomId` | `Guid?` | `uuid` FK → `rooms` (restrict) | `CHECK`: al menos uno de los dos |
| `Start` / `End` | `DateTime` | `timestamptz` | `CHECK (end > start)`. Índice `start`. |
| `Reason` | `string` | `varchar(300)` | Mínimo 3 |
| `CreatedAt` | `DateTime` | `timestamptz` | |
| `CreatedByUserId` | `Guid?` | `uuid` FK → `users` (set null) | |

## 5. Endpoints

Roles: los tres.

| Método y ruta | Respuesta | Errores |
|---|---|---|
| `GET /api/appointments?from&to&patientId&professionalId` | `200` `Appointment[]` por `start`. Con `patientId`: de la más reciente a la más antigua. | `400` fechas inválidas o `from > to` |
| `GET /api/appointments/:id` | `200` | `404` |
| `POST /api/appointments` | `201` `Appointment` (`programada`) | `400` por campo (paciente, profesional o consultorio inexistente o inactivo, hora de fin anterior); `409` choque (`errors.startTime`) |
| `PUT /api/appointments/:id` | `200` | `400`, `404`, `409` (choque o estado no editable, A6) |
| `PATCH /api/appointments/:id/status` `{ status }` | `200` | `400` estado desconocido; `404`; `409` cambio no permitido (A5) |
| `GET /api/schedule-blocks?from&to` | `200` `ScheduleBlock[]` por `start` (sin rango: todos) | |
| `POST /api/schedule-blocks` | `201` | `400`; `409` si choca con una cita no cancelada (`errors.startTime`) |
| `DELETE /api/schedule-blocks/:id` | `204` | `404` |

## 6. Reglas de negocio

**Choques (A3).** Se revisan en este orden y con los mismos mensajes del mock:
1. "El profesional ya tiene una cita agendada en ese horario"
2. "El consultorio ya está ocupado en ese horario"
3. "El profesional tiene un bloqueo de horario en ese rango"
4. "El consultorio tiene un bloqueo de horario en ese rango"

Dos rangos chocan si `inicioA < finB` y `finA > inicioB`: una cita que termina a las 10:00 no choca con una que empieza a las 10:00.

**Bloqueos.** No se pueden crear sobre una cita no cancelada del mismo profesional o consultorio: "El profesional tiene una cita agendada en ese horario" o "El consultorio tiene una cita agendada en ese horario".

**Concurrencia (A4).**
- Crear y editar citas, y crear bloqueos, toman los candados del profesional y del consultorio, siempre en el mismo orden para no bloquearse entre sí.
- Los candados se sueltan solos al terminar la transacción.

**Eventos.**
- Al crear una cita, y al pasarla a `cancelada`, se llama a `IAppointmentEvents` **después** de guardar.
- Hasta que exista `notifications` no hace nada. Desde entonces registra la notificación sin frenar la respuesta.

**Historia clínica:** registrar una atención con cita la pasará a `completada`, solo desde `programada` o `confirmada`, con la misma regla A5.

## 7. Migración

`CrearCitas`: crea `appointments` y `schedule_blocks` con sus `CHECK`, sus FK y sus índices.

## 8. Pruebas

- **Roles:** los tres; sin sesión, `401`.
- **Crear:**
  - `201` con `start`/`end` en UTC: 09:00 en Ecuador = 14:00 UTC;
  - `400` por paciente dado de baja, profesional o consultorio inactivo, tratamiento inactivo, fin antes del inicio y duración fuera de rango.
- **Choques:**
  - los 4 mensajes de § 6;
  - citas pegadas (10:00 y 10:00) sí se permiten;
  - una cita cancelada no ocupa el horario.
- **Concurrencia:** 10 creaciones simultáneas en el mismo horario y profesional: 1 `201` y 9 `409`.
- **Editar:** excluye la propia cita; una cita `completada` no se edita (`409`).
- **Estados:** cada transición permitida `200`; las demás `409`.
- **Listas:** rango `from`/`to` inclusivo en hora de la clínica; `patientId` descendente; sin filtros, todas.
- **Bloqueos:** crear, borrar, choque con una cita `409`, superponerse con otro bloqueo se permite, sin profesional ni consultorio `400`.
- **Tratamientos:** borrar uno con citas, `409`.
- **Regresión:** pruebas anteriores.

## 9. Al terminar

- Actualizar `estructura-base.md` y `endpoints-api.md`.
- **Anotar como pendientes:**
  - en el frontend, enviar `from`/`to` del calendario (A2) y dejar de convertir la hora a UTC en el navegador (A1);
  - los bloqueos recurrentes, si la clínica los pide.
- Commit. Borrar este plan.
