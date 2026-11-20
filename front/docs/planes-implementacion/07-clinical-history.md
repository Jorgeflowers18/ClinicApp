# Plan 7 — `clinical-history`: historia, atenciones, adjuntos y archivo clínico

## Objetivo

La historia clínica del paciente, el registro de atenciones, las notas aclaratorias, los adjuntos y la lista global `/historial-clinico` contra la API (`endpoints-api.md` § 10). El **archivo clínico digital**, que es nuevo en el frontend, todavía no tiene backend. Este plan define qué falta y cómo se comporta mientras tanto.

**Módulo del conmutador:** `clinical-history`. **Necesita:** los planes 3 (pacientes), 4 (profesionales y citas) y 5 (tratamientos realizados).

## Mocks que se deshabilitan

| Mock | Qué simula | Se reemplaza por |
|---|---|---|
| `clinical-history.mock-storage.ts`: IndexedDB `clinicapp-dental-v1` con `records`, `files` y `archive-catalog`, y las semillas (`SEED_FLAG`) | Almacenamiento de historias, archivos y catálogo en el navegador | La base y el disco del servidor. En modo API **no se abre IndexedDB**. |
| `clinical-history.mock-migration.ts` (`normalizeStoredHistory`, `withDefaults`, conversión de diagnósticos y tipos de archivo) | Conversión de historias guardadas con versiones anteriores del frontend | No aplica: el back guarda el formato actual y valida cada sección. Se borra en el plan 11. |
| `clinical-history.mock-data.ts` y `mockLegacyClinicalNotes` (en pacientes) | Historias de ejemplo | Solo modo mock |
| `listEncountersMock` | Lista global de atenciones | `GET /clinical-history/encounters?page&pageSize&search&patientId&professionalId` |
| `getRecordMock` | Historia + atenciones | `GET /clinical-history/patients/:patientId` → `{ record, encounters, references }`. Sin historia: una vacía con `revision: 0`. |
| `saveRecordMock`: concurrencia por `revision` | Guardado | `PUT /clinical-history/patients/:patientId`: `409` con revisión vieja; guarda la versión anterior en `clinical_record_versions` |
| `createEncounterMock`: idempotente por `id` | Atención | `POST …/patients/:patientId/encounters`: `201`, o `200` si el `id` ya existía; `409` si la cita ya tiene atención |
| `addEncounterNoteMock` | Nota aclaratoria | `POST /clinical-history/encounters/:encounterId/notes`. El autor sale de la sesión. |
| `uploadAttachmentMock` y `getAttachmentFileMock` | Archivos en IndexedDB | `POST /clinical-history/attachments` (multipart: `file`, `kind`, `patientId`) y `GET /attachments/:id/file` (`410` si el protocolo de conservación lo borró) |
| `archiveApi` (`archive/api.ts`): `attach`, `edit`, `archive`, `category`, el catálogo, el resumen SHA-256 para duplicados y la auditoría | Archivo clínico | **No existe en el back.** En modo API hoy lanza `501` "La API actual aún no ofrece metadatos…". Ver "Cambios necesarios en el back". |
| Miniaturas (`readThumbnail` y `cacheThumbnail`) | Caché en IndexedDB | Se generan en el navegador desde el original (`createClinicalThumbnail`), sin caché persistente, o con una caché en memoria de React Query |

## Diferencias de contrato

| Punto | Frontend | API | Resuelve |
|---|---|---|---|
| `references` | `PatientClinicalHistory` no lo tiene; los nombres se buscan en los catálogos cargados | `{ treatments: {id → name, category, active}, professionals: {id → name, specialty, registrationNumber, active} }` | Front: sumarlo al tipo y usarlo **al mostrar e imprimir**. Así salen bien los tratamientos y profesionales inactivos, y los que están fuera de los primeros 100 del catálogo. |
| `plan[i].description` | Se envía | Se descarta si hay `treatmentId` | Front: dejar de enviarlo para los ítems del catálogo |
| Profesional por defecto | `use-default-professional.ts` busca por nombre (`TODO`) | `AuthUser.professionalId` (plan 1) | Front: usar `professionalId` y, si es `null`, el comportamiento actual |
| `DentalAttachment.archive` (metadatos del archivo clínico) | Opcional en cada adjunto | No existe: el `PUT` usa solo el `id` de cada adjunto | **Back** (abajo). Mientras tanto, el frontend no lo envía ni lo espera. |
| Errores con ruta | `medicalBackground.conditions.otro.detail`, `allergiesAndMedication.allergies[0].reaction`, `plan[0].treatmentId` | Iguales | `applyServerFieldErrors` ya los convierte. Verificar en `record-workspace.tsx` (punto en la pestaña y salto al primer error) y en `register-encounter-form.tsx` (llevar al paso). |
| Subida | Valida tipo y tamaño | JPG, PNG, WebP o PDF de hasta 20 MB, reconocidos por los primeros bytes; `400` con `errors.file` | Coinciden. Mostrar el `title` del back, que incluye el nombre del archivo. |
| Adjuntos sin guardar | En el mock quedan | El back borra a las 24 h los subidos que nunca se guardaron en una historia | Front: el aviso "Tienes cambios sin guardar" ya cubre el caso |
| Archivo borrado por conservación | — | `410` | Front: mostrar "El archivo ya no está disponible" en el visor, no un error genérico |

