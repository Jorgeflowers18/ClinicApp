# Plan de implementación — `patients`

- **Responsable:** Jorge Flores
- **Orden:** 1 de [`backlog-desgloce.md`](../backlog-desgloce.md)
- **Estado:** en revisión. Ninguna decisión aprobada.
- **Detalle de endpoints:** [`backlog.md` § `patients`](../backlog.md#patients)
- **Contrato del frontend:** `front/src/modules/patients/types/patient.types.ts` (`patientSchema`, `Patient`) y `api/patients.api.ts` (las funciones `*Mock` describen el comportamiento esperado).

## 1. Objetivo y alcance

Los 5 endpoints que el frontend ya llama: listar con búsqueda, ver, crear, editar y dar de baja un paciente.

Además:
- **Número de historia clínica** correlativo (`HC-000123`), asignado por el servidor.
- **Baja lógica:** el paciente no se borra, porque tiene citas, tratamientos, historia y pagos.
- **`ClinicClock`:** "la fecha de hoy en la clínica", para validar que la fecha de nacimiento no sea futura. Se crea aquí porque es el primer módulo que lo necesita; después lo usan citas, tratamientos realizados, historia clínica y reportes.
- **Llave foránea** de `stock_movements.patient_id` a `patients`, pendiente desde inventario.

**Fuera de alcance:**
- **Importar los 820 pacientes actuales** (P3): necesita las respuestas de `documentacion/decisiones-backend.md` § 5. La tabla queda preparada para recibirlos.
- **Calcular la última visita sola** desde las atenciones: llega con la historia clínica. Hasta entonces se edita a mano, como hoy en el formulario.

## 2. Decisiones

| # | Decisión | Propuesta |
|---|---|---|
| P1 | Baja lógica | `DELETE` marca `deleted_at`. El paciente **desaparece de la lista y de la búsqueda**, pero `GET /patients/:id` lo sigue devolviendo (con `deletedAt`) para que sus citas e historia se puedan abrir. Reactivar: `POST /patients/:id/restore`, solo `admin`, sin pantalla por ahora. |
| P2 | N.° de historia clínica | Secuencia de PostgreSQL. Se guarda el número (`123`) y la API lo devuelve con formato `HC-000123`. Al importar se conservan las fichas actuales y la secuencia sigue desde la última (826), como recomienda `decisiones-backend.md` § 5.1. |
| P3 | Importación | Fuera de este plan. Se hará con un comando de una sola vez (`dotnet run -- import-patients <archivo>`), con su propio plan. **El archivo real nunca se sube al repositorio ni se imprime.** |
| P4 | `medicalHistory` y `allergies` antiguos | No hay nada que migrar: el backend nunca los guardó y el frontend ya los quitó. El archivo de la clínica tampoco los tiene (sus "Observaciones" van a `notes` al importar). |
| P5 | Cédula repetida | La base **no** la hace única: el archivo de la clínica tiene 25 cédulas repetidas y 173 que no son cédulas. La API rechaza con `409` crear un paciente con la cédula de otro paciente activo, o cambiarla a una ya usada. Editar otros datos de un paciente importado con cédula repetida sí se permite. |
| P6 | Búsqueda | Por nombres, apellidos, cédula, teléfono y N.° de historia clínica, **sin distinguir mayúsculas ni tildes** ("perez" encuentra "Pérez"), con la extensión `unaccent` de PostgreSQL. |
| P7 | Quién da de baja | `admin` y `recepcion`. El médico puede ver, crear y editar, pero no dar de baja. El frontend debe ocultarle el botón (cambio pendiente). |
| P8 | Fecha de nacimiento | Obligatoria en el formulario, no futura y desde 1900. En la base es **nulable**, porque 4 pacientes del archivo tienen fechas imposibles; si falta, la API devuelve `""`. |

## 3. Archivos

### Nuevos

```text
back/docs/plan-pacientes.md                         ← este plan (se borra al terminar)
back/src/ClinicApp.Api/Common/
├── ClinicClock.cs               ← "hoy" y conversión de fecha y hora local ↔ UTC con la zona de la clínica
└── TextSearch.cs                ← EF.Functions para unaccent + ILIKE (P6)
back/src/ClinicApp.Api/Modules/Patients/
├── Patient.cs                   ← entidad y listas de valores (género, estado civil, estado de tratamiento)
├── PatientConfiguration.cs      ← tabla, secuencia, CHECK, índices
├── PatientDtos.cs               ← PatientRequest (patientSchema), PatientDto (Patient)
└── PatientsController.cs        ← /api/patients
back/src/ClinicApp.Api/Data/Migrations/<fecha>_CrearPacientes.cs (+ .Designer.cs)
```

### Modificados

| Archivo | Cambio |
|---|---|
| `Data/AppDbContext.cs` | `DbSet<Patient>`; extensión `unaccent`; secuencia `patient_record_number_seq` |
| `Modules/Inventory/InventoryConfiguration.cs` | FK `stock_movements.patient_id` → `patients` (restrict) |
| `Modules/Inventory/SterilizationCyclesController.cs` | "No futura" con `ClinicClock`; se quita la tolerancia de un día |
| `Modules/Auth/Roles.cs` | Nada nuevo (`Todos` y `AdminYRecepcion` ya existen) |
| `Program.cs` | Registrar `ClinicClock` (valida la zona al arrancar) |
| `appsettings.json` | `Clinic:TimeZone` = `America/Guayaquil` |
| `ClinicApp.Api.http` | Peticiones de ejemplo |
| `docs/estructura-base.md`, `docs/endpoints-api.md` | Tabla y endpoints nuevos |
| `backlog.md`, `backlog-desgloce.md` | Marcar lo hecho y anotar lo pendiente |

## 4. Entidad

### `Patient` → tabla `patients`

| Atributo | Tipo C# | Columna | Reglas |
|---|---|---|---|
| `Id` | `Guid` | `uuid` PK | UUID v7 |
| `RecordNumber` | `int` | `integer` | Único. Lo asigna la secuencia (P2). Se expone como `clinicalRecordNumber: "HC-000123"`. Nunca cambia. |
| `FirstName` / `LastName` | `string` | `varchar(80)` | 2 a 80 |
| `DocumentId` | `string` | `varchar(20)` | 5 a 20. Índice, **no único** (P5). |
| `BirthDate` | `DateOnly?` | `date` null | P8 |
| `Gender` | `string` | `varchar(10)` | `femenino`, `masculino`, `otro` (`CHECK`) |
| `MaritalStatus` | `string` | `varchar(15)` | `""` o las 5 opciones (`CHECK`) |
| `Occupation`, `Company` | `string` | `varchar(120)` | |
| `Nationality` | `string` | `varchar(60)` | |
| `Phone` | `string` | `varchar(30)` | 7 a 30 |
| `Email` | `string` | `varchar(254)` | Correo válido o `""`. En minúsculas. |
| `Address` | `string` | `varchar(250)` | |
| `City` | `string` | `varchar(120)` | Ciudad / provincia |
| `Notes` | `string` | `varchar(2000)` | |
| `NotificationsEnabled` | `bool` | `boolean` | `true` por defecto |
| `EmergencyContactName` | `string` | `varchar(120)` | |
| `EmergencyContactRelationship` | `string` | `varchar(60)` | |
| `EmergencyContactPhone` | `string` | `varchar(30)` | |
| `InsuranceProvider` | `string` | `varchar(120)` | |
| `InsurancePolicy` | `string` | `varchar(60)` | |
| `ConsentSigned` | `bool` | `boolean` | |
| `TreatmentStatus` | `string` | `varchar(20)` | `activo`, `en seguimiento`, `pendiente`, `inactivo` (`CHECK`) |
| `LastVisitAt` | `DateOnly?` | `date` null | Manual por ahora; se devuelve `""` si está vacía |
| `CreatedAt` | `DateTime` | `timestamptz` | Índice (la lista se ordena por aquí, de la más reciente a la más antigua) |
| `UpdatedAt` | `DateTime?` | `timestamptz` null | |
| `CreatedByUserId`, `UpdatedByUserId` | `Guid?` | `uuid` FK → `users` (set null) | Auditoría, no se expone |
| `DeletedAt` | `DateTime?` | `timestamptz` null | Baja lógica (P1). Se expone como `deletedAt` (`null` si está activo). |
| `DeletedByUserId` | `Guid?` | `uuid` FK → `users` (set null) | |

Los textos opcionales se guardan como `""`, no `null`, porque así los envía y espera el frontend.

## 5. Endpoints

Roles: los tres, salvo `DELETE` (P7) y `restore`.

| Método y ruta | Respuesta | Errores |
|---|---|---|
| `GET /api/patients?page&pageSize&search` | `200` paginado, `Patient`. Sin los dados de baja. De la más reciente a la más antigua. | |
| `GET /api/patients/:id` | `200` `Patient` (también si está dado de baja) | `404` |
| `POST /api/patients` | `201` `Patient` con su `clinicalRecordNumber` | `400` por campo; `409` cédula de otro paciente activo (`errors.documentId`) |
| `PUT /api/patients/:id` | `200` `Patient`. Ignora `clinicalRecordNumber`. | `400`, `404`, `409` como `POST`. `409` si está dado de baja ("Reactiva al paciente antes de editarlo"). |
| `DELETE /api/patients/:id` | `204` | `404`; `403` para `medico`. Repetirlo sobre uno ya dado de baja: `204`. |
| `POST /api/patients/:id/restore` | `200` `Patient` | `404`; `409` si su cédula ya la usa otro paciente activo; `403` si no es `admin` |

## 6. Reglas de negocio

- **Validación:** las mismas de `patientSchema`, más los máximos de § 4 y la fecha de nacimiento (P8). Los espacios al inicio y al final se quitan.
- **Número de historia:** lo toma la secuencia al insertar. Si el guardado falla, ese número se pierde (queda un salto). Es normal en PostgreSQL y aceptable para un correlativo de fichas.
- **Baja (P1):**
  - Un paciente dado de baja no aparece en `GET /patients` ni en los selectores.
  - Los módulos siguientes (citas, tratamientos realizados, historia clínica) responden `400` si se les envía un paciente dado de baja.
  - Lo ya registrado se conserva y se sigue mostrando.

## 7. Migración

`CrearPacientes`:
- `CREATE EXTENSION IF NOT EXISTS unaccent;`
- La secuencia `patient_record_number_seq` (desde 1) y la tabla `patients`, con sus `CHECK` y sus índices:
  - `record_number`, único;
  - `document_id`;
  - `created_at`;
  - `deleted_at`.
- La FK de `stock_movements.patient_id`. Hoy esa columna siempre está vacía, así que no hay datos que ajustar.

Antes de aplicarla se revisa el SQL con `dotnet ef migrations script`.

## 8. Pruebas

Script de punta a punta contra la base local:

- **Roles:** los tres listan, ven, crean y editan; `medico` recibe `403` al dar de baja; solo `admin` reactiva; sin sesión, `401`.
- **Crear:**
  - `201`, con `HC-000001`, `HC-000002`… correlativos;
  - `notificationsEnabled` en `true` si no se envía;
  - `400` por cada regla: nombres cortos, cédula corta, teléfono corto, correo inválido, género inválido, nacimiento futuro o anterior a 1900, máximos de largo;
  - `409` con una cédula ya usada.
- **Editar:**
  - `clinicalRecordNumber` no cambia aunque se envíe;
  - cambiar la cédula a una usada: `409`;
  - mantener una cédula repetida de un paciente importado: se permite (simulado con SQL).
- **Buscar:** por nombre sin tilde, por apellido, por cédula parcial, por teléfono y por `HC-000002`; paginación y orden.
- **Baja:** desaparece de la lista; `GET` por `id` lo devuelve con `deletedAt`; editarlo da `409`; reactivarlo lo devuelve a la lista.
- **Zona horaria:** "hoy" en Ecuador se acepta como fecha de nacimiento y "mañana" se rechaza. Esterilización sigue la misma regla.
- **Regresión:** las pruebas de inventario y tratamientos siguen pasando.

## 9. Al terminar

- Actualizar `estructura-base.md` y `endpoints-api.md`.
- **Anotar como pendientes:**
  - la importación de los pacientes (P3);
  - ocultar al médico el botón de dar de baja, y una pantalla para ver y reactivar los dados de baja (P1, P7);
  - la última visita calculada desde las atenciones (historia clínica).
- Commit en la rama actual. El push, solo si lo pides.
- Borrar este plan.
