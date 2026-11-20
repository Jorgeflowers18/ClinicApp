# Plan 7 — `clinical-history`: historia, atenciones, adjuntos y archivo clínico

## Objetivo

Conectar con la API (`endpoints-api.md` § 10):
- la historia clínica del paciente;
- el registro de atenciones y las notas aclaratorias;
- los adjuntos y el **archivo clínico digital**;
- la lista global `/historial-clinico`.

El back ya tiene todo lo necesario:
- el archivo clínico (`9dd2426`);
- el registro de la atención en una sola transacción (`fad02ef`).

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
| `createEncounterMock` + `registerEncounterSequence` (4 pasos desde el navegador) | Registro de la atención | `POST …/patients/:patientId/encounters/register`: tratamientos realizados con insumos, atención, historia y cita **en una transacción**. Responde `{ encounter, record, appointmentCompleted, warnings }`, con la forma de `RegisterEncounterResult`. |
| `addEncounterNoteMock` | Nota aclaratoria | `POST /clinical-history/encounters/:encounterId/notes`. El autor sale de la sesión. |
| `uploadAttachmentMock` y `getAttachmentFileMock` | Archivos en IndexedDB | `POST /clinical-history/attachments` (multipart: `file`, `kind`, `patientId`) y `GET /attachments/:id/file` (`410` si el protocolo de conservación lo borró) |
| `archiveApi.catalog`, `category` y `tag` (`archive/api.ts` sobre `readArchiveCatalog`/`writeArchiveCatalog`) | Catálogo de categorías y etiquetas | `GET /clinical-history/archive/catalog`; `POST` y `PUT /archive/categories[/:id]`; `POST` y `PUT /archive/tags[/:id]`. Todos devuelven el catálogo completo (`publishCatalog`). |
| `archiveApi.attach`: SHA-256 en el navegador, duplicados, vínculo con el examen y `writeHistory` | Adjuntar con metadatos | `POST /clinical-history/patients/:patientId/archive/files` (multipart: `file` + campos del borrador; `tagIds` repetido). El SHA-256 y los duplicados los resuelve el servidor (`409` en `errors.file`). Devuelve la historia (`201`). |
| `archiveApi.edit` | Editar metadatos | `PATCH /clinical-history/attachments/:id` (JSON: `version` + borrador). Devuelve la historia. |
| `archiveApi.archive(…, archived)` | Archivar o restaurar | `POST /attachments/:id/archive` o `/restore` con `{ version }`. Devuelve la historia. |
| `archiveActor` / `assertSession` (usuario y rol en el navegador) | Autor y permiso | La sesión del servidor: el autor de la auditoría es el usuario del token, y la recepción recibe `403`. `archiveActor` queda solo para el mock. |
| Miniaturas (`readThumbnail` y `cacheThumbnail`) | Caché en IndexedDB | Se generan en el navegador desde el original (`createClinicalThumbnail`), con una caché en memoria de React Query |

## Diferencias de contrato

