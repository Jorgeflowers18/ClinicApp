# Plan — Historial clínico

- **Sección:** Historial clínico (`/historial-clinico` y `/historial-clinico/paciente/:patientId`)
- **Módulo:** `front/src/modules/clinical-history`
- **Estado:** Implementado (fases 1, 2, 6 y 7)
- **Responsable:** Jorge Flores

## Objetivo

Al entrar a la historia de un paciente se puede modificar directamente el odontograma y el resto de la información de la historia. Lo histórico (atenciones, citas, tratamientos) se acumula como hoy. Desaparece el ciclo de visitas borrador → cerrada.

## 1. Modelo de datos

**Historia clínica** (`ClinicalRecord`, una por paciente, editable):
- `patientId`, `revision` (control de concurrencia), `createdAt`, `updatedAt`
- `chart`: odontograma y periodontograma actuales
- `plan`: tratamientos propuestos (ver [tratamientos.md](./tratamientos.md))
- `dataConsent`: consentimiento de almacenamiento y tratamiento de datos (ver punto 5)
- `attachments`: fotos y documentos
- A futuro: los campos de `backlog_HC.md` marcados **Pertenece a: Historial Clínico**

**Atención** (`ClinicalEncounter`, inmutable): ver [consultas.md](./consultas.md).

La respuesta de la historia de un paciente pasa a ser `{ record, encounters }`.

**Se eliminan:** `DentalVisit`, `visitStatuses` (borrador / cerrada), `closedAt`, `startVisitSchema`, `StartVisitInput`, `CloseVisitResult` y la validación "para cerrar".

## 2. API (pares Mock / Real)

| Función | Real | Reemplaza a |
|---|---|---|
| `getRecord(patientId)` → `{ record, encounters }` | `GET /clinical-history/patients/:patientId` | igual (cambia la forma) |
| `saveRecord(record)` (409 si la revisión no coincide) | `PUT /clinical-history/patients/:patientId` | `saveDraft` |
| `listEncounters(query)` paginado, búsqueda y filtros paciente / profesional | `GET /clinical-history/encounters` | `listVisits` |
| `createEncounter(...)` | `POST /clinical-history/patients/:patientId/encounters` | `startVisit` + `closeVisit` (ver consultas.md) |
| `uploadAttachment`, `getAttachmentFile` | sin cambios | — |

**Se eliminan:** `startVisit`, `saveDraft`, `closeVisit`, `discardDraft` y sus endpoints.

El código solo-mock sigue la convención de `arquitectura-frontend.md` (`.mock-` en el nombre y `// MOCK-ONLY`).

## 3. Guardado con confirmación (reemplaza al autoguardado)

- El formulario de la historia (React Hook Form) detecta cambios en odontograma, tratamientos propuestos, consentimiento de datos y archivos.
- Si hay cambios aparece una **barra fija**: "Tienes cambios sin guardar" con **"Descartar cambios"** y **"Guardar cambios"**.
- "Guardar cambios" abre un **diálogo de confirmación** que lista las secciones modificadas (por ejemplo: "Odontograma, Plan de tratamiento") y guarda al confirmar.
- Sin cambios, la barra no aparece y no se puede guardar.
- **Conflicto** (otra pestaña o usuario guardó antes): aviso con "Recargar historia", como hoy.
- **Salir con cambios sin guardar:** aviso del navegador (`beforeunload`) y confirmación en los botones propios de la página ("Volver al paciente", "Registrar atención"). La app usa `BrowserRouter`, que no soporta `useBlocker`; bloquear toda navegación interna requeriría migrar a un router de datos (fuera de este alcance).
- Se elimina `hooks/use-visit-autosave.ts`.

## 4. Página del paciente

Archivo: `pages/patient-clinical-history-page.tsx` (se reescribe).

**Encabezado:** "Volver al paciente", título, paciente y cédula, botón **"Registrar atención"**. Desaparecen el selector "Visita", "Nueva visita" y "Continuar borrador".

**Indicadores:** Atenciones registradas · Tratamientos realizados · Próximo control (de la última atención) · Sangrado al sondaje.

**Pestañas:**

| Pestaña | Contenido | Editable |
|---|---|---|
| Odontograma y periodontograma | Estado actual | Sí |
| Plan de tratamiento | Tratamientos propuestos (ver tratamientos.md) | Sí |
| Consentimiento de datos | Reemplaza a "Consentimientos" (ver punto 5) | Sí |
| Fotos y documentos | Igual que hoy | Sí |
| Atenciones | Historial de atenciones con sus notas aclaratorias (ver consultas.md) | No |
| Citas | Citas del paciente (ver citas.md) | No |
| Tratamientos | Tratamientos realizados al paciente con su costo (ver tratamientos.md) | No |
| Evolución periodontal | Indicadores actuales y gráfico entre atenciones (hoy "Seguimiento por visita") | No |

