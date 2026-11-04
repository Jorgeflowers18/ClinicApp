# Backlog de implementación — Simplificación de la historia clínica

Planes de implementación por sección de la webapp. Cada archivo describe qué cambia en esa sección, cómo se implementa y cómo se valida. El backlog general de alto nivel sigue en [`documentacion/backlog.md`](../documentacion/backlog.md) (ítem 13).

## Alcance: solo frontend

Todo este backlog se implementa **solo en el frontend**, para mostrarlo a la clienta. No se toca el backend (`back/`).
- Los datos se guardan en el navegador (IndexedDB) a través de las funciones **Mock** de cada `*.api.ts`.
- Las funciones **Real** son solo el contrato futuro: llamadas HTTP con su `// TODO: conectar a endpoint real`, que no se ejecutan mientras `useMockApi` esté activo. Siguen la convención de pares Mock / Real de `arquitectura-frontend.md`.
- Los endpoints mencionados en los planes (`GET /clinical-history/...`, `POST .../encounters`, etc.) se anotan en `back/backlog.md` como pendientes de backend; no se implementan.

## Motivo

La clienta pidió poder **editar directamente la historia clínica al abrirla**. Con el modelo actual de visitas (abrir visita → llenar → cerrar → solo lectura) eso no es posible y el flujo resulta poco ágil.

## Cambio de modelo

| Hoy | Después |
|---|---|
| Visitas con estado borrador / cerrada | **Historia clínica** del paciente, siempre editable, más un **historial de atenciones** que se acumula |
| Autoguardado silencioso del borrador | Guardado explícito: al haber cambios aparece **"Guardar cambios"** con un diálogo de **confirmación** |
| "Nueva visita" → diálogo → "Cerrar visita" | **"Registrar atención"**: formulario único con confirmación; la atención **no se puede editar** después |
| Tratamientos asignados al cerrar la visita | El doctor elige en la atención **qué tratamientos realizó** |

Se alinea con [`documentacion/backlog_HC.md`](../documentacion/backlog_HC.md): lo marcado **Pertenece a: Historial Clínico** irá en la historia editable y lo marcado **Pertenece a: Consulta** en el formulario de atención. Esos campos nuevos **no** forman parte de este backlog; se implementarán después.

## Decisiones confirmadas

1. La historia clínica se edita al abrirla. Antes de guardar, si hubo cambios, se pide confirmación.
2. Las atenciones **no son editables** una vez guardadas (evita manipular el historial); antes de guardarlas se pide confirmación. Para corregirlas se agregan **notas aclaratorias**, también inmutables.
3. Cada atención guarda automáticamente una **copia del odontograma** de ese momento.
4. La fecha de una atención puede ser hoy o anterior, nunca futura.
5. **Tratamientos sencillos:** en la atención se registran los tratamientos realizados, cada uno con su costo del catálogo; se pueden registrar más aunque haya saldos pendientes (los pagos se revisarán a futuro). Sin sesiones ni estados. `/tratamientos` sigue siendo el catálogo.
6. **Consentimiento:** solo el de almacenamiento y tratamiento de datos personales y clínicos. Los consentimientos para cirugías o tratamientos no se implementan todavía.
7. La lista `/historial-clinico` sigue mostrando lo mismo que hoy (una fila por registro clínico), ahora con atenciones en lugar de visitas.
8. Los datos actuales son de demostración: la visita más reciente aporta el estado actual de la historia y cada visita cerrada pasa a ser una atención.

## Archivos

| Archivo | Sección de la webapp | Contenido |
|---|---|---|---|
| [historial-clinico.md](./historial-clinico.md) | Historial clínico | Modelo, API, guardado con confirmación, página del paciente, consentimiento de datos, lista global, exportación, conversión de datos |
| [consultas.md](./consultas.md) | Historial clínico → atenciones | "Registrar atención", confirmación, historial de atenciones, notas aclaratorias, copia del odontograma |
| [tratamientos.md](./tratamientos.md) | Tratamientos | Registro de tratamientos realizados con su costo, tratamientos propuestos y detalle del catálogo |
| [citas.md](./citas.md) | Agenda / citas | Acceso desde la cita, cita completada, citas del paciente en el historial |
| [pacientes.md](./pacientes.md) | Pacientes | Resumen clínico en la ficha del paciente |

## Orden de implementación

| Fase | Plan | Contenido | Estado |
|---|---|---|---|
| 1 | historial-clinico.md | Tipos, API mock/real, almacenamiento y conversión de visitas | Hecha |
| 2 | historial-clinico.md | Página de la historia editable con "Guardar cambios" y confirmación | Hecha (incluye la lista de atenciones de solo lectura) |
| 3 | consultas.md | Registrar atención e historial de atenciones | Hecha (incluye el PDF por atención y la apertura desde `?cita=`) |
| 4 | tratamientos.md | Tratamientos realizados en la atención, tratamientos propuestos y detalle del catálogo | Hecha |
| 5 | citas.md | Acceso desde la cita y citas del paciente | Hecha |
| 6 | pacientes.md, historial-clinico.md | Resumen del paciente, lista global y exportación | Hecha |
| 7 | todos | Pruebas e2e y documentación (`arquitectura-frontend.md`, `back/backlog.md`, `documentacion/backlog.md`) | Hecha: `front/tests/dental-history.spec.ts` reescrita |

Tras cada fase: `npx tsc -p tsconfig.app.json --noEmit`, `npx oxlint`, `npm run build` y revisión en el servidor de desarrollo. Sin commits hasta que se pidan.
