# Plan de implementación — profesionales y consultorios (`appointments`, parte 1)

- **Responsable:** Jorge Flores
- **Orden:** 2 de [`backlog-desgloce.md`](../backlog-desgloce.md)
- **Estado:** en revisión. Ninguna decisión aprobada.
- **Detalle de endpoints:** [`backlog.md` § `appointments`](../backlog.md#appointments) (`GET /professionals`, `GET /rooms`)
- **Contrato del frontend:** `front/src/modules/appointments/types/appointment.types.ts` (`Professional`, `Room`) y `api/appointments.api.ts` (`listProfessionals`, `listRooms`).

## 1. Objetivo y alcance

Los dos catálogos de los que dependen la agenda, la historia clínica y la esterilización:
- **Profesionales:** nombre, especialidad y registro profesional (MSP / Senescyt).
- **Consultorios.**

Además:
- **Llaves foráneas pendientes:**
  - `users.professional_id` → `professionals`;
  - `sterilization_cycles.responsible_professional_id` → `professionals`. Desde aquí se valida que el responsable de un ciclo exista.
- **Altas y cambios para el administrador** (C1). El frontend no tiene pantalla, pero sin estos endpoints en producción solo se podrían crear con SQL.

**Fuera de alcance:** las sedes (si la clínica tiene varias, los consultorios se vincularían a una; ver `institution`).

## 2. Decisiones

| # | Decisión | Propuesta |
|---|---|---|
| C1 | Cómo se crean | Endpoints `POST`/`PUT` solo para `admin`. La pantalla de administración queda pendiente en el frontend. En desarrollo, una semilla crea los 3 profesionales y los 3 consultorios del modo mock. |
| C2 | Borrar | **No se borran:** se desactivan (`active = false`). Un profesional tiene citas, atenciones y ciclos que deben seguir mostrando su nombre. |
| C3 | Qué devuelve `GET` | **Todos, también los inactivos,** con un campo nuevo `active`. Así la agenda y la historia muestran el nombre de un profesional que ya no trabaja. El frontend debe ofrecer solo los activos en los selectores (cambio pendiente). |
| C4 | Usuario ↔ profesional | `PUT /professionals/:id` acepta `userId` (o `null`) y actualiza `users.professional_id`. Un usuario tiene como máximo un profesional, y un profesional, como máximo un usuario. |
| C5 | Paginación | No: el frontend espera una lista completa. Son pocos (decenas como mucho). |

## 3. Archivos

### Nuevos

```text
back/docs/plan-profesionales-consultorios.md            ← este plan (se borra al terminar)
back/src/ClinicApp.Api/Modules/Appointments/
├── Professional.cs, Room.cs                ← entidades
├── CatalogConfiguration.cs                 ← tablas, índices, FK de users y esterilización
├── CatalogDtos.cs                          ← ProfessionalDto, ProfessionalRequest, RoomDto, RoomRequest
├── ProfessionalsController.cs              ← /api/professionals
├── RoomsController.cs                      ← /api/rooms
└── CatalogSeeder.cs                        ← los del modo mock, solo en Development y con las tablas vacías
back/src/ClinicApp.Api/Data/Migrations/<fecha>_CrearProfesionalesYConsultorios.cs (+ .Designer.cs)
```

### Modificados

| Archivo | Cambio |
|---|---|
| `Data/AppDbContext.cs` | `DbSet` de las 2 tablas |
| `Modules/Auth/AuthConfiguration.cs` | FK `users.professional_id` → `professionals` (set null), índice único parcial |
| `Modules/Inventory/InventoryConfiguration.cs` | FK `sterilization_cycles.responsible_professional_id` → `professionals` (restrict) |
| `Modules/Inventory/SterilizationCyclesController.cs` | `400` si el responsable no existe o está inactivo (`errors.responsibleProfessionalId`) |
| `Program.cs` | Registrar `CatalogSeeder` |
| `ClinicApp.Api.http`, `docs/estructura-base.md`, `docs/endpoints-api.md`, `backlog.md`, `backlog-desgloce.md` | Documentación |

## 4. Entidades

### `Professional` → tabla `professionals`

| Atributo | Tipo C# | Columna | Reglas |
|---|---|---|---|
| `Id` | `Guid` | `uuid` PK | |
| `Name` | `string` | `varchar(120)` | 3 a 120, con el título ("Dra. Carla Ríos") |
| `Specialty` | `string` | `varchar(80)` | 2 a 80 |
| `RegistrationNumber` | `string` | `varchar(40)` | Vacío si no se registró |
| `Active` | `bool` | `boolean` | C2 |
| `CreatedAt` | `DateTime` | `timestamptz` | |

### `Room` → tabla `rooms`

| Atributo | Tipo C# | Columna | Reglas |
|---|---|---|---|
| `Id` | `Guid` | `uuid` PK | |
| `Name` | `string` | `varchar(60)` | 2 a 60. Único entre los activos. |
| `Active` | `bool` | `boolean` | C2 |
| `CreatedAt` | `DateTime` | `timestamptz` | |

## 5. Endpoints

| Método y ruta | Roles | Respuesta | Errores |
|---|---|---|---|
| `GET /api/professionals` | Los tres | `200` `[{ id, name, specialty, registrationNumber, active, userId }]`, por nombre | |
| `POST /api/professionals` | `admin` | `201` | `400` |
| `PUT /api/professionals/:id` | `admin` | `200`. Incluye `active` y `userId` (C4). | `400`; `404`; `409` si el usuario ya está vinculado a otro profesional |
| `GET /api/rooms` | Los tres | `200` `[{ id, name, active }]`, por nombre | |
| `POST /api/rooms` | `admin` | `201` | `400`; `409` nombre repetido |
| `PUT /api/rooms/:id` | `admin` | `200` | `400`, `404`, `409` |

## 6. Reglas de negocio

- **Profesional o consultorio inactivo:** no se puede usar en citas, bloqueos ni ciclos nuevos (`400`). Lo ya registrado no cambia.
- **Desactivar un profesional con citas futuras:** se permite, pero la respuesta trae `futureAppointments: N`, para que el frontend avise que hay que reasignarlas.
- **Usuario vinculado (C4):**
  - `/auth/me` sigue devolviendo `professionalId`.
  - La historia clínica lo usa como profesional por defecto de una atención nueva. Así se puede quitar la comparación por nombre de `use-default-professional.ts` (cambio pendiente en el frontend).

## 7. Migración

`CrearProfesionalesYConsultorios`:
1. Crea `professionals` y `rooms`.
2. **Datos existentes:**
   - Si hay ciclos de esterilización con un responsable que no existe (hoy son `id` sin validar), crea un profesional inactivo "Responsable no registrado" y los apunta a él.
   - Los `users.professional_id` que no existan se ponen en `null`.
3. Crea las dos FK.

Antes de aplicarla se revisa el SQL.

## 8. Pruebas

- **Roles:** los tres listan; solo `admin` crea y edita.
- **Profesionales:**
  - crear, editar y desactivar;
  - el inactivo sigue en la lista con `active: false`;
  - vincular un usuario: `/auth/me` devuelve su `professionalId`; vincular el mismo usuario a otro profesional: `409`.
- **Consultorios:** crear, editar, nombre repetido `409`, desactivar.
- **Esterilización:** un responsable inexistente o inactivo responde `400`.
- **Migración:** con un ciclo de responsable inventado, queda apuntando a "Responsable no registrado".
- **Regresión:** pruebas anteriores.

## 9. Al terminar

- Actualizar `estructura-base.md` y `endpoints-api.md`.
- **Anotar como pendientes en el frontend:**
  - la pantalla para administrar profesionales y consultorios;
  - mostrar solo los activos en los selectores (C3);
  - usar `professionalId` del usuario en la historia clínica (§ 6).
- Commit. Borrar este plan.