El editor del odontograma sigue fuera del `TabsContent` (oculto con `invisible`) para que la imagen del PDF no salga en blanco.

**Parámetros de la URL:** `?cita=` abre "Registrar atención" con la cita (ver citas.md); `?atencion=` abre la pestaña Atenciones en esa atención; `?visita=` se trata como `?atencion=` (los ids se conservan en la conversión).

**Archivos:**
- Se reescriben: `visit-header.tsx` → `record-header.tsx`; `visit-workspace.tsx` → `record-workspace.tsx`; `follow-up-tab.tsx` → `periodontal-evolution-tab.tsx`; `lib/visit.ts` → `lib/record.ts`.
- Se eliminan: `start-visit-dialog.tsx`, `hooks/use-visit-autosave.ts`, `consents-tab.tsx` (lo reemplaza `data-consent-tab.tsx`).
- `consultation-tab.tsx` se reutiliza dentro del formulario de atención (consultas.md).
- `odontogram-frame.tsx` y `embed/*` no cambian.

## 5. Consentimiento de datos

El único consentimiento que se recopila por ahora es el de **almacenamiento y tratamiento de los datos personales y clínicos** del paciente. Los consentimientos para cirugías o tratamientos **no** se implementan todavía, y se retira la pestaña actual de consentimientos por procedimiento.

Un consentimiento por paciente, en la pestaña "Consentimiento de datos":
- Texto del consentimiento (fijo; lo provee la clínica).
- Estado: Pendiente / Aceptado / Rechazado.
- Firmante: paciente o representante, con su nombre y cédula.
- Fecha de la decisión.
- Documento firmado (opcional): se adjunta con el mismo mecanismo de "Fotos y documentos".
- Se guarda con "Guardar cambios" de la historia, con su confirmación.
- Mientras esté pendiente, el encabezado de la historia muestra un aviso discreto "Consentimiento de datos pendiente". No bloquea el uso de la historia.

## 6. Lista global `/historial-clinico`

Sigue mostrando lo mismo que hoy: una fila por registro clínico, ahora **atenciones** en lugar de visitas.
- Columnas: fecha, paciente, motivo, diagnóstico, profesional, próximo control.
- Se quitan la columna y el filtro **Estado** (borrador / cerrada).
- Clic en una fila → `/historial-clinico/paciente/:patientId?atencion=:id`.
- Se mantienen la búsqueda, los filtros de paciente y profesional, la paginación y "Abrir historia clínica" con un paciente filtrado.

## 7. Exportación

- **Imprimir / Guardar PDF de la historia:** estado actual (imagen del odontograma, tratamientos propuestos, estado del consentimiento de datos, archivos) más el listado de atenciones.
- **PDF de una atención:** desde su tarjeta en el historial, con la imagen de la copia del odontograma de ese momento (ver consultas.md).
- **Historia completa JSON:** se mantiene con la nueva forma.
- El menú "Exportar" del propio editor no cambia.

## 8. Conversión de los datos existentes (solo-mock)

La app aún no está en producción: todos estos datos son de demostración, así que la conversión es simple. Se normaliza al leer, sin cambiar la versión de IndexedDB (`clinicapp-dental-v1`):
- **Historia:** odontograma y tratamientos propuestos de la visita más reciente (el borrador si existe, si no la última cerrada); archivos de **todas** las visitas. Consentimiento de datos en "Pendiente".
- **Atenciones:** cada visita cerrada pasa a ser una atención con su fecha, profesional, cita, textos, copia de su odontograma y sus tratamientos. Se conservan los ids.
- **Borrador actual:** se convierte en atención solo si ya tiene motivo y diagnóstico.
- Los consentimientos por procedimiento de las visitas se descartan.
- Las 4 visitas semilla pasan a ser atenciones.
- Archivo: `api/clinical-history.mock-migration.ts`.

## 9. Validación

- Abrir una historia muestra el odontograma editable sin pasos previos.
- Modificar algo hace aparecer "Guardar cambios"; el diálogo lista lo modificado; tras confirmar, recargar la página conserva los cambios.
- "Descartar cambios" vuelve al último estado guardado.
- Sin cambios no aparece la barra de guardado.
- Dos pestañas: la segunda que guarda recibe el aviso de conflicto.
- Las visitas antiguas aparecen como atenciones y el estado actual sale de la más reciente.
- La lista global muestra atenciones, sin columna Estado, y el clic abre la atención correcta.
- Recepción sigue recibiendo 403.
- El consentimiento de datos se registra, se guarda con confirmación y su estado pendiente muestra el aviso en el encabezado.

## Puntos por confirmar

- **Texto del consentimiento de datos:** la clínica debe proveer el texto legal. Mientras tanto se usa un texto provisional marcado como tal.
- **Ubicación del consentimiento de datos:** al ser sobre datos personales y no solo clínicos, ¿debería registrarse también (o en su lugar) en la ficha del paciente, al darlo de alta? La recepción no tiene acceso a la historia clínica.