## Cambios en el frontend

1. **Estándar del plan 0:**
   - `clinical-history.contract.ts`, `.http.ts` y `.mock.ts` (el actual `*Mock` más `mock-storage` y `mock-migration`), y `clinical-history.api.ts`;
   - `getAttachmentFile` usa `apiBlob` y `uploadAttachment` usa `apiForm`.
2. **Secuencia de registro** (`registerEncounterSequence`): se mantiene en el frontend, porque el back tiene los endpoints de cada paso:
   1. `POST /treatment-assignments` por cada tratamiento realizado, idempotente por `sourceKey`;
   2. `POST …/encounters`, idempotente por `id`;
   3. `PUT` de la historia, para quitar los propuestos usados y agregar los exámenes;
   4. `PATCH` de la cita a `completada`.

   Los pasos 3 y 4 ya son no fatales, con aviso. Reintentar es seguro, porque los pasos 1 y 2 son idempotentes. **Recomendado** (back, abajo): mover la secuencia a una sola transacción.
3. **`references`:** pasarlo por contexto desde `useClinicalHistory` a la impresión (`dental-export.ts`), al plan de tratamiento, a la declaración de veracidad y a la tarjeta de atención.
4. **`use-default-professional.ts`:** `user.professionalId ?? matchProfessionalByName(…)`.
5. **Visor de adjuntos:** manejar el `410`.
6. **Archivo clínico, mientras el back no lo tenga:**
   - en modo API, `archiveApi.catalog()` devuelve el catálogo vacío, como hoy;
   - la UI muestra los archivos con sus datos básicos (`name`, `kind`, `mime`, `size`, `createdAt`);
   - las acciones que necesitan el back se **ocultan** en vez de fallar con `501`: editar metadatos, archivar o restaurar, categorías y etiquetas, y la detección de duplicados.

   Agregar `archiveCapabilities` en `archive/api.ts` (`{ metadata: false, catalog: false, archive: false }` en modo API) y que `clinical-file-manager.tsx` lo consulte.
7. **"Historia completa JSON"** (`export-card.tsx`): en modo API deja de ser "respaldo", porque la base es la fuente. Cambiar el texto.

## Cambios necesarios en el back

1. **Archivo clínico** (nuevo; hacer un plan propio en `back/docs/plan-archivo-clinico.md` antes de implementar):
   - **Metadatos por adjunto:**
     - `display_name`, `clinical_type` y `study_date`;
     - `category_id` y etiquetas (tabla puente);
     - `professional_id`, `encounter_id`, `treatment_id` y `exam_request_id`;
     - `zone` y `notes`;
     - `digest`, un SHA-256 calculado por el servidor;
     - `version`, para la concurrencia, y `archived_at`.
   - **Auditoría:** una tabla con acción (`adjuntar`, `editar`, `archivar`, `restaurar`), usuario, fecha y campos cambiados.
   - **Catálogo por institución:** categorías (nombre ≤ 60, descripción ≤ 300, color de una lista y archivado) y etiquetas, con `revision`.
   - **Endpoints sugeridos:**
     - `GET /clinical-history/archive/catalog`;
     - `POST` y `PUT /archive/categories` y `/archive/tags`;
     - `PATCH /clinical-history/attachments/:id` (metadatos, con `version` → `409`);
     - `POST /attachments/:id/archive` y `/restore`;
     - la subida acepta los metadatos y responde `409` si el `digest` ya existe para el paciente.
   - **Reglas que el frontend ya aplica y el back debe repetir:** las de `archive/lib/validation.ts` y `archive/api.ts` (`validateDraft`). Por ejemplo: "el vínculo del resultado no se reasigna" y "la atención debe ser del paciente".
2. **Registro transaccional de la atención** (pendiente ya anotado en `back/backlog-desgloce.md`): un `POST …/encounters` que haga los 4 pasos en una transacción. Cuando exista, `registerEncounterSequence` se reduce a una llamada.

## Verificación

- **Historia nueva:** abrir un paciente sin historia (`revision 0`), llenar antecedentes y odontograma, y guardar. Recargar: sigue igual.
- **Concurrencia:** dos pestañas editan; la segunda en guardar ve "Otra pestaña o usuario modificó esta historia".
- **Errores por campo:** una alergia sin reacción marca la fila, con el punto en la pestaña.
- **Atención:**
  - registrar una con un tratamiento realizado y una cita: la cita pasa a completada, el stock baja y Finanzas muestra el saldo;
  - reintentar (simular un corte de red tras el paso 1) no duplica.
- **Adjuntos:** subir un PDF y un JPG, guardar y abrirlos. Un `.exe` renombrado a `.jpg` → `400`.
- **Impresión** con un tratamiento desactivado: sale con su nombre (`references`).
- **Recepción:** no entra a `/historial-clinico` (ya lo impide `routes.tsx`).
- **E2E:** `dental-history.spec.ts`, `clinical-*.spec.ts`, `periodontal-matrix.spec.ts` y `diagnoses-modal.spec.ts`. Las de `clinical-archive-*` siguen solo en modo mock hasta que exista el back del archivo.

## Terminado

- Historia, atenciones, notas y adjuntos en la API.
- Sin IndexedDB en modo API.
- La impresión usa `references`.
- El archivo clínico degrada sin errores.
- `back/docs/plan-archivo-clinico.md` creado para la parte que falta.
