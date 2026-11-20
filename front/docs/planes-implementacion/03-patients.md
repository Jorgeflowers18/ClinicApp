# Plan 3 — `patients`

## Objetivo

Lista, ficha, alta y edición de pacientes contra la API (`endpoints-api.md` § 7), con la baja lógica y la reactivación.

**Módulo del conmutador:** `patients`. **Necesita:** el plan 1. Es la base de casi todo lo demás: citas, historia, tratamientos realizados y finanzas apuntan a pacientes reales.

## Mocks que se deshabilitan

| Mock (`patients.api.ts`) | Qué simula | Se reemplaza por |
|---|---|---|
| `listMock`: filtra sin tildes por nombre, cédula, teléfono y correo; filtros `status`, `gender`, `registeredFrom` y `registeredTo`; orden por `createdAt` | Búsqueda y filtros | `GET /patients?page&pageSize&search` (más los filtros nuevos, ver "Back") |
| `getMock` | Ficha | `GET /patients/:id` (devuelve también los dados de baja, con `deletedAt`) |
| `createMock`: valida con `patientEditorSchema`, cédula repetida → `409`, y **calcula el N.° de historia** (`HC-…`) | Alta | `POST /patients`. El número lo asigna una secuencia de PostgreSQL; la cédula repetida da `409` con `errors.documentId`. |
| `updateMock`: conserva el N.° de historia | Edición | `PUT /patients/:id` (ignora `clinicalRecordNumber`; `409` si está dado de baja) |
| `removeMock`: **pone `treatmentStatus: "inactivo"`** | Baja | `DELETE /patients/:id`: baja lógica con `deletedAt`. El paciente **desaparece** de la lista; su `treatmentStatus` no cambia. |
| (no existe) | — | `POST /patients/:id/restore` (solo admin) |
| `mockPatients` (`patients.mock-data.ts`) | Datos de demostración | Solo el modo mock. Ojo: `notifications.api.ts` y `reports.api.ts` también lo importan (se resuelve en los planes 8 y 10). |

## Diferencias de contrato

| Punto | Frontend | API | Resuelve |
|---|---|---|---|
| `documentType` (`cedula`, `pasaporte`, `otro`) | Existe; con `cedula` valida el dígito verificador (`isEcuadorianId`) | **No existe**: se pierde al guardar | **Back:** agregar el campo (y validar la cédula si `cedula`) |
| `phone` | **Opcional** (`optionalPhone`) | **Obligatorio**, de 7 a 30 | Decidir con la clínica. Si es opcional: **back** lo cambia. Si no: **front** vuelve a hacerlo obligatorio. Los datos que se importarán tienen pacientes sin teléfono, así que conviene opcional. |
| Filtros `status`, `gender`, `registeredFrom`, `registeredTo` | Los usa la lista y los 4 contadores (total, activos, en seguimiento, inactivos) | **Se ignoran**: los contadores darían todos el mismo número | **Back:** aceptarlos en `GET /patients` |
| Búsqueda por correo | El mock busca también en `email` | Nombres, cédula, teléfono y N.° de historia | Aceptable. Si se quiere el correo: back. |
| "Inactivo" | `removeMock` lo usa como baja | La baja es `deletedAt`; `inactivo` es solo un estado del tratamiento | Front: el contador "Inactivos" cuenta `treatmentStatus = inactivo`; los dados de baja van en otra vista (ver abajo) |
| `deletedAt` | No existe en el tipo | `null` o fecha | Front: sumarlo al tipo `Patient` |
| `lastVisitAt` | Campo heredado; `usePatientLastVisit` lo calcula de citas e historia | Se guarda tal cual, sin cálculo | Sin cambios. `usePatientLastVisit` sigue siendo la fuente (ver el pendiente "última visita" en el back). |
| Textos vacíos | `""` | `""` (no `null`) | Coinciden |

## Cambios en el frontend

1. **Estándar del plan 0:** `patients.contract.ts`, `patients.http.ts`, `patients.mock.ts` y `patients.api.ts`, más `restore(id)`. El mapeo convierte `documentType: null` en `undefined`.
2. **`queryFn` con `signal`** en `usePatientsList` y `usePatient`.
3. **Errores del servidor en el formulario** (`patient-form.tsx`): usar `applyServerFieldErrors`, para que el `409` de la cédula se marque en `documentId`. Revisar que el modal de edición (`patient-edit-modal`) haga lo mismo.
4. **Baja y reactivación:**
   - Hoy ninguna pantalla usa `useDeletePatient`. Agregar "Dar de baja" en `patient-actions.tsx` solo para `admin` y `recepcion`, porque el médico recibe `403`, con confirmación.
   - En la ficha, si `deletedAt` tiene valor:
     - aviso "Paciente dado de baja";
     - sin "Editar", porque el back responde `409`;
     - para admin, el botón "Reactivar" (`restore`).
   - Vista de dados de baja: depende del cambio del back (`?deleted=true`).
5. **Contadores de la lista** (`patients-list-page.tsx:32-35`): siguen con `pageSize: 1` y leen `totalItems`, lo que funciona en cuanto el back acepte `status`.
6. **`usePatientLastVisit`:** sin cambios. Ya respeta los roles, porque la historia solo la pide a admin y médico.

## Cambios necesarios en el back

En `PatientsController.List`, con un `PatientsQuery` que extienda `PageQuery`:
- **Filtros:**
  - `status` (`treatmentStatus` exacto);
  - `gender`;
  - `registeredFrom` y `registeredTo` (fechas de la clínica, inclusivas, sobre `createdAt`);
  - `deleted=true` (solo admin), para listar los dados de baja.
- **`documentType`:**
  - columna `varchar(20)`, opcional, `cedula`, `pasaporte` u `otro`;
  - en el DTO y el request;
  - validación del dígito verificador cuando es `cedula`, con el mismo algoritmo de `isEcuadorianId`, para que el mensaje coincida.
- **`phone`:** opcional, si la clínica lo decide.
- **Pruebas** en `PatientsTests` y la documentación en `endpoints-api.md` § 7.

## Verificación

- **Alta:** el N.° de historia lo pone el servidor (`HC-000001`, `HC-000002`…).
- **Cédula repetida:** error en el campo `documentId`.
- **Buscar:** "maria" encuentra "María"; también por `HC-000002`.
- **Filtros y contadores:** cambian con los datos reales.
- **Baja:** desaparece de la lista; la ficha por URL muestra "dado de baja"; el admin reactiva.
- **Roles:** el médico no ve "Dar de baja".
- **E2E:** `patients-*.spec.ts`, `patient-*.spec.ts` y `form-validation.spec.ts`.

## Terminado

- Pacientes 100 % en la API.
- La baja usa `deletedAt`, con reactivación.
- Filtros y `documentType` soportados en el back.
- `mockPatients` solo lo importan archivos `*.mock*`. Los planes 8 y 10 quitan las otras dos importaciones.