| Punto | Frontend | API | Resuelve |
|---|---|---|---|
| `references` | `PatientClinicalHistory` no lo tiene; los nombres se buscan en los catálogos cargados | `{ treatments: {id → name, category, active}, professionals: {id → name, specialty, registrationNumber, active} }` | Front: sumarlo al tipo y usarlo **al mostrar e imprimir**. Así salen bien los inactivos y los que están fuera de los primeros 100 del catálogo. |
| `plan[i].description` | Se envía | Se descarta si hay `treatmentId` | Front: dejar de enviarlo para los ítems del catálogo |
| Profesional por defecto | `use-default-professional.ts` busca por nombre (`TODO`) | `AuthUser.professionalId` (plan 1) | Front: usar `professionalId` y, si es `null`, el comportamiento actual |
| `DentalAttachment.archive` | `ClinicalFileMetadata` opcional | ✅ La misma forma; `null` si el archivo nunca se clasificó | Coinciden. Fechas: `updatedAt`, `archivedAt` y `audit[].at` en ISO UTC; `studyDate` en `YYYY-MM-DD`. |
| `archive.treatmentId` | Id de un **tratamiento realizado** (`listAssignmentsByPatient`) | Igual: debe ser un tratamiento realizado del paciente | Coinciden |
| `archive.uploadedBy` / `audit[].actor` | `{ id, name }` del navegador | `{ id, name }` del usuario del token (`id` vacío si el usuario ya no existe) | Coinciden |
| Adjuntos anteriores | `fileVersion(file)` = 0 si no tiene `archive` | Igual: `PATCH` y archivar aceptan `version: 0` y parten del nombre y el tipo con que se subió | Coinciden |
| Catálogo `revision` | Sube con cada cambio | Suma de las versiones (sube con cada cambio, nunca baja) | Coinciden |
| Tag repetido al crear | Devuelve el catálogo sin cambios | Igual (`200`) | Coinciden |
| Errores del archivo | `ApiError` sin campo | `400`/`409` **con campo** (`displayName`, `clinicalType`, `studyDate`, `encounterId`, `examRequestId`, `treatmentId`, `professionalId`, `categoryId`, `tagIds`, `file`, `name`) | Front: `serverFieldIssues` en `upload-dialog.tsx`, `edit-dialog.tsx` y `catalog-dialog.tsx` |
| Registro de la atención | 4 llamadas, pasos 3 y 4 no fatales | Una llamada; si algo falla no queda nada. `warnings` solo si la cita estaba cancelada o no asistió. | Front: ver "Cambios en el frontend", 2 |
| Errores con ruta | `medicalBackground.conditions.otro.detail`, `allergiesAndMedication.allergies[0].reaction`, `plan[0].treatmentId` | Iguales; el registro suma `performedTreatments[i].treatmentId` (inactivo) y `performedTreatments[i].assignmentId` | `applyServerFieldErrors` ya convierte `[0]`. Verificar en `record-workspace.tsx` y `register-encounter-form.tsx` (llevar al paso). |
| Subida | Valida tipo y tamaño | JPG, PNG, WebP o PDF de hasta 20 MB, reconocidos por los primeros bytes; `400` con `errors.file` | Coinciden. Mostrar el `title` del back, que incluye el nombre del archivo. |
| Adjuntos sin guardar | En el mock quedan | `POST /attachments` (sin metadatos): el back borra a las 24 h los que nunca se guardaron en una historia. `…/archive/files` los deja en la historia en el acto. | Front: el aviso "Tienes cambios sin guardar" ya cubre el primer caso |
| Archivo borrado por conservación | — | `410` | Front: mostrar "El archivo ya no está disponible" en el visor |

## Cambios en el frontend

1. **Estándar del plan 0:**
   - `clinical-history.contract.ts`, `.http.ts`, `.mock.ts` (el actual `*Mock` más `mock-storage` y `mock-migration`) y `clinical-history.api.ts`;
   - `getAttachmentFile` usa `apiBlob` y `uploadAttachment` usa `apiForm`.
2. **Registro de la atención:**
   - en modo API, `useRegisterEncounter` llama a `clinicalHistoryApi.registerEncounter(patientId, input.encounter)` (`POST …/encounters/register`);
   - la respuesta ya es `RegisterEncounterResult`: `updateCachedRecord(result.record)` si no es `null`, y las mismas invalidaciones de hoy (tratamientos, inventario, finanzas y agenda si `appointmentCompleted`);
   - `registerEncounterSequence` y `treatmentsApi.createAssignment` quedan solo en el mock;
   - reintentar con el mismo `encounter.id` es seguro (`200` con lo ya registrado).
