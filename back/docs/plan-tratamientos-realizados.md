# Plan de implementación — tratamientos realizados (`treatment-assignments`)

- **Responsable:** Jorge Flores
- **Orden:** 4 de [`backlog-desgloce.md`](../backlog-desgloce.md)
- **Estado:** en revisión. Ninguna decisión aprobada.
- **Depende de:** `patients` (ya implementado). Usa el catálogo de tratamientos y `StockService`, que ya existen.
- **Detalle de endpoints:** [`backlog.md` § `treatments`](../backlog.md#treatments)
- **Contrato del frontend:** `front/src/modules/treatments/types/treatment.types.ts` (`TreatmentAssignment`, `CreateAssignmentInput`) y `api/treatments.api.ts` (`createAssignmentMock`: idempotencia y consumo de insumos).

## 1. Objetivo y alcance

Los 3 endpoints de tratamientos realizados:
- **Registrar uno realizado en una atención:** descuenta sus insumos del inventario.
- **Listar los de un tratamiento:** "Pacientes que recibieron este tratamiento".
- **Listar los de un paciente:** pestaña "Tratamientos" de la historia clínica.

Además:
- **Borrar un tratamiento usado:** `DELETE /treatments/:id` responde `409` si tiene tratamientos realizados.
- **Llave foránea pendiente:** `stock_movements.treatment_assignment_id` → `treatment_assignments`.

**Fuera de alcance:**
- **Registrar en una sola transacción** los tratamientos, la atención y la cita (historia clínica, D2).
- **Tratamientos de varias sesiones:** el frontend quitó "+ Sesión" y solo registra realizados completos.

## 2. Decisiones

| # | Decisión | Propuesta |
|---|---|---|
| T1 | Idempotencia | Por `sourceKey` (atención + tratamiento de esa atención), único en la base. Si ya existe, `200` con el existente, **sin volver a descontar insumos**. Si el `sourceKey` existe pero con otro paciente o tratamiento, `409`. Dos reintentos simultáneos: la llave única impide el duplicado y el segundo recibe el existente. |
| T2 | Insumos sin stock | Se registra igual: `StockService.ConsumeAsync` descuenta lo disponible y deja un aviso en el log, como pide el backlog ("nunca falla por falta de stock"). |
| T3 | `sourceEncounterId` sin llave foránea | El frontend registra los tratamientos **antes** de crear la atención (`useRegisterEncounter`), así que la atención todavía no existe. La FK se agrega con el registro transaccional de la historia clínica. |
| T4 | Quién registra | `admin` y `medico`, porque solo se registra desde la historia clínica. Leer: los tres. |
| T5 | Precio | `price` de 0 a 99 999 999,99. Si no viene, se usa el precio del catálogo. |
| T6 | Profesional que lo realizó | No viene en `CreateAssignmentInput`. Se deja la columna `professional_id` (nulable) para que la historia transaccional la llene y reportes cuente sesiones por profesional. |

## 3. Archivos

### Nuevos

```text
back/docs/plan-tratamientos-realizados.md            ← este plan (se borra al terminar)
back/src/ClinicApp.Api/Modules/Treatments/
├── TreatmentAssignment.cs                ← entidad y AssignmentStatuses
├── TreatmentAssignmentConfiguration.cs   ← tabla, CHECK, índices, sourceKey único
├── TreatmentAssignmentDtos.cs            ← CreateAssignmentRequest, TreatmentAssignmentDto
└── TreatmentAssignmentsController.cs     ← /api/treatment-assignments
back/src/ClinicApp.Api/Data/Migrations/<fecha>_CrearTratamientosRealizados.cs (+ .Designer.cs)
```

### Modificados

| Archivo | Cambio |
|---|---|
| `Data/AppDbContext.cs` | `DbSet<TreatmentAssignment>` |
| `Modules/Treatments/TreatmentsController.cs` | `GET /treatments/:id/assignments`; `409` al borrar uno con tratamientos realizados |
| `Modules/Inventory/InventoryConfiguration.cs` | FK `stock_movements.treatment_assignment_id` (restrict) |
| `Modules/Auth/Roles.cs` | `AdminYMedico` (si no se creó antes) |
| `ClinicApp.Api.http`, `docs/*`, `backlog.md`, `backlog-desgloce.md` | Documentación |

## 4. Entidad

### `TreatmentAssignment` → tabla `treatment_assignments`

| Atributo | Tipo C# | Columna | Reglas |
|---|---|---|---|
| `Id` | `Guid` | `uuid` PK | |
| `TreatmentId` | `Guid` | `uuid` FK → `treatments` (restrict) | Índice |
| `PatientId` | `Guid` | `uuid` FK → `patients` (restrict) | Índice `(patient_id, start_date)` |
| `TotalSessions` / `CompletedSessions` | `int` | `integer` | 1 / 1 al registrar. `CHECK (completed <= total)`. |
| `Status` | `string` | `varchar(15)` | `en_progreso`, `completado`, `suspendido` (`CHECK`). Nace `completado`. |
| `StartDate` | `DateOnly` | `date` | La fecha de la atención (`date`). No futura (`ClinicClock`). |
| `Tooth` | `string` | `varchar(60)` | Pieza o zona; puede ir vacío |
| `SourceEncounterId` | `Guid?` | `uuid` null | Sin FK por ahora (T3) |
| `SourceKey` | `string?` | `varchar(200)` null | Único cuando no es `null` (T1) |
| `Price` | `decimal?` | `numeric(10,2)` null | T5 |
| `ProfessionalId` | `Guid?` | `uuid` FK → `professionals` (restrict) null | T6 |
| `CreatedAt` | `DateTime` | `timestamptz` | |
| `CreatedByUserId` | `Guid?` | `uuid` FK → `users` (set null) | |

## 5. Endpoints

| Método y ruta | Roles | Respuesta | Errores |
|---|---|---|---|
| `GET /api/treatments/:id/assignments` | Los tres | `200` `TreatmentAssignment[]`, del más reciente al más antiguo | `404` tratamiento |
| `GET /api/treatment-assignments?patientId=` | Los tres | `200` `TreatmentAssignment[]`, del más reciente al más antiguo | `400` sin `patientId` |
| `POST /api/treatment-assignments` | `admin`, `medico` | `201` (o `200` si ya existía, T1) | `404` tratamiento; `400` tratamiento inactivo, paciente inexistente o dado de baja, fecha futura, precio fuera de rango; `409` `sourceKey` de otro paciente o tratamiento |

## 6. Reglas de negocio

**Registrar (`POST`), en una sola transacción:**
1. Si `sourceKey` ya existe → T1.
2. Se validan el tratamiento, el paciente, la fecha y el precio.
3. Se crea la asignación `completado`, 1 de 1 sesión.
4. Por cada insumo del tratamiento (`treatment_consumptions`), `StockService.ConsumeAsync` descuenta `quantity` por FEFO. El movimiento lleva:
   - `reason` "Tratamiento realizado: <nombre>";
   - `treatment_assignment_id`, `patient_id` y el usuario.
5. Si algo falla, no queda ni la asignación ni los movimientos.

**Borrar un tratamiento del catálogo:** `409` si tiene tratamientos realizados o citas (este último caso viene del plan de citas): "Este tratamiento ya se usó. Desactívalo en su lugar."

## 7. Migración

`CrearTratamientosRealizados`: crea la tabla, el índice único parcial de `source_key` y la FK de `stock_movements.treatment_assignment_id`. Esa columna hoy siempre está vacía.

## 8. Pruebas

- **Roles:** `recepcion` lee, pero recibe `403` al registrar.
- **Registrar:**
  - `201` y el stock baja según el consumo del tratamiento, por FEFO;
  - los movimientos traen la asignación y el paciente.
- **Idempotencia:**
  - el mismo `sourceKey` dos veces: `200`, sin descontar de nuevo;
  - 10 reintentos simultáneos: una sola asignación y un solo descuento;
  - el mismo `sourceKey` con otro paciente: `409`.
- **Sin stock:** se registra igual, el stock queda en 0 y hay un aviso en el log.
- **Validación:** tratamiento inactivo, paciente dado de baja, fecha futura y precio negativo dan `400`.
- **Listas:** por tratamiento y por paciente, en orden descendente.
- **Catálogo:** borrar un tratamiento usado: `409`.
- **Regresión:** pruebas anteriores.

## 9. Al terminar

- Actualizar `estructura-base.md` y `endpoints-api.md`.
- **Anotar como pendientes:**
  - la FK de `source_encounter_id` y el registro transaccional (historia clínica);
  - el profesional que lo realizó (T6).
- Commit. Borrar este plan.
