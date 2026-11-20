# Plan 3 — `patients`

## Objetivo

Lista, ficha, alta y edición de pacientes contra la API (`endpoints-api.md` § 7), con la baja lógica y la reactivación.

**Módulo del conmutador:** `patients`. **Necesita:** el plan 1. Es la base de casi todo lo demás: citas, historia, tratamientos realizados y finanzas apuntan a pacientes reales.

## Mocks que se deshabilitan

| Mock (`patients.api.ts`) | Qué simula | Se reemplaza por |
|---|---|---|
| `listMock`: filtra sin tildes por nombre, cédula, teléfono y correo; filtros `status`, `gender`, `registeredFrom` y `registeredTo`; orden por `createdAt` | Búsqueda y filtros | `GET /patients?page&pageSize&search&status&gender&registeredFrom&registeredTo` |
| `getMock` | Ficha | `GET /patients/:id` (devuelve también los dados de baja, con `deletedAt`) |
| `createMock`: valida con `patientEditorSchema`, cédula repetida → `409`, y **calcula el N.° de historia** (`HC-…`) | Alta | `POST /patients`. El número lo asigna una secuencia de PostgreSQL; la cédula repetida da `409` con `errors.documentId`. |
| `updateMock`: conserva el N.° de historia | Edición | `PUT /patients/:id` (ignora `clinicalRecordNumber`; `409` si está dado de baja) |
| `removeMock`: **pone `treatmentStatus: "inactivo"`** | Baja | `DELETE /patients/:id`: baja lógica con `deletedAt`. El paciente **desaparece** de la lista; su `treatmentStatus` no cambia. |
| (no existe) | — | `POST /patients/:id/restore` (solo admin) |
| `mockPatients` (`patients.mock-data.ts`) | Datos de demostración | Solo el modo mock. Ojo: `notifications.api.ts` y `reports.api.ts` también lo importan (se resuelve en los planes 8 y 10). |

## Diferencias de contrato

| Punto | Frontend | API | Resuelve |
|---|---|---|---|
| `documentType` (`cedula`, `pasaporte`, `otro`) | Existe; con `cedula` valida el dígito verificador (`isEcuadorianId`) | ✅ Igual, con el mismo algoritmo y el mismo mensaje en `errors.documentId`. Sin tipo, la respuesta trae `null`. | Front: mapeo `null` → `undefined` |
| `phone` | **Opcional** (`optionalPhone`) | ✅ Opcional; si viene, con al menos 7 dígitos (igual `emergencyContactPhone`) | Coinciden. Confirmar con la clínica que sea opcional. |
| Filtros `status`, `gender`, `registeredFrom`, `registeredTo` | Los usa la lista y los 4 contadores (total, activos, en seguimiento, inactivos) | ✅ Aceptados; las fechas son días de la clínica, inclusivos; `400` si son inválidas | Coinciden |
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
   - Vista de dados de baja (solo admin): `GET /patients?deleted=true`, con los mismos filtros, del más reciente en darse de baja al más antiguo. Cada fila con "Reactivar".
5. **Contadores de la lista** (`patients-list-page.tsx:32-35`): siguen con `pageSize: 1` y leen `totalItems`, lo que funciona en cuanto el back acepte `status`.
6. **`usePatientLastVisit`:** sin cambios. Ya respeta los roles, porque la historia solo la pide a admin y médico.

## Cambios necesarios en el back

✅ **Hecho** (`a5f633a`, migración `PacientesTipoDocumento`; `endpoints-api.md` § 7):
- `GET /patients` acepta `status`, `gender`, `registeredFrom` y `registeredTo`, y `deleted=true` (solo admin; `403` para los demás).
- `documentType` (`cedula`, `pasaporte`, `otro` o vacío), con validación del dígito verificador cuando es `cedula`.
- `phone` y `emergencyContactPhone` opcionales; si vienen, con al menos 7 dígitos.

Ya no queda nada del back para este plan. Pendiente de la clínica: confirmar que el teléfono sea opcional.

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
- La lista usa los filtros del back, los contadores cuadran y `documentType` se guarda.
- Admin ve y reactiva a los dados de baja.
- `mockPatients` solo lo importan archivos `*.mock*`. Los planes 8 y 10 quitan las otras dos importaciones.