3. **Archivo clínico** (`archive/api.ts`):
   - separar en `archive.contract.ts`, `archive.http.ts` y `archive.mock.ts` (la lógica actual con IndexedDB);
   - en `archive.http.ts`, cada operación es una llamada que devuelve la historia o el catálogo, sin `validateDraft`, `linkExam`, SHA-256 ni `writeHistory`, que hace el servidor;
   - quitar `writable()` y su `501`;
   - `attach` arma un `FormData` con `file`, los campos del borrador (vacíos se omiten) y un `tagIds` por etiqueta;
   - `inspectClinicalFile` sigue en el navegador solo para mostrar la vista previa y rechazar formatos antes de subir;
   - las pruebas E2E `clinical-archive-*` pasan a correr también con la API (plan 11).
4. **`references`:** pasarlo por contexto desde `useClinicalHistory` a la impresión (`dental-export.ts`), al plan de tratamiento, a la declaración de veracidad y a la tarjeta de atención.
5. **`use-default-professional.ts`:** `user.professionalId ?? matchProfessionalByName(…)`.
6. **Visor de adjuntos:** manejar el `410`.
7. **"Historia completa JSON"** (`export-card.tsx`): en modo API deja de ser "respaldo", porque la base es la fuente. Cambiar el texto.

## Cambios necesarios en el back

✅ **Hecho:**
- **Archivo clínico (`9dd2426`, migración `ArchivoClinico`):**
  - metadatos por adjunto, etiquetas, auditoría y catálogo;
  - SHA-256 calculado por el servidor, también en `POST /attachments`;
  - duplicados por paciente, incluidos los adjuntos anteriores sin huella;
  - las reglas de `validateDraft`, y "el vínculo del resultado no se reasigna".
- **Registro transaccional (`fad02ef`):** `POST …/encounters/register`. Guarda el profesional de la atención en cada tratamiento realizado.

**Queda en el back**, sin bloquear este plan: la FK `treatment_assignments.source_encounter_id` → `clinical_encounters`. Se agrega cuando el frontend use `…/encounters/register` y se retire el registro por pasos (`back/backlog.md` § `clinical-history`).

## Verificación

- **Historia nueva:** abrir un paciente sin historia (`revision 0`), llenar antecedentes y odontograma, y guardar. Recargar: sigue igual.
- **Concurrencia:** dos pestañas editan; la segunda en guardar ve "Otra pestaña o usuario modificó esta historia".
- **Errores por campo:** una alergia sin reacción marca la fila, con el punto en la pestaña.
- **Atención:**
  - registrar una con un tratamiento realizado, un propuesto y una cita: la cita pasa a completada, el propuesto sale, el examen queda pendiente, el stock baja y Finanzas muestra el saldo;
  - con el tratamiento desactivado en otra pestaña: error en el paso de tratamientos y **nada** registrado;
  - reintentar tras un corte de red no duplica.
- **Archivo clínico:**
  - crear una categoría y una etiqueta;
  - adjuntar una panorámica vinculada al examen pendiente: pasa a "Recibido";
  - subir el mismo archivo otra vez: aviso de duplicado;
  - editar los metadatos en dos pestañas: la segunda recibe "El archivo cambió en otra pantalla";
  - archivar y restaurar: la auditoría lo muestra con el nombre del usuario.
- **Adjuntos:** subir un PDF y un JPG, guardar y abrirlos. Un `.exe` renombrado a `.jpg` → `400`.
- **Impresión** con un tratamiento desactivado: sale con su nombre (`references`).
- **Recepción:** no entra a `/historial-clinico` (ya lo impide `routes.tsx`), y la API le responde `403`.
- **E2E:** `dental-history.spec.ts`, `clinical-*.spec.ts` (incluidas las `clinical-archive-*`), `periodontal-matrix.spec.ts` y `diagnoses-modal.spec.ts`.

## Terminado

- Historia, atenciones, notas, adjuntos y archivo clínico en la API.
- Sin IndexedDB en modo API.
- El registro de la atención es una sola llamada.
- La impresión usa `references`.
