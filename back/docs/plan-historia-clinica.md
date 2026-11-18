# Plan de implementación — `clinical-history`

- **Responsable:** Jorge Flores
- **Estado:** aprobado (2026-11-17), en espera de su turno. D1, D2 (provisional), D3 y D4, más D6 a D12, aprobadas. D13 depende de la multi-clínica, que está en espera.
- **Cuándo se retoma:** es el orden 5 de [`backlog-desgloce.md`](../backlog-desgloce.md), después de `patients`, profesionales, citas y tratamientos realizados. Al retomarlo se actualizan:
  - **D1:** ya habrá tablas a las que apuntar, así que se agregan las llaves foráneas desde el principio.
  - **D2:** se puede diseñar el registro de la atención en una sola transacción.
  - **D13:** la multi-clínica es una propuesta en espera ([`plan-multiclinica.md`](./plan-multiclinica.md)). Si no se aprobó para entonces, la historia se hace para una clínica:
    - sin `institution_id`;
    - ruta de adjuntos `{patientId}/{attachmentId}.{ext}`;
    - zona horaria en la configuración (`Clinic:TimeZone`), con el `ClinicClock` que crea [`plan-pacientes.md`](./plan-pacientes.md).
- **Detalle de endpoints:** [`backlog.md` § `clinical-history`](../backlog.md#clinical-history)
- **Contrato del frontend:**
  - `front/src/modules/clinical-history/types/`: `clinical-history.types.ts`, `background.types.ts` y `encounter-assessment.types.ts`.
  - `front/src/modules/clinical-history/api/clinical-history.api.ts`: las funciones `*Mock` describen el comportamiento esperado.
  - `clinical-history.queries.ts` (`useRegisterEncounter`): la secuencia de registro de una atención.

## 1. Objetivo y alcance

Los 7 endpoints que el frontend ya llama:
- la lista global de atenciones;
- la historia de un paciente (leer y guardar, con concurrencia optimista);
- crear una atención inmutable;
- agregar una nota aclaratoria;
- subir y descargar adjuntos.

La API valida cada sección con las mismas reglas que los esquemas Zod del frontend, porque el frontend no es una barrera real.

Además:
- **Guardar quién hizo cada cosa:** quién guardó la historia, registró la atención o subió el archivo, y una **copia de cada versión guardada de la historia** (D12).
- **Adjuntos en disco**, separados por clínica y paciente, conservados para siempre y con un protocolo de limpieza apagado (D4).
- **Fecha de hoy según la zona horaria de la clínica** (`ClinicClock`, D5), para las reglas "no puede ser futura".
- **Cada clínica ve solo sus historias** (D13).

**Fuera de alcance (dependen de módulos que aún no existen):**
- **Registrar la atención en una sola transacción** (tratamientos realizados, atención, historia y cita completada). Necesita `treatment-assignments` (que a su vez necesita `patients`) y `appointments`. Ver D2.
- **Buscar atenciones por nombre o cédula del paciente:** necesita la tabla `patients`.
- **Llaves foráneas a pacientes, profesionales, citas y asignaciones:** ver D1.
- **Importar las historias guardadas en modo demostración**, a partir del export JSON de cada navegador.
- **Antivirus de adjuntos, texto legal del consentimiento y firmas:** los define la clínica.

## 2. Decisiones

| # | Decisión | Estado |
|---|---|---|
| D1 | Pacientes, profesionales, citas y asignaciones sin llave foránea por ahora | ✅ Aprobada: se agregan cuando existan `patients` y `professionals` |
| D2 | Registro de la atención | ✅ **Provisional:** se implementa como está hoy (solo crea la atención) mientras se responden A1 a A8 (§ 2.1) |
| D3 | Secciones en columnas `jsonb` | ✅ Aprobada, con la clasificación de § 2.2 (diagnósticos, plan y alertas quedan en `jsonb` por ahora) |
| D4 | Adjuntos en el disco del servidor | ✅ Disco, ruta con la clínica, nombre generado con alias y conservación para siempre, huérfanos borrados a las 24 h y protocolo de limpieza apagado (§ 2.3) |
| D5 | "No futura" según la zona horaria de la clínica | ✅ Aprobada. Ahora la zona es **de cada clínica** (§ 2.4) |
| D6 | Copias del odontograma y de las alertas enviadas por el frontend | ✅ Aprobada |
| D7 | Idempotencia de la atención por `id` | ✅ Aprobada |
| D8 | Largos máximos que el frontend no limita | ✅ Aprobada |
| D9 | Errores de listas como `plan[0].tooth` (cambio pendiente en el frontend) | ✅ Aprobada |
| D10 | Autor de la nota desde la sesión, con el nombre copiado | ✅ Aprobada |
| D11 | Verificar las referencias **y devolverlas resueltas para imprimir** | ✅ Aprobada, con lo que pediste para la impresión (§ 2.5) |
| D12 | Versiones de la historia | ✅ Aprobada. **Cómo funciona en § 2.6** |
| D13 | Varias clínicas | 🔍 Todas las tablas llevan `institution_id`, con el filtro automático de [`plan-multiclinica.md`](./plan-multiclinica.md) (M4). Plan aprobado salvo M2 (una persona en varias clínicas), en análisis. |

Resumen de las aprobadas sin cambios:
- **D6:** se aceptan `chartSnapshot` y `clinicalSnapshot` tal como los envía el frontend.
- **D7:** mismo `id` y mismo paciente devuelve `200` con la atención existente; mismo `id` de otro paciente, o cita ya vinculada, responde `409`.
- **D8:** motivo 500; procedimientos, evolución, observaciones y nota 4000; cuerpo JSON hasta 5 MB.
- **D9:** el frontend debe convertir `[0]` en `.0` en `toFieldErrors`.
- **D10:** nombre del perfil o del usuario, copiado en la nota, más `author_user_id`.

### 2.1 ¿Qué es una atención? (D2, provisional)

**Lo que es hoy en el frontend y en este plan.** Una atención es el registro de **una consulta del paciente con un profesional, en una fecha**: lo que el formulario en papel llama "Consulta" (`documentacion/backlog_HC.md`). Concretamente:

- **Lo que contiene:**
  - Fecha, profesional y motivo.
  - Signos vitales y riesgo, examen extraoral e intraoral, dolor, diagnósticos, pronóstico y diagnóstico periodontal.
  - Exámenes solicitados.
  - Tratamientos realizados, con su costo.
  - Evolución (cada atención es una fila de "16. Evolución clínica" del papel).
  - Copia del odontograma y de las alertas.
- **Lo obligatorio:** fecha (no futura), profesional, motivo y al menos un diagnóstico.
- **La cita:** puede tener una (como máximo; una cita no puede tener dos atenciones) o ninguna (urgencia, paciente sin cita).
- **Si se equivocan:** es inmutable. No se edita ni se borra; los errores se corrigen con notas aclaratorias.
- **Tratamientos realizados:** cada uno se registra "completado", en una sola sesión. Esto descuenta insumos del inventario y aparece en Finanzas como deuda del paciente.

**Lo que falta definir** (con la clínica si hace falta). Las respuestas cambian qué hace el endpoint y si puede ser una sola transacción:

| # | Pregunta | Por qué importa |
|---|---|---|
| A1 | ¿Toda atención es una consulta presencial? ¿Cuentan como atención una llamada, la revisión de un resultado de laboratorio o la respuesta de una interconsulta? | Si no, hacen falta otros tipos de registro (por ejemplo, solo una nota en la historia) o un tipo de atención con menos campos obligatorios. |
| A2 | ¿El diagnóstico debe ser obligatorio siempre? Un control de rutina o un retiro de puntos quizá no lo tiene. | Hoy sin diagnóstico no se puede guardar. |
| A3 | Un tratamiento de varias sesiones (endodoncia en 3 citas, ortodoncia), ¿se registra como realizado en cada sesión, solo en la última o con un avance? | Define cuándo se descuentan insumos y cuándo se cobra. Hoy se registra completo de una vez (se quitó "+ Sesión"). |
| A4 | ¿Una cita puede originar más de una atención (dos profesionales en la misma cita)? | Hoy no: una cita, una atención. |
| A5 | ¿Se permite corregir una atención por un tiempo (por ejemplo, el mismo día) o solo con notas aclaratorias? ¿Lo exige la normativa? | Hoy es inmutable desde que se guarda. |
| A6 | ¿El profesional de la atención debe ser el usuario que la registra, o la asistente puede registrarla a nombre del doctor? | Define si `professionalId` se elige o se toma de la sesión, y quién "firma". |
| A7 | ¿Hace falta guardar una atención a medias (borrador) y terminarla después? | El ítem 13 quitó los borradores; con backend, lo escrito se pierde si se cierra la página. |
| A8 | Al registrar la atención, ¿siempre se completa la cita, se descuentan insumos y se genera la deuda, o hay casos en que no (por ejemplo, un tratamiento cortesía)? | Son los pasos de la transacción. Hoy el costo puede ser 0, pero el insumo se descuenta igual. |

**Mientras tanto (aprobado):** se implementa `POST …/encounters` tal como está hoy (solo crea la atención, D2 original). Así el frontend actual funciona, y el endpoint transaccional se diseña cuando estas preguntas tengan respuesta y existan `treatment-assignments` y `appointments`. Ninguna respuesta obliga a rehacer las tablas: a lo sumo se agregan columnas (tipo de atención, borrador) o se relajan validaciones.

### 2.2 Columnas `jsonb` (D3)

**Qué es.** `jsonb` es un tipo de columna de PostgreSQL que guarda un objeto JSON completo, por ejemplo todo `habits`: `{ "tobacco": { "answer": "si", "detail": "5 al día" }, "alcohol": … }`. En lugar de una columna por casilla del formulario, se usa **una columna por sección**.

**Criterio para clasificar cada campo:**

| Va en… | Cuándo | Ejemplos |
|---|---|---|
| **Columna normal** | Se busca, se filtra, se ordena o se muestra en una lista; apunta a otra tabla; o es un texto largo único | fecha, profesional, cita, motivo, próximo control |
| **Columna `jsonb`** | Es un grupo de casillas, opciones o filas que siempre se leen y guardan juntas, y nadie las consulta por separado | antecedentes médicos, hábitos, signos vitales |
| **Tabla propia** | Tiene un archivo, su propio ciclo de vida o se usa fuera de la historia | adjuntos |
| **Otro módulo** | El dato es del paciente, no de la historia | identificación del paciente → `patients` |

**Clasificación, sección por sección del formulario en papel** (`documentacion/backlog_HC.md`):

| # | Sección del papel | Dónde se guarda | Tipo |
|---|---|---|---|
| 1 | Identificación del paciente | Tabla `patients` (módulo `patients`). La historia solo guarda `patient_id`. | Otro módulo |
| 2 | Motivo y enfermedad actual | Atención: `reason`, `present_illness` | Columnas |
| 3 | Antecedentes médicos | Historia: `medical_background` | `jsonb` |
| 4 | Alergias, medicación y alertas | Historia: `allergies_and_medication`. Copia en la atención: `clinical_snapshot` (D6). | `jsonb` |
| 5 | Hábitos y factores de riesgo | Historia: `habits` | `jsonb` |
| 6 | Antecedentes odontológicos | Historia: `dental_background` | `jsonb` |
| 7 | Signos vitales y evaluación de riesgo | Atención: `vitals` y `risk_assessment` (`jsonb`); `asa` (columna, es un solo valor) | Mixto |
| 8 | Examen extraoral | Atención: `extraoral_exam` | `jsonb` |
| 9 | Examen intraoral | Atención: `intraoral_exam` | `jsonb` |
| 10 | Dolor y riesgo | Atención: `pain`, `caries_risk`, `periodontal_risk` | `jsonb` |
| 11 | Exámenes complementarios | Solicitados en la atención: `requested_exams` (`jsonb`). Su seguimiento (pendiente / recibido): historia, `exam_requests` (`jsonb`). Los documentos: tabla `clinical_attachments`. Hallazgos: atención, `exam_findings` (columna). | Mixto |
| 12 | Odontograma | Historia: `chart` (el actual). Copia en la atención: `chart_snapshot` (D6). | `jsonb` |
| 13 | Diagnósticos | Atención: `diagnoses` (`jsonb`), más `diagnosis_summary` (columna, para buscar) | Mixto |
| 14 | Pronóstico | Atención: `prognosis` | `jsonb` |
| 15 | Plan de tratamiento por fases | Historia: `plan` | `jsonb` |
| 16 | Evolución clínica | Atención: `date`, `professional_id`, `procedures`, `materials`, `evolution`, `notes`. La firma está pendiente. | Columnas |
| 17 | Declaración de veracidad | Historia: `truth_declaration` | `jsonb` |
| — | Consentimiento de datos (no está en el papel) | Historia: `data_consent` | `jsonb` |
| 18 | Antecedentes periodontales | Historia: `periodontal_background` | `jsonb` |
| 19 | Índices periodontales | No se guardan aparte: se calculan del periodontograma, que está dentro de `chart` | — |
| 20 | Diagnóstico periodontal | Atención: `periodontal_diagnosis` | `jsonb` |
| 21 | Pronóstico periodontal y plan | Intervalo: atención, `maintenance_interval` (`jsonb`). Reevaluación: `next_visit` (columna). Pronóstico y plan ya están en 14 y 15. | Mixto |
| 7 (p.) | Periodontograma | Dentro de `chart`, junto al odontograma | `jsonb` |
| — | Tratamientos realizados | Atención: `performed_treatments` (`jsonb`). El cobro sale de `treatment_assignments` cuando exista. | `jsonb` |

**Tres puntos para revisar,** porque podrían necesitar columna o tabla propia más adelante:

| Campo | Hoy | Pasaría a tabla propia si… |
|---|---|---|
| Diagnósticos (13) | `jsonb` + texto para buscar | La clínica quiere reportes por diagnóstico o por código CIE-10 ("cuántas periodontitis este año") |
| Plan de tratamiento (15) | `jsonb` | Se quiere una lista de "tratamientos propuestos sin realizar" de **todos** los pacientes, para hacer seguimiento comercial |
| Alertas (4) | `jsonb` | Se quiere filtrar pacientes por alerta ("todos los anticoagulados"). Esto también se resuelve con un índice GIN, sin tabla nueva. |

**Recomendación:** dejarlos en `jsonb` por ahora. Ninguna pantalla los consulta así hoy, y pasarlos después a una tabla es una migración que copia los datos, sin perder nada.

**Resumen por tabla:**

| Tabla | Columnas `jsonb` (una por sección) | Columnas normales |
|---|---|---|
| `clinical_records` | `chart`, `medical_background`, `allergies_and_medication`, `habits`, `dental_background`, `periodontal_background`, `plan`, `data_consent`, `truth_declaration`, `exam_requests` (10) | `patient_id`, `institution_id`, `revision`, `created_at`, `updated_at`, `updated_by_user_id` |
| `clinical_encounters` | `vitals`, `risk_assessment`, `extraoral_exam`, `intraoral_exam`, `pain`, `caries_risk`, `periodontal_risk`, `diagnoses`, `prognosis`, `periodontal_diagnosis`, `maintenance_interval`, `requested_exams`, `performed_treatments`, `chart_snapshot`, `clinical_snapshot` (15) | `id`, `institution_id`, `patient_id`, `date`, `professional_id`, `appointment_id`, `reason`, `present_illness`, `asa`, `procedures`, `materials`, `exam_findings`, `evolution`, `notes`, `next_visit`, `diagnosis_summary`, `legacy_professional_name`, `created_by_user_id`, `created_at` |
| `clinical_record_versions` | `data` (la historia completa) | `institution_id`, `patient_id`, `revision`, `saved_by_user_id`, `saved_at` |
| `encounter_notes`, `clinical_attachments` | ninguna | todas |

**Qué implica.**

| | |
|---|---|
| ✅ Menos tablas | Más de 100 campos del formulario caben en 25 columnas. Sin `jsonb` serían unas 15 tablas más solo para antecedentes, alergias, hábitos, exámenes y diagnósticos, con sus joins. |
| ✅ Misma forma que el frontend | La API devuelve cada sección tal como la espera `clinical-history.types.ts`, sin armarla a partir de varias tablas. |
| ✅ Cambios fáciles | Agregar una casilla nueva (por ejemplo, un antecedente más) no necesita migración: solo cambiar la clase de C# y su validación. |
| ⚠️ La base no valida lo de adentro | PostgreSQL no impide guardar `"answer": "quizás"` dentro del JSON. Lo valida **la API**, con las mismas reglas de Zod (§ 5 y § 6). Como solo la API escribe en la base, es suficiente. |
| ⚠️ Sin llaves foráneas adentro | Un `treatmentId` dentro de `plan` no puede tener FK. Lo verifica la API (D11). |
| ⚠️ Consultar adentro es menos directo | Por ejemplo, para "pacientes con alergia al látex" se usa un operador de PostgreSQL: `allergies_and_medication @> '{"alerts":["latex"]}'`. Si un reporte lo necesita seguido, se agrega un índice GIN sobre esa columna. Hoy ninguna pantalla lo pide. |
| ⚠️ Renombrar un campo | Si algún día se renombra una clave (por ejemplo, `tobacco` → `smoking`), los datos guardados no cambian solos: hace falta una migración con un `UPDATE`. Agregar claves nuevas no tiene este problema. |

**Lo que no va en `jsonb`, a propósito:**
- **Costo de los tratamientos realizados para Finanzas:** sale de la tabla `treatment_assignments` cuando exista. `performed_treatments` es solo el detalle de la atención.
- **Adjuntos:** son filas de `clinical_attachments`, porque tienen un archivo en disco y su propio ciclo de vida.
- **Diagnósticos para la búsqueda:** se copia el texto en `diagnosis_summary` para buscar con `ILIKE`.

### 2.3 Adjuntos: rutas, nombre y permanencia (D4)

**Carpeta raíz**, configurable en `Attachments:RootPath`:
- **Producción:** `/var/lib/clinicapp/attachments`. Va fuera de la carpeta de la aplicación, para que un nuevo despliegue no la borre, y debe estar incluida en el respaldo diario, junto con `pg_dump`.
- **Desarrollo:** `back/src/ClinicApp.Api/App_Data/attachments`, ignorada por git.

**Ruta de cada archivo:** `{institutionId}/{patientId}/{attachmentId}.{ext}`

```text
/var/lib/clinicapp/attachments/
├── 0199a1b0-…-clinica-A/
│   └── 0199a3f2-…-paciente/
│       ├── 0199b7c1-…-adjunto.jpg      ← alias en la base: "rx inicial.jpg"
│       └── 0199b7d4-…-adjunto.pdf      ← alias en la base: "laboratorio marzo.pdf"
└── 0199a1c4-…-clinica-B/
    └── …
```

- **Una carpeta por clínica:** los archivos de cada clínica están separados. Si una clínica deja el servicio y pide sus datos, se entrega su carpeta completa.
- **Una carpeta por paciente dentro de la clínica:** si un paciente pide sus datos, sus archivos están todos juntos.
- **Las carpetas usan los `id`, no los nombres:** el nombre de una clínica o de un paciente puede cambiar, y no se quieren datos personales en el disco.
- **La API arma la ruta siempre** con la clínica de la sesión y el paciente del adjunto, nunca con algo que envíe el usuario. Antes de abrir un archivo comprueba que la ruta quede dentro de `Attachments:RootPath`.

**Nombre: dos nombres por archivo.**

| | Ejemplo | Dónde | Para qué |
|---|---|---|---|
| **Nombre en disco** (lo genera el servidor) | `0199b7c1-….jpg` | En el disco y en `storage_path` | Identifica el archivo sin repetirse nunca. Evita que dos archivos se pisen, los caracteres raros, las rutas (`../../`) y los datos personales en el disco ("rx_juan_perez.jpg"). |
| **Alias** (el nombre con que lo subió el usuario) | `rx inicial.jpg` | En la base, columna `alias` | Se muestra en la historia y se usa como nombre al descargar. Se guarda limpio: sin carpetas, sin caracteres de control y con hasta 255 caracteres. En la API viaja como `name`, el campo que ya usa el frontend. |

- **Extensión (`.jpg`, `.png`, `.webp`, `.pdf`):** la decide el servidor por los primeros bytes del archivo, no el usuario. Sirve para abrir un archivo a mano desde un respaldo.
- **Archivo temporal:** mientras se recibe se llama `{attachmentId}.tmp` y se renombra al terminar. Si la subida se corta, no queda un archivo a medias con nombre válido.

**Permanencia: para siempre.** Lo que se guardó en una historia no se borra nunca, tampoco si después se quita de la historia: las versiones anteriores (D12) lo siguen nombrando.

| Caso | Qué pasa |
|---|---|
| Guardado en la historia | Se conserva para siempre |
| **Quitado** de la historia después de haberse guardado | No se borra. Se marca `removed_at`, deja de aparecer en la historia actual y se puede seguir descargando desde las versiones anteriores. |
| Subido y **nunca guardado** (el usuario lo subió y descartó los cambios) | No es parte de la historia: nadie lo guardó. Se borran la fila y el archivo a las **24 h** (`Attachments:OrphanHours`). (Aprobado.) |

**Protocolo de limpieza (preparado, pero apagado).** Si un día cambia la definición (por ejemplo, una norma permite borrar los adjuntos quitados después de 15 años), se activa sin programar nada nuevo:

| Variable | Valor por defecto | Qué hace |
|---|---|---|
| `Attachments:Retention:RemovedDays` | vacío = **nunca** | Días que se conserva un adjunto **quitado** de la historia, contados desde `removed_at` |
| `Attachments:Retention:DryRun` | `true` | En `true` solo **anota en el log** qué borraría, sin borrar nada |

Pasos para activarlo:
1. **Definir el plazo** con la clínica o la norma y anotarlo en `backlog.md`.
2. **Simular:** poner `RemovedDays` con `DryRun = true` y revisar en el log la lista de lo que se borraría (clínica, paciente, alias y fecha en que se quitó).
3. **Respaldar** la carpeta de adjuntos y la base.
4. **Ejecutar:** poner `DryRun = false`. La tarea de cada hora borra **solo el archivo** de los adjuntos que cumplen el plazo y marca `purged_at`.
5. **Lo que queda:** la fila no se borra. Se conservan el alias, el tipo, quién lo subió y cuándo se eliminó, así la historia y sus versiones muestran "Archivo eliminado por política de conservación el …". Descargarlo responde `410`.

**Lo que este protocolo nunca hace:** borrar un adjunto que está en la historia actual. Si una norma futura exige borrar historias completas (por ejemplo, "X años desde la última atención"), es otra regla que se agrega a esta misma tarea, con su propia variable y su propia simulación.

Por ahora la variable es la misma para todas las clínicas. Si clínicas de países distintos necesitan plazos distintos, pasa a ser una columna de `institutions`.

### 2.4 Zona horaria (D5)

Cambio respecto a la propuesta anterior: como habrá varias clínicas, posiblemente en lugares distintos, la zona horaria **ya no es una configuración del servidor**. Es un dato de cada clínica: la columna `institutions.time_zone` de [`plan-multiclinica.md`](./plan-multiclinica.md) (M6).

- **Valor:** el nombre estándar (IANA) de la zona, por ejemplo `America/Guayaquil`, `America/Bogota` o `Europe/Madrid`. Al crear una clínica sin zona se usa `Clinic:DefaultTimeZone` (`America/Guayaquil`).
- **Cómo cambiarla:** se cambia el dato de la clínica, sin reiniciar la API. Mientras no exista la pantalla del perfil de la institución, se cambia en la base o en la semilla.
- **Zona inválida:** se rechaza al guardarla, así nunca queda una zona que la API no entienda.
- **`ClinicClock`** (lo crea [`plan-pacientes.md`](./plan-pacientes.md)) da "la fecha de hoy en la clínica". Esta historia lo usa para todas las reglas "no puede ser futura".
- **Las fechas ya guardadas no cambian:**
  - Las fechas con hora están en UTC.
  - Las fechas sin hora (`date`) son el día de la clínica tal como se registró.

### 2.5 Referencias e impresión (D11)

**Qué referencias hay en la historia y en las atenciones:**
- tratamiento del catálogo, en el plan y en los realizados;
- profesional, en la atención y en la declaración de veracidad;
- atención, en cada examen solicitado;
- adjunto, en el consentimiento y en el resultado de un examen.

**Hoy en el frontend:**
- Cada propuesto y cada tratamiento realizado guarda una **copia del nombre** (`description`).
- Al imprimir, el nombre se busca en el catálogo cargado (solo los primeros 100 tratamientos) y, si no aparece, se usa la copia.

**Propuesta para no duplicar datos:**
1. **Se guarda solo la referencia** (`treatmentId`, `professionalId`, `encounterId`, `attachmentId`).
   - `description` se conserva únicamente en los propuestos de texto libre antiguos (`treatmentId: null`), porque no tienen a qué apuntar.
   - En los demás, la API la ignora al guardar.
2. **La API devuelve las referencias resueltas** en `GET /clinical-history/patients/:patientId`, en un bloque nuevo `references`. Contiene solo lo que la historia usa, calculado al leer y sin guardarse:
   ```json
   "references": {
     "treatments": { "<id>": { "name": "Endodoncia unirradicular", "category": "Endodoncia", "active": false } },
     "professionals": { }
   }
   ```
   - Así la impresión muestra todos los nombres aunque el catálogo tenga más de 100 tratamientos o alguno esté inactivo.
   - `professionals` se llena cuando exista el catálogo de profesionales (D1).
   - Los adjuntos y las atenciones ya vienen en la misma respuesta.
3. **No se puede borrar lo que la historia nombra:** `DELETE /treatments/:id` responde `409` si el tratamiento aparece en un plan o en una atención ("desactívalo en su lugar"). Si se pudiera borrar, la impresión ya no tendría el nombre.
4. **Pendiente del frontend:** usar `references` al mostrar e imprimir (`treatmentName` en `record-workspace.tsx`) y dejar de enviar `description` en los ítems del catálogo. Mientras no cambie, sigue funcionando como hoy.

**Lo que hay que saber:** si se **renombra** un tratamiento del catálogo, las atenciones antiguas se imprimen con el nombre nuevo. Para corregir una falta de ortografía es lo deseable; para un tratamiento distinto conviene crear uno nuevo y desactivar el anterior.

### 2.6 Versiones de la historia (D12)

**La idea en una frase:** antes de guardar cambios en la historia, la API saca una "fotocopia" de cómo estaba y la archiva. Las fotocopias nunca se modifican ni se borran.

**Paso a paso, con un ejemplo:**

1. **Lunes.** La doctora abre la historia de Ana y registra "alergia a la penicilina". Guarda.
   - Ana no tenía historia, así que no hay nada que fotocopiar.
   - Se crea la historia con `revision = 1`.
2. **Miércoles.** La doctora quita la alergia (se equivocó: era amoxicilina) y agrega la correcta. Guarda.
   - La API lee la historia actual (`revision = 1`, con "penicilina").
   - Copia la historia **completa** en `clinical_record_versions`, junto con quién la había guardado (la doctora) y cuándo (el lunes).
   - Guarda la historia nueva con `revision = 2`, con "amoxicilina".
   - Estos pasos ocurren en una sola transacción: o se hacen todos o ninguno. Nunca queda una historia nueva sin su fotocopia.
3. **Un año después**, alguien pregunta qué decía la historia de Ana el martes. La respuesta es la versión `revision = 1` (vigente desde el lunes hasta el miércoles), con "penicilina".

**Qué se guarda en cada versión:**

| Columna | Ejemplo |
|---|---|
| `patient_id` | Ana |
| `revision` | 1 |
| `data` | La historia completa en JSON: antecedentes, alergias, hábitos, plan, consentimiento, declaración, exámenes solicitados, odontograma y la lista de adjuntos (sus `id`, no los archivos) |
| `saved_by_user_id` | La doctora (quien guardó esa versión) |
| `saved_at` | Lunes 10:32 (cuándo se guardó esa versión) |

**Lo que no se versiona:**
- Las **atenciones** y las **notas**: no se pueden cambiar, así que no hace falta.
- Los **archivos**: la versión solo nombra sus `id`. Por eso un adjunto quitado no se borra (§ 2.3).

**Espacio:**
- Cada guardado agrega una copia completa. Lo más pesado es el odontograma.
- PostgreSQL comprime solo los `jsonb` grandes.
- Con 820 pacientes el volumen es bajo. En las pruebas se mide cuánto ocupa una versión con un odontograma real.
- Si algún día pesa demasiado, se puede guardar solo lo que cambió. No hace falta ahora.

**Cómo se consulta:**
- **Por ahora**, con SQL. Por ejemplo, `SELECT revision, saved_at, data FROM clinical_record_versions WHERE patient_id = '…' ORDER BY revision`.
- **Si la clínica lo necesita**, se agrega una pantalla "Versiones anteriores". Con los datos ya guardados basta.

## 3. Archivos

### Nuevos

```text
back/docs/plan-historia-clinica.md                          ← este plan (se borra al terminar)
back/src/ClinicApp.Api/Common/
└── JsonbConversion.cs          ← HasJsonbConversion(): guarda una clase de C# como jsonb
                                   (ClinicClock lo crea plan-pacientes)
back/src/ClinicApp.Api/Modules/ClinicalHistory/
├── ClinicalHistoryKeys.cs      ← listas de valores permitidos (19 antecedentes, 8 alertas, tipos de examen...)
├── ClinicalHistoryEntities.cs  ← ClinicalRecord, ClinicalRecordVersion, ClinicalEncounter, EncounterNote, ClinicalAttachment
├── ClinicalHistoryConfiguration.cs ← tablas, columnas jsonb, índices, restricciones
├── RecordSections.cs           ← secciones de la historia (antecedentes, hábitos, plan, consentimiento...) con su validación
├── EncounterSections.cs        ← secciones de la atención (signos vitales, exámenes, diagnósticos...) con su validación
├── ClinicalRecordDtos.cs       ← ClinicalRecordDto, SaveRecordRequest, PatientClinicalHistoryDto
├── EncounterDtos.cs            ← ClinicalEncounterDto, CreateEncounterRequest, EncounterListItemDto, notas
├── AttachmentDtos.cs           ← DentalAttachmentDto
├── AttachmentStorage.cs        ← guardar, abrir y borrar archivos en disco; ruta por clínica y paciente; revisión de los primeros bytes
├── AttachmentCleanupService.cs ← tarea cada hora: huérfanos de más de 24 h y protocolo de limpieza (apagado por defecto)
├── ReferenceResolver.cs        ← arma el bloque `references` (nombres de tratamientos) para mostrar e imprimir
├── ClinicalRecordsController.cs   ← GET/PUT /api/clinical-history/patients/{patientId}
├── EncountersController.cs        ← /api/clinical-history/encounters (lista), crear atención, notas
└── AttachmentsController.cs       ← POST /api/clinical-history/attachments, GET …/{id}/file
back/src/ClinicApp.Api/Data/Migrations/<fecha>_CrearHistoriaClinica.cs (+ .Designer.cs)
```

### Modificados

| Archivo | Cambio |
|---|---|
| `Data/AppDbContext.cs` | `DbSet` de las 5 tablas nuevas |
| `Data/Migrations/AppDbContextModelSnapshot.cs` | Lo actualiza `dotnet ef` |
| `Program.cs` | Registrar `AttachmentStorage` y `AttachmentCleanupService`; límite de tamaño de los formularios multipart (20 MB) |
| `Modules/Auth/Roles.cs` | Constante `AdminYMedico` = `"admin,medico"` |
| `Modules/Treatments/TreatmentsController.cs` | `409` al eliminar un tratamiento que aparece en un plan o una atención (§ 2.5) |
| `appsettings.json` | Sección `Attachments` (`RootPath`, `OrphanHours`, `Retention:RemovedDays` vacío, `Retention:DryRun` = `true`) |
| `appsettings.Development.json` | `Attachments:RootPath` = `App_Data/attachments` |
| `back/.gitignore` | Ignorar `App_Data/` (los adjuntos de prueba no van al repositorio) |
| `ClinicApp.Api.http` | Peticiones de ejemplo de la historia clínica |
| `README.md` | Variable `Attachments__RootPath` en la tabla de producción (la carpeta debe estar en los respaldos) |
| `backlog.md`, `backlog-desgloce.md` | Marcar lo hecho y anotar lo pendiente |

## 4. Entidades (tablas)

Todos los `id` son `uuid`. Las fechas con hora van en UTC (`timestamptz`) y las fechas sin hora en `date`. Los nombres en la base van en snake_case.

**Clínica (D13):** `clinical_records`, `clinical_record_versions`, `clinical_encounters` y `clinical_attachments` tienen además `InstitutionId` (`uuid` FK → `institutions`, restrict), que asigna y filtra la API sola (`ITenantEntity`, M4 del plan de multi-clínica). Es la primera columna de sus índices de búsqueda; por ejemplo, la lista de atenciones usa `(institution_id, date)`. `encounter_notes` no la lleva: se lee por su atención. Para no repetirla, no aparece en las tablas de abajo.

### `ClinicalRecord` → tabla `clinical_records` (una por paciente)

| Atributo | Tipo C# | Columna | Reglas |
|---|---|---|---|
| `PatientId` | `Guid` | `uuid` **PK** | Sin FK por ahora (D1) |
| `Revision` | `int` | `integer` | Concurrencia optimista: el `UPDATE` exige la revisión leída (token de concurrencia de EF Core) |
| `Chart` | `JsonElement?` | `jsonb` null | Odontograma y periodontograma tal como los exporta la librería (`{ payload, summary }`). No se valida por dentro. |
| `MedicalBackground` | `MedicalBackground` | `jsonb` | § 5 |
| `AllergiesAndMedication` | `AllergiesAndMedication` | `jsonb` | § 5 |
| `Habits` | `Habits` | `jsonb` | § 5 |
| `DentalBackground` | `DentalBackground` | `jsonb` | § 5 |
| `PeriodontalBackground` | `PeriodontalBackground` | `jsonb` | § 5 |
| `Plan` | `List<ProposedTreatment>` | `jsonb` | § 5 |
| `DataConsent` | `DataConsent` | `jsonb` | § 5 |
| `TruthDeclaration` | `TruthDeclaration` | `jsonb` | § 5 |
| `ExamRequests` | `List<ExamRequest>` | `jsonb` | § 5 |
| `CreatedAt` / `UpdatedAt` | `DateTime` | `timestamptz` | |
| `UpdatedByUserId` | `Guid?` | `uuid` FK → `users` (set null) | Auditoría |

Los adjuntos no se guardan aquí: son filas de `clinical_attachments` con `linked_at` (ver abajo).

**Paciente sin historia:** si no tiene fila, `GET` devuelve una historia vacía con `revision: 0` y el consentimiento `pendiente`, sin guardarla. El primer `PUT` (con `revision: 0`) la crea con `revision: 1`.

### `ClinicalRecordVersion` → tabla `clinical_record_versions` (D12)

| Atributo | Tipo C# | Columna | Reglas |
|---|---|---|---|
| `Id` | `Guid` | `uuid` PK | |
| `PatientId` | `Guid` | `uuid` FK → `clinical_records` (restrict) | |
| `Revision` | `int` | `integer` | Revisión que se reemplazó. Único `(patient_id, revision)`. |
| `Data` | `JsonElement` | `jsonb` | La historia completa en esa revisión, con la forma de `ClinicalRecordDto` |
| `SavedByUserId` | `Guid?` | `uuid` FK → `users` (set null) | Quién la había guardado |
| `SavedAt` | `DateTime` | `timestamptz` | Cuándo se había guardado |

### `ClinicalEncounter` → tabla `clinical_encounters` (inmutable: sin `UPDATE` ni `DELETE`)

| Atributo | Tipo C# | Columna | Reglas |
|---|---|---|---|
| `Id` | `Guid` | `uuid` PK | Lo genera el frontend (D7) |
| `PatientId` | `Guid` | `uuid` | Sin FK por ahora (D1). Índice `(patient_id, date)`. |
| `Date` | `DateOnly` | `date` | Obligatoria, no futura (D5). Índice. |
| `ProfessionalId` | `Guid` | `uuid` | Obligatorio, sin FK por ahora (D1). Índice. |
| `LegacyProfessionalName` | `string?` | `varchar(120)` null | Solo para importar atenciones antiguas; la API nunca lo llena |
| `AppointmentId` | `Guid?` | `uuid` null | **Único** cuando no es null (una cita, una atención). Sin FK por ahora. |
| `Reason` | `string` | `varchar(500)` | Mínimo 3 caracteres |
| `PresentIllness` | `string` | `varchar(2000)` | |
| `Vitals` | `Vitals` | `jsonb` | § 6 |
| `Asa` | `string` | `varchar(3)` | `""`, `I`, `II`, `III`, `IV` |
| `RiskAssessment` | `List<string>` | `jsonb` | `hemorragico`, `infeccioso`, `ambulatorio` |
| `ExtraoralExam` / `IntraoralExam` | `Dictionary<string, ExamFinding>` | `jsonb` | § 6 (6 y 8 elementos) |
| `Pain` | `Pain` | `jsonb` | § 6 |
| `CariesRisk` / `PeriodontalRisk` | `RiskLevel` | `jsonb` | § 6 |
| `Diagnoses` | `List<Diagnosis>` | `jsonb` | Al menos uno. § 6 |
| `DiagnosisSummary` | `string` | `text` | Diagnósticos unidos por " · ", calculado por el servidor para la búsqueda (no se expone) |
| `Prognosis` | `Prognosis` | `jsonb` | § 6 |
| `PeriodontalDiagnosis` | `PeriodontalDiagnosis` | `jsonb` | § 6 |
| `MaintenanceInterval` | `MaintenanceInterval` | `jsonb` | § 6 |
| `Procedures` | `string` | `varchar(4000)` | D8 |
| `Materials` | `string` | `varchar(1000)` | |
| `RequestedExams` | `List<RequestedExam>` | `jsonb` | § 6 |
| `ExamFindings` | `string` | `varchar(1000)` | |
| `Evolution` / `Notes` | `string` | `varchar(4000)` | D8 |
| `NextVisit` | `DateOnly?` | `date` null | Igual o posterior a `Date`. Se devuelve `""` si está vacío. |
| `PerformedTreatments` | `List<PerformedTreatment>` | `jsonb` | § 6 |
| `ChartSnapshot` | `JsonElement?` | `jsonb` null | Copia del odontograma (D6) |
| `ClinicalSnapshot` | `ClinicalSnapshot?` | `jsonb` null | Copia de alertas, alergias y medicación (D6) |
| `CreatedByUserId` | `Guid?` | `uuid` FK → `users` (set null) | Auditoría |
| `CreatedAt` | `DateTime` | `timestamptz` | |

### `EncounterNote` → tabla `encounter_notes` (inmutable)

| Atributo | Tipo C# | Columna | Reglas |
|---|---|---|---|
| `Id` | `Guid` | `uuid` PK | Lo genera el servidor |
| `EncounterId` | `Guid` | `uuid` FK → `clinical_encounters` (restrict) | Índice |
| `Text` | `string` | `varchar(4000)` | Mínimo 10 caracteres |
| `AuthorUserId` | `Guid?` | `uuid` FK → `users` (set null) | De la sesión |
| `AuthorName` | `string` | `varchar(120)` | Copia del nombre al firmar (D10) |
| `CreatedAt` | `DateTime` | `timestamptz` | |

### `ClinicalAttachment` → tabla `clinical_attachments`

| Atributo | Tipo C# | Columna | Reglas |
|---|---|---|---|
| `Id` | `Guid` | `uuid` PK | Lo genera el servidor |
| `PatientId` | `Guid` | `uuid` | Índice. Sin FK por ahora (D1). |
| `Alias` | `string` | `varchar(255)` | Nombre con que lo subió el usuario, limpio (sin carpetas ni caracteres de control). Se muestra y se usa al descargar. En la API viaja como `name` (§ 2.3). |
| `Kind` | `string` | `varchar(30)` | Uno de los 12 tipos (`radiografia_periapical`… `consentimiento`, `otro`), con `CHECK` |
| `Mime` | `string` | `varchar(50)` | `image/jpeg`, `image/png`, `image/webp` o `application/pdf`, con `CHECK`. Lo decide el servidor por los primeros bytes. |
| `Size` | `long` | `bigint` | 1 byte a 20 MB, con `CHECK` |
| `StoragePath` | `string` | `varchar(200)` | `{institutionId}/{patientId}/{id}.{ext}`, relativo a `Attachments:RootPath` (§ 2.3). Nombre generado por el servidor. No se expone. |
| `LinkedAt` | `DateTime?` | `timestamptz` null | `null` = subido pero todavía no está en la historia guardada (se borra a las 24 h) |
| `RemovedAt` | `DateTime?` | `timestamptz` null | Se quitó de la historia: deja de aparecer en ella, pero el archivo se conserva para las versiones anteriores (§ 2.3) |
| `PurgedAt` | `DateTime?` | `timestamptz` null | El protocolo de limpieza borró el archivo (§ 2.3). La fila se conserva. Siempre `null` mientras el protocolo esté apagado. |
| `UploadedByUserId` | `Guid?` | `uuid` FK → `users` (set null) | Auditoría |
| `CreatedAt` | `DateTime` | `timestamptz` | |

## 5. Secciones de la historia (columnas `jsonb`)

Cada sección es una clase de C# que la API recibe, valida y guarda tal cual. Las reglas son las de `background.types.ts` y `clinical-history.types.ts`. Las fechas van como texto `"YYYY-MM-DD"` o `""`. Los `id` de los elementos de una lista (alergias, propuestos, exámenes) los genera el frontend: deben venir, tener hasta 100 caracteres y no repetirse en la lista.

| Sección | Campos | Reglas que valida la API |
|---|---|---|
| `MedicalBackground` | `denies`, `conditions` (diccionario de las 19 claves → `{ personal, family, detail }`) | Solo claves conocidas; las que falten se completan vacías. `detail` máx. 500. `denies` no se puede combinar con antecedentes marcados. `hospitalizaciones`, `cirugias` y `otro` marcados exigen `detail` ≥ 3. |
| `AllergiesAndMedication` | `allergies[]` (`id`, `reaction`, `substance`, `manifestation`), `medications[]` (`id`, `name`, `dose`, `indication`), `alerts[]` | `reaction` y `name` ≥ 2. Sustancia y dosis máx. 200; manifestación e indicación máx. 300. `alerts` solo de las 8 claves, sin repetir. Hasta 50 elementos por lista. |
| `Habits` | `tobacco`, `alcohol`, `cariogenicDiet` (`answer`, `detail`); `bruxism` (`answer`, `pattern`); `mouthBreathing` (`answer`); `hygiene` (`answer`, `quality`, `brushingPerDay`, `aids[]`) | `answer` ∈ `""`, `si`, `no`. `pattern` ∈ `""`, `diurno`, `nocturno`, `ambos`. `quality` ∈ `""`, `adecuada`, `deficiente`. `brushingPerDay` entero de 0 a 10 o `null`. `aids` de las 5 claves. `detail` máx. 300. |
| `DentalBackground` | `items[]`, `notes` | `items` de las 14 claves; `notes` máx. 1000 |
| `PeriodontalBackground` | `items[]` | De las 10 claves |
| `ProposedTreatment` (lista `plan`) | `id`, `treatmentId?`, `description`, `tooth`, `phase`, `plannedDate` | `tooth` máx. 60. `phase` ∈ `""` + 7 fases. `plannedDate` fecha o `""`; no se exige que sea futura al guardar, porque un propuesto antiguo puede tener fecha pasada. `treatmentId` debe existir en el catálogo (D11). `description` solo se guarda si `treatmentId` es `null` (texto libre antiguo, § 2.5). Hasta 200 elementos. |
| `DataConsent` | `status`, `signer`, `signerName`, `signerDocumentId`, `date`, `attachmentId?` | `status` ∈ `pendiente`, `aceptado`, `rechazado`. `signer` ∈ `paciente`, `representante`. Si no está pendiente: nombre ≥ 3, cédula ≥ 5 y fecha obligatoria, no futura. `attachmentId` debe estar en los adjuntos (D11). |
| `TruthDeclaration` | `accepted`, `signer`, `signerName`, `signerDocumentId`, `date`, `professionalId` | Si `accepted`: nombre ≥ 3, cédula ≥ 5 y fecha obligatoria, no futura. `professionalId` es texto, sin verificar (D1). |
| `ExamRequest` (lista `examRequests`) | `id`, `kind`, `detail`, `status`, `encounterId`, `requestedAt`, `attachmentId?`, `receivedAt?` | `kind` de los 10 tipos de examen. `status` ∈ `pendiente`, `recibido`. `encounterId` debe ser una atención del paciente y `attachmentId` estar en los adjuntos (D11). `detail` máx. 300. |

Los errores salen con la ruta del campo, por ejemplo `dataConsent.signerName` o `medicalBackground.conditions.otro.detail`.

## 6. Secciones de la atención (columnas `jsonb`)

Reglas de `encounter-assessment.types.ts` y `encounterFormSchema`:

| Sección | Campos | Reglas |
|---|---|---|
| `Vitals` | `bloodPressure`, `heartRate`, `respiratoryRate`, `spo2`, `temperature`, `weight`, `height` | Todo opcional (`""` o `null`). PA con formato `NNN/NN`. FC 30–220, FR 5–60 y SpO₂ 50–100 (enteros). Temperatura 34–42, peso 1–300, talla 30–250. |
| `ExamFinding` (diccionarios extraoral e intraoral) | `status`, `finding` | Solo las 6 y 8 claves conocidas (las que falten = `no_evaluado`). `status` ∈ `normal`, `alterado`, `no_evaluado`. Si es `alterado`, `finding` ≥ 3. Máx. 500. |
| `Pain` | `scale`, `location`, `character` | `scale` entero de 0 a 10 o `null`; textos máx. 500 |
| `RiskLevel` (caries y periodontal) | `level`, `factors` | `level` ∈ `""`, `bajo`, `moderado`, `alto`; `factors` máx. 500 |
| `Diagnosis` (lista) | `id`, `description`, `tooth`, `priority` | Al menos uno. `description` ≥ 3 (máx. 500), `tooth` máx. 60, `priority` ∈ `""`, `alta`, `media`, `baja`. Hasta 50. |
| `Prognosis` | `level`, `notes` | `level` ∈ `""` + 4 opciones; `notes` máx. 1000 |
| `PeriodontalDiagnosis` | `gingival`, `stage`, `extent`, `grade`, `stability`, `periImplant`, `smoking`, `diabetes`, `otherFactors`, `teethLostToPerio` | Cada componente con sus opciones o `""`. Textos máx. 500. `teethLostToPerio` entero de 0 a 32 o `null`. |
| `MaintenanceInterval` | `option`, `other` | `option` ∈ `""`, `3`, `4`, `6`, `otro`; con `otro`, `other` ≥ 2 (máx. 100) |
| `RequestedExam` (lista) | `id`, `kind`, `detail` | `kind` de los 10 tipos; `interconsulta` exige `detail` ≥ 3; máx. 300 |
| `PerformedTreatment` (lista) | `id`, `treatmentId?`, `description`, `tooth`, `cost`, `assignmentId?` | `cost` de 0 a 1 000 000. `tooth` máx. 60. `treatmentId` existe en el catálogo (D11). `description` solo se guarda si `treatmentId` es `null` (§ 2.5). `assignmentId` es texto, sin verificar (D1). |
| `ClinicalSnapshot` | `alerts[]`, `allergies[]`, `medications[]` | Mismas reglas que en la historia |

## 7. Endpoints

Todos solo para `admin` y `medico` (`403` para `recepcion`).

| Método y ruta | Respuesta | Errores |
|---|---|---|
| `GET /api/clinical-history/encounters?page&pageSize&search&patientId&professionalId` | `200` paginado, `EncounterListItem` (`id`, `patientId`, `date`, `professionalId`, `legacyProfessionalName`, `reason`, `diagnoses`, `nextVisit`). Ordenado por fecha y luego por creación, de la más reciente a la más antigua. `search` busca en el motivo y los diagnósticos (D1). | |
| `GET /api/clinical-history/patients/:patientId` | `200` `{ record, encounters, references }`. Atenciones de la más antigua a la más reciente, cada una con sus notas (`addenda`). `references`: nombres de los tratamientos nombrados en la historia y en las atenciones (§ 2.5). Historia vacía si no existe. | |
| `PUT /api/clinical-history/patients/:patientId` | `200` con la historia guardada y `revision + 1` | `400` por campo. `409` "Otra pestaña o usuario modificó esta historia. Recarga la historia antes de continuar." si la revisión no coincide. |
| `POST /api/clinical-history/patients/:patientId/encounters` | `201` con la atención (o `200` con la existente si es un reintento, D7) | `400` por campo; `409` si la cita ya tiene atención o el `id` es de otro paciente |
| `POST /api/clinical-history/encounters/:encounterId/notes` | `201` `{ id, text, authorName, createdAt }` | `400` (texto < 10), `404` atención |
| `POST /api/clinical-history/attachments` (multipart: `file`, `kind`, `patientId`) | `201` `{ id, name, kind, mime, size, createdAt }` | `400` "<nombre>: utiliza JPG, PNG, WebP o PDF de hasta 20 MB" (`errors.file`), o `kind` inválido |
| `GET /api/clinical-history/attachments/:attachmentId/file` | `200` con el archivo, su tipo y `Content-Disposition` con el alias | `404` (no existe o es de otra clínica); `410` si el protocolo de limpieza lo borró |

## 8. Reglas de negocio

**Guardar la historia (`PUT`):**
1. Se valida el cuerpo completo (§ 5) y las referencias (D11).
2. Si la `revision` enviada no es la guardada: `409` y no cambia nada. Dos guardados simultáneos con la misma revisión: uno gana, el otro recibe `409`.
3. Antes de sobrescribir, la versión anterior se copia en `clinical_record_versions` (D12).
4. **Adjuntos:** la lista `attachments` que envía el frontend decide cuáles quedan en la historia.
   - Cada `id` debe ser un adjunto subido para **ese** paciente (`400` si no). Se marca con `linked_at`.
   - Los que estaban y ya no vienen se marcan con `removed_at`. El archivo **no se borra**, porque las versiones anteriores lo siguen nombrando (§ 2.3).
   - Volver a agregar uno quitado limpia `removed_at`.
   - El nombre, tipo y tamaño de cada adjunto salen de la tabla, no de lo que envía el frontend.
5. `revision + 1`, `updatedAt` y `updatedByUserId`. Todo en una transacción.
6. **Otra clínica:** si la historia de ese `patientId` ya existe en otra clínica, `404` y no se toca (D13). Cuando exista `patients`, se verifica directamente que el paciente sea de la clínica de la sesión.

**Crear la atención (`POST`):** se valida el cuerpo (§ 6) y el servidor calcula `diagnosisSummary`.
- Si el `id` ya existe: se devuelve la atención guardada, sin comparar el contenido (D7).
- Si dos reintentos llegan a la vez, la llave primaria impide el duplicado; el segundo recibe la atención existente.
- La atención no modifica la historia (D2).

**Nota aclaratoria:** texto sin espacios al inicio ni al final; autor y fecha del servidor (D10).

**Subir un adjunto:**
- El tamaño se controla mientras se recibe; no se acepta más de 20 MB.
- Se revisan los primeros bytes: `FF D8 FF` = JPG, `89 50 4E 47` = PNG, `RIFF…WEBP` = WebP, `%PDF-` = PDF.
- El archivo se guarda con un nombre temporal y se renombra al terminar, para que un corte no deje un archivo a medias.

**Descargar un adjunto:** se permite también si está quitado (`removed_at`), para que las versiones anteriores sigan teniendo su archivo.

**Limpieza (`AttachmentCleanupService`):** corre cada hora, para todas las clínicas (usa `IgnoreQueryFilters()` a propósito, porque no tiene sesión).
- **Huérfanos:** borra los adjuntos que **nunca** se guardaron en la historia (`linked_at = null`) y tienen más de `Attachments:OrphanHours` (24 h): la fila y el archivo. Con `OrphanHours` vacío no borra nada.
- **Protocolo de conservación:** solo si `Attachments:Retention:RemovedDays` tiene valor. Toma los adjuntos con `removed_at` más antiguo que el plazo y `purged_at = null`. Con `DryRun = true` solo los anota en el log; con `false` borra el archivo y marca `purged_at` (§ 2.3). Nunca toca un adjunto que está en la historia actual.
- Si un archivo no se puede borrar, deja un aviso en el log y lo reintenta en la siguiente vuelta.

## 9. Migración

`dotnet ef migrations add CrearHistoriaClinica` crea 5 tablas:
- `clinical_records`
- `clinical_record_versions`
- `clinical_encounters`
- `encounter_notes`
- `clinical_attachments`

Las columnas `jsonb` se guardan con `HasJsonbConversion()`. Se crean los `CHECK` (tipo y tamaño de adjunto), el índice único parcial de `appointment_id` (`WHERE appointment_id IS NOT NULL`) y los índices de búsqueda. Antes de aplicarla se revisa el SQL con `dotnet ef migrations script`.

## 10. Pruebas

Script de punta a punta contra la base local, con los tres roles:

- **Roles:** `admin` y `medico` acceden; `recepcion` recibe `403` en los 7 endpoints; sin sesión, `401`.
- **Historia:**
  - Paciente sin historia: vacía con `revision: 0`.
  - Primer guardado: `revision: 1`. Guardar con una revisión vieja: `409`.
  - Dos guardados simultáneos: uno `200` y otro `409`.
  - La versión anterior queda en `clinical_record_versions`.
- **Validación de la historia** (`400` con la ruta del campo):
  - "Niega" combinado con antecedentes;
  - "Otro" marcado sin detalle;
  - consentimiento aceptado sin nombre, sin cédula o con fecha futura;
  - declaración aceptada incompleta;
  - alergia sin reacción;
  - alerta desconocida;
  - tratamiento propuesto inexistente;
  - examen que apunta a una atención de otro paciente;
  - consentimiento que apunta a un archivo que no está en la lista.
- **Atención:**
  - Crear: `201`. Reintento con el mismo `id`: `200` sin duplicar. Mismo `id` en otro paciente: `409`. Cita repetida: `409`.
  - Validaciones: fecha futura, sin diagnósticos, motivo corto, signos vitales fuera de rango, PA con formato inválido, hallazgo "alterado" sin texto, interconsulta sin detalle, "otro" intervalo sin texto, próximo control anterior a la fecha.
  - La historia devuelve las atenciones en orden y con sus notas.
- **Lista de atenciones:** paginación, filtro por paciente y por profesional, búsqueda por motivo y por diagnóstico, orden descendente.
- **Notas:** `201` con el autor de la sesión; texto corto: `400`; atención inexistente: `404`.
- **Adjuntos:**
  - Subir JPG, PNG, WebP y PDF: `201`.
  - Rechazos (`400`): un `.txt` renombrado a `.png`, uno de más de 20 MB y un `kind` inválido.
  - Descargar: mismo contenido, byte a byte.
  - Guardar la historia con el adjunto lo marca vinculado.
  - Quitarlo y guardar: deja de aparecer en la historia, pero el archivo sigue en disco y se puede descargar.
  - Un adjunto de otro paciente en la lista: `400`.
  - Limpieza: un huérfano antiguo se borra (con la fecha ajustada en la base para no esperar 24 h).
  - El archivo queda en `{clínica}/{paciente}/{id}.{ext}` y la descarga usa el alias como nombre.
  - Protocolo: apagado no toca nada; con `RemovedDays` y `DryRun = true` solo anota en el log; con `DryRun = false` borra el archivo de un adjunto quitado antiguo, marca `purged_at` y la descarga responde `410`. Un adjunto de la historia actual nunca se borra.
- **Varias clínicas:** con un médico de la clínica A y otro de la B:
  - B no ve en la lista las atenciones de A.
  - `GET` de la historia de un paciente de A desde B: historia vacía, sin ningún dato de A. `PUT` desde B: `404`, y la historia de A no cambia (hasta que exista `patients`, se detecta porque la fila ya existe en otra clínica).
  - Descargar un adjunto de A desde B: `404`. Usar en B un adjunto o una atención de A dentro de la historia: `400`.
- **Zona horaria:** "hoy" en la zona de la clínica se acepta y "mañana" se rechaza. Dos clínicas con zonas distintas tienen "hoy" distinto.
- **Referencias:**
  - `references` trae el nombre de un tratamiento inactivo y de uno fuera de los primeros 100.
  - `description` se descarta en los ítems del catálogo y se conserva en los de texto libre.
  - Eliminar un tratamiento usado en un plan o en una atención: `409`.
- **Versiones:** tras tres guardados hay dos versiones, con su revisión, autor y fecha. Se mide cuánto ocupa una versión con odontograma.

## 11. Al terminar

- Marcar en `backlog.md` y `backlog-desgloce.md` los endpoints hechos.
- **Anotar como pendientes:**
  - Las llaves foráneas a `patients`, `professionals`, `appointments` y `treatment_assignments` (D1), y verificar que el paciente exista.
  - La búsqueda de atenciones por nombre o cédula del paciente.
  - El registro de la atención en una sola transacción (D2), con su cambio en el frontend.
  - Las preguntas A1 a A8 sobre qué es una atención (§ 2.1).
  - El cambio de `toFieldErrors` en el frontend (D9), y usar `references` y dejar de enviar `description` (§ 2.5).
  - El protocolo de limpieza existe pero está apagado: se activa solo si cambia la definición de conservación (§ 2.3).
  - Antivirus de adjuntos.
  - Texto legal y versión del consentimiento.
  - Firmas.
  - Importar las historias del modo demostración.
  - Una pantalla para consultar las versiones anteriores de la historia, si la clínica la necesita.
- Commit en la rama actual. El push, solo si lo pides.
- Borrar este plan.
