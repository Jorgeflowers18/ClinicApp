# Backlog — Backend (.NET) — ClinicApp

TODOs pendientes para la API .NET, extraídos directamente de los comentarios `// TODO: conectar a endpoint real -> ...` en `front/src/modules/*/api/*.api.ts` y de las reglas de negocio descritas en [`../documentacion/arquitectura-frontend.md`](../documentacion/arquitectura-frontend.md). El frontend ya tiene cada función `*Real` escrita contra el endpoint esperado — activar `VITE_USE_MOCK_API=false` en `front/.env` la conecta sin tocar UI ni hooks, en cuanto el endpoint exista.

Dividido por módulo, usando los mismos nombres que `front/src/modules/`. Marca cada casilla al implementar el endpoint correspondiente.

Algunos endpoints **no tienen todavía función `*Real` en el frontend** (`finance`, `institution` y parte de `auth`): esas pantallas usan datos de ejemplo o el almacenamiento del navegador. Están marcados como propuesta; al implementarlos hay que agregar también su función `*Real` en el frontend.

La asignación de cada módulo a un responsable y el orden de trabajo están en [`backlog-desgloce.md`](./backlog-desgloce.md).

---

## Transversal (aplica a todos los módulos)

- [x] Autenticación JWT (`Authorization: Bearer <token>`). Por defecto **todos** los endpoints piden sesión (política de respaldo en `Program.cs`); los públicos llevan `[AllowAnonymous]`: `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/password-recovery`, `/auth/password-reset`, `/auth/access-requests` y `/health`. Sin sesión o con un token vencido: `401` "Inicia sesión para continuar".
- [x] Errores de validación (400) en formato `ValidationProblemDetails` estándar de ASP.NET Core:
  ```json
  { "title": "...", "detail": "...", "errors": { "campo": ["mensaje"] } }
  ```
  El interceptor de Axios del frontend (`shared/lib/http.ts`) espera exactamente este formato para mostrar errores por campo en los formularios. Los demás errores (401, 403, 404, 405, 415, 429, 500) también salen como `ProblemDetails` con título en español (`Common/ProblemDetailsSetup.cs`).
- [ ] Conflictos de negocio (choque de horario, etc.) como `409` con el mismo formato `errors` cuando aplique a un campo específico (ej. `startTime`).
- [x] Paginación estándar donde el frontend la pide (`page`, `pageSize`, `search`) devolviendo `{ items, page, pageSize, totalItems, totalPages }`. Helper compartido: `Common/Paging.cs` (`PageQuery`, `PagedResult<T>`, `ToPagedResultAsync`).
- [ ] **Autorización por rol en la API**, igual a la que hoy aplica el frontend con rutas protegidas (que no son una barrera real de seguridad). `403` si el rol no corresponde. Cada controlador lo declara con `[Authorize(Roles = ...)]` usando las constantes de `Modules/Auth/Roles.cs`. Hecho en `treatments` e `inventory` (con la excepción de lectura de insumos anotada en `inventory`); aplicarlo en cada módulo nuevo:

  | Módulo | Roles |
  |---|---|
  | `patients`, `appointments` (incluye `professionals`, `rooms`, `schedule-blocks`), `treatments`, `treatment-assignments` | `admin`, `recepcion`, `medico` |
  | `clinical-history` | `admin`, `medico` |
  | `inventory`, `notifications`, `finance` | `admin`, `recepcion` |
  | `reports`, `PUT /institution/profile` | `admin` |

  Ver los conflictos de rol anotados en `reports` y `finance`: algunas pantallas visibles para todos los roles consumen endpoints restringidos.

## `auth`

Implementado en `back/src/ClinicApp.Api/Modules/Auth/`. Sesión: el `accessToken` (JWT, 15 min) va en `Authorization` y el frontend lo guarda solo en memoria; el token de refresh (7 días, se renueva con cada uso) va en la cookie `clinicapp_refresh` (`httpOnly`, `Secure`, `SameSite=Strict`, ruta `/api/auth`). En la base solo se guardan hashes de contraseñas (PBKDF2) y de tokens (SHA-256). Límite de 20 intentos por minuto por IP en login, recuperación, restablecimiento y solicitudes de acceso (`429` con `Retry-After`).

- [x] `POST /auth/login` — valida credenciales, devuelve `{ accessToken, expiresIn, user }` y la cookie de refresh. `401` "Correo o contraseña incorrectos" (mismo mensaje y tiempo de respuesta exista o no el correo); `403` si la cuenta está desactivada (solo si la contraseña era correcta). El correo no distingue mayúsculas.
- [x] `POST /auth/logout` — invalida el token de refresh y borra la cookie (`204`).
- [x] `GET /auth/me` — usuario de la sesión (`AuthUser`). `401` si el usuario ya no existe o fue desactivado.
- [x] Roles soportados: `admin`, `recepcion`, `medico` (restricción `ck_users_role` en la tabla `users`).
- [x] Vincular usuario y profesional: `users.professional_id` → `professionals` (único). Lo asigna el admin con `PUT /professionals/:id` (campo `userId`) y viaja en `/auth/login`, `/auth/refresh` y `/auth/me`. En desarrollo, `medico@clinica.com` queda vinculado a la Dra. Carla Ríos.
- [ ] **Frontend:** usar `user.professionalId` como profesional por defecto de una atención nueva, en lugar de comparar nombres (`clinical-history/hooks/use-default-professional.ts`).

**Endpoints sin función `*Real` en el frontend** (implementados en la API; falta agregar su función `*Real` en `auth.api.ts`, ver "Pendiente en el frontend" abajo):

- [x] `POST /auth/refresh` — renueva la sesión con la cookie y devuelve lo mismo que el login (`{ accessToken, expiresIn, user }`), rotando la cookie. Si llegan dos renovaciones con el mismo token en menos de 30 s (dos pestañas), ambas funcionan. Reusar un token ya reemplazado después de ese margen se trata como robo: se cierran todas las sesiones del usuario y queda un aviso en el log.
- [x] `PUT /auth/me/profile` — guarda el perfil (`UserProfile`) en una columna `jsonb` de `users` y devuelve el `AuthUser` actualizado. `/auth/login`, `/auth/refresh` y `/auth/me` lo devuelven en `user.profile` (`null` hasta completarlo). Validación: nombre obligatorio (máx. 120), cargo y especialidad (máx. 80), bio (máx. 1000), color `#RRGGBB`, foto como data URL PNG/JPG/WEBP/GIF de hasta ~300 KB.
- [x] `POST /auth/password-recovery` (body: `{ email }`) — siempre `202`. Si la cuenta existe y está activa, genera un enlace de un solo uso válido 60 min (`{Auth:FrontendBaseUrl}/restablecer-contrasena?token=...`); solo vale el último enviado. `POST /auth/password-reset` (body: `{ token, password }`, mínimo 8 caracteres) fija la contraseña (`204`) y cierra todas las sesiones; `400` "El enlace no es válido o ya expiró".
  - [ ] **Proveedor de correo:** hoy `LogEmailSender` escribe el correo en el log solo en desarrollo; en producción no se envía nada. Reemplazarlo por un proveedor real (ver `notifications`).
- [x] `POST /auth/access-requests` (body: `{ email, fullName, institution, message }`) — guarda la solicitud en `access_requests` con estado `pendiente` (`202`).
  - [ ] Definir quién la revisa, cómo se le avisa y cómo se crea el usuario (no hay endpoint para listarlas).
- [ ] **Gestión de usuarios:** no hay pantalla para crear usuarios, asignar roles ni desactivarlos. Mientras tanto, `UserSeeder` crea en desarrollo las tres cuentas del modo mock (`admin@clinica.com` / `admin123`, `recepcion@clinica.com` / `recepcion123`, `medico@clinica.com` / `medico123`) si la tabla está vacía, y en cualquier entorno un administrador inicial si existen `Seed__AdminEmail` y `Seed__AdminPassword` (mínimo 12 caracteres). Definir con la clínica si se agrega una pantalla de administración.
- [ ] **Limpieza de tokens viejos:** borrar periódicamente los tokens de refresh y de recuperación vencidos (tarea programada o al iniciar sesión).

**Pendiente en el frontend para conectar `auth`** (registrar los cambios en `documentacion/arquitectura-frontend.md`):

- [ ] `shared/lib/http.ts`: `withCredentials: true` para que el navegador mande y guarde la cookie de refresh (en desarrollo el frontend y la API están en puertos distintos).
- [ ] Al cargar la app, llamar a `POST /auth/refresh` para restaurar la sesión (reemplaza a `sessionStorage` del modo mock).
- [ ] Ante un `401` de otro endpoint, intentar una sola renovación (`POST /auth/refresh`, compartida si hay varias peticiones a la vez) y repetir la petición; si falla, cerrar la sesión como hoy.
- [ ] Funciones `*Real` en `auth.api.ts` para `refresh`, `me`, `updateProfile`, `passwordRecovery`, `passwordReset` y `accessRequest`, y conectar las pantallas "Mi perfil", "Recuperar contraseña" y "Solicitar acceso".
- [ ] Nueva pantalla `/restablecer-contrasena?token=...` (contraseña nueva y confirmación) que llama a `POST /auth/password-reset`.
- [ ] "Mi perfil": reducir la foto (por ejemplo a 256 × 256 px) antes de enviarla; la API rechaza fotos de más de ~300 KB.
- [ ] Agregar `professionalId: string | null` al tipo `AuthUser`.

## `patients`

Implementado en `back/src/ClinicApp.Api/Modules/Patients/`. Roles: los tres ven, crean y editan; dar de baja, `admin` y `recepcion`; reactivar, solo `admin`. Detalle en [`docs/endpoints-api.md` § `patients`](./docs/endpoints-api.md#7-patients).

- [x] `GET /patients` (query: `page`, `pageSize`, `search`): sin los dados de baja, del más reciente al más antiguo. La búsqueda no distingue mayúsculas ni tildes (extensión `unaccent`) y busca en nombres y apellidos, cédula, teléfono y N.° de historia (`HC-000123`).
- [x] `GET /patients/:id`: también devuelve a los dados de baja, con `deletedAt`.
- [x] `POST /patients`: `notificationsEnabled` es `true` si no viene. Cédula de otro paciente activo: `409` con `errors.documentId`, con un candado por cédula para que dos altas simultáneas no pasen las dos.
- [x] `PUT /patients/:id`: ignora `clinicalRecordNumber`. Solo revisa la cédula si cambió, así se pueden editar los pacientes importados con cédula repetida. `409` si está dado de baja.
- [x] `DELETE /patients/:id`: **baja lógica** (`deleted_at`); el paciente desaparece de la lista y de la búsqueda.
- [x] `POST /patients/:id/restore` (nuevo, solo `admin`): reactiva. `409` si otro paciente activo ya usa su cédula.
- [x] **Datos del cliente (ítem 12):** `maritalStatus`, `occupation`, `company`, `nationality`, `city` y `emergencyContactRelationship`. `medicalHistory` y `allergies` no existen en el backend: el frontend ya los quitó y no hay datos que migrar.
- [x] **N.° de historia clínica:** `clinicalRecordNumber` lo asigna una secuencia de PostgreSQL (`patient_record_number_seq`) y es de solo lectura.
- [ ] **Importar los 820 pacientes** del archivo de la clínica: comando de una sola vez, que conserve las fichas como N.° de historia y siga la secuencia desde la última. Necesita las respuestas de `documentacion/decisiones-backend.md` § 5. El archivo real nunca se sube al repositorio.
- [ ] **Frontend:** ocultar el botón "Eliminar" al médico (la API le responde `403`); una pantalla o filtro para ver y reactivar a los dados de baja; agregar `deletedAt` al tipo `Patient`.
- [ ] **Última visita automática:** hoy `lastVisitAt` se edita a mano; calcularla desde las atenciones de la historia clínica.

## `appointments`

- [ ] `GET /appointments` (idealmente con filtro de rango de fechas).
- [ ] `GET /appointments?patientId=` — citas de un paciente, de la más reciente a la más antigua (pestaña "Citas" de la historia clínica y opciones de cita al registrar una atención). Hoy el mock filtra la lista completa.
- [ ] `GET /appointments/:id`.
- [ ] `POST /appointments` — debe validar disponibilidad de **profesional y consultorio** (rechazar con `409` si hay choque de horario con otra cita no cancelada o con un bloqueo de horario activo) y disparar automáticamente la notificación de confirmación (ver módulo `notifications`).
- [ ] `PUT /appointments/:id` — misma validación de disponibilidad que `POST`, excluyendo la propia cita.
- [ ] `PATCH /appointments/:id/status` — acepta `programada | confirmada | cancelada | completada | no_asistio`; al pasar a `cancelada` debe disparar automáticamente la notificación de cancelación (ver módulo `notifications`).
- [x] `GET /professionals` — catálogo de profesionales (`id, name, specialty, registrationNumber`, más `active` y `userId`). Devuelve también los inactivos. `registrationNumber` es el registro profesional de la declaración de veracidad de la historia clínica. `POST`/`PUT /professionals` (solo `admin`) crean, editan, desactivan y vinculan el usuario; `PUT` devuelve `futureAppointments`.
- [ ] **Frontend:** pantalla para administrar profesionales y consultorios, y mostrar solo los activos en los selectores (la API devuelve también los inactivos, con `active: false`).
- [x] `GET /rooms` — catálogo de consultorios (`id, name`, más `active`). `POST`/`PUT /rooms` solo para `admin`; nombre único entre los activos. Si se definen varias sedes, los consultorios podrían vincularse a una.
- [ ] `GET /schedule-blocks` — bloqueos de horario vigentes (`id, professionalId?, roomId?, start, end, reason, createdAt`; al menos uno de `professionalId`/`roomId` presente).
- [ ] `POST /schedule-blocks` — debe validar que el rango no se solape con una cita ya agendada (no cancelada) para el mismo profesional o consultorio; los bloqueos sí pueden solaparse entre sí.
- [ ] `DELETE /schedule-blocks/:id`.
- [ ] Registrar una atención clínica vinculada a una cita la pasa a `completada` (hoy el frontend llama a `PATCH /appointments/:id/status` tras guardar la atención; ver `clinical-history`). Solo desde `programada` o `confirmada`: una cita `cancelada` o `no_asistio` no cambia.
- [ ] Bloqueos son puntuales únicamente (sin recurrencia) — si el negocio pide recurrencia (ej. "todos los lunes de 13:00 a 14:00"), es un cambio de modelo, no solo de endpoint.

## `clinical-history`

Historia clínica odontológica única por paciente: un **registro editable** (`ClinicalRecord`: odontograma actual, tratamientos propuestos, consentimiento de datos y adjuntos) más un historial de **atenciones inmutables** (`ClinicalEncounter`). Reemplaza al modelo de visitas `borrador → cerrada` (ítem 13, ver [`backlog/README.md`](../backlog/README.md)). Contrato en `front/src/modules/clinical-history/types/clinical-history.types.ts`; comportamiento esperado en `clinical-history.api.ts` (funciones `*Mock`) y en [`arquitectura-frontend.md` § Historia clínica odontológica](../documentacion/arquitectura-frontend.md#historia-clínica-odontológica). Los endpoints clásicos (`GET/POST/PUT /clinical-history`, `GET /clinical-history/:id`) y los de visitas (`/clinical-history/visits…`) ya no los usa el frontend.

- [ ] **Autorización por rol en todos los endpoints del módulo:** solo `admin` y `medico`. Hoy el frontend lo restringe con rutas protegidas, que no son una barrera real de seguridad; `recepcion` debe recibir `403` también desde la API.
- [ ] `GET /clinical-history/encounters` (query: `page`, `pageSize`, `search` — nombre o cédula del paciente, motivo o diagnóstico —, `patientId`, `professionalId`) — lista paginada de `EncounterListItem` ordenada por fecha descendente.
- [ ] `GET /clinical-history/patients/:patientId` — `{ record, encounters }`. Si el paciente aún no tiene historia, devuelve un `record` vacío (`revision: 0`, consentimiento `pendiente`) y `encounters: []`. Atenciones de la más antigua a la más reciente.
- [ ] `PUT /clinical-history/patients/:patientId` — guarda el `ClinicalRecord` completo (`chart`, `medicalBackground`, `allergiesAndMedication`, `habits`, `dentalBackground`, `periodontalBackground`, `plan`, `dataConsent`, `truthDeclaration`, `attachments`, `examRequests`; ver la sección del ítem 12 abajo). Concurrencia optimista: el body trae `revision`; si no coincide con la guardada responde `409`, y si coincide la incrementa. Valida como `recordFormSchema` y responde `400` con `errors` por ruta de campo (ej. `dataConsent.signerName`): si el consentimiento no está `pendiente`, nombre (≥ 3), cédula (≥ 5) y fecha (no futura) son obligatorios. Elimina los adjuntos que dejan de estar referenciados.
- [ ] `POST /clinical-history/patients/:patientId/encounters` — crea una atención **inmutable** (no hay `PUT` ni `DELETE`). Valida como `encounterFormSchema` (`400` con `errors` por campo): fecha obligatoria y no futura, profesional obligatorio, motivo de al menos 3 caracteres, al menos un diagnóstico (ver ítem 12 abajo), próximo control igual o posterior a la fecha. `409` si `appointmentId` ya está vinculado a otra atención (una cita por atención). **Idempotente por `id`** (el frontend lo genera para poder reintentar); con backend real, el servidor puede generarlo y aceptar una clave de idempotencia. Guarda `chartSnapshot` (copia del odontograma de la historia guardada), `clinicalSnapshot` (copia de alertas, alergias y medicación de la historia guardada) y `performedTreatments` (tratamiento, pieza, costo y `assignmentId`).
- [ ] **Registro transaccional de la atención (recomendado):** el frontend coordina en varios pasos registrar los tratamientos realizados (`POST /treatment-assignments`), crear la atención, quitar de la historia los propuestos registrados y agregar los exámenes solicitados (`PUT` de la historia) y pasar la cita a `completada` (`useRegisterEncounter` en `clinical-history.queries.ts`) (ver [`arquitectura-frontend.md` § Historia clínica odontológica](../documentacion/arquitectura-frontend.md#historia-clínica-odontológica) § 4). Lo ideal es que `POST …/encounters` haga todo en una transacción.
- [ ] **Historia clínica según el formulario del consultorio (ítem 12)** — contrato en `types/background.types.ts`, `types/encounter-assessment.types.ts` y `types/clinical-history.types.ts`:
  - **Antecedentes en el `ClinicalRecord`:** `medicalBackground` (`denies` + 19 condiciones con `personal`, `family` y `detail`; validar que `denies` no se combine con condiciones marcadas y que `hospitalizaciones`, `cirugias` y `otro` marcadas tengan detalle ≥ 3), `allergiesAndMedication` (`allergies[]` con `reaction` ≥ 2, `medications[]` con `name` ≥ 2, `alerts[]` de 8 claves), `habits`, `dentalBackground` y `periodontalBackground`. Las historias existentes sin estas secciones deben devolverlas vacías.
  - **Declaración de veracidad (`truthDeclaration`):** si `accepted`, `signerName` ≥ 3, `signerDocumentId` ≥ 5 y `date` no futura; `professionalId` del catálogo. Las firmas están por definir.
  - **Plan por fases:** cada propuesto suma `phase` (`"" | urgencia | sistemica | higienica | quirurgica | restauradora | protesica | mantenimiento`) y `plannedDate` (opcional; el frontend pide hoy o futura al agregar).
  - **Exámenes solicitados (`examRequests`):** `{ id, kind, detail, status: pendiente | recibido, encounterId, requestedAt, attachmentId, receivedAt }`. Se crean al registrar una atención con `requestedExams` (hoy los agrega el frontend con un `PUT` de la historia tras crear la atención; lo ideal es que lo haga `POST …/encounters` en la misma transacción) y pasan a `recibido` cuando se adjunta el resultado.
  - **Atención:** `encounterFormSchema` suma `presentIllness`, `vitals` (PA `NNN/NN`, FC 30–220, FR 5–60, SpO₂ 50–100, temperatura 34–42 °C, peso 1–300 kg, talla 30–250 cm, todos opcionales), `asa`, `riskAssessment`, `extraoralExam` e `intraoralExam` (cada estructura `normal | alterado | no_evaluado`; hallazgo ≥ 3 en `alterado`), `pain` (EVA 0–10), `cariesRisk` y `periodontalRisk`, `diagnoses` (al menos uno; `description` ≥ 3, `tooth`, `priority`), `prognosis`, `periodontalDiagnosis` (componentes 2017, factores modificadores, `teethLostToPerio` 0–32), `maintenanceInterval` (`otro` exige texto), `materials`, `requestedExams` (la interconsulta exige detalle ≥ 3) y `examFindings`. `diagnoses` reemplaza al texto `diagnosis`: migrar las atenciones existentes convirtiéndolo en el primer diagnóstico. La búsqueda de `GET /clinical-history/encounters` debe incluir los diagnósticos.
- [ ] `POST /clinical-history/encounters/:encounterId/notes` (body: `text`, mínimo 10 caracteres) — agrega una nota aclaratoria inmutable a la atención; el autor y la fecha los pone el servidor a partir de la sesión. Devuelve `EncounterNote { id, text, authorName, createdAt }`.
- [ ] `POST /clinical-history/attachments` (multipart: `file`, `kind` — `radiografia_periapical | bitewing | panoramica | cbct | fotografias | modelos | pruebas_pulpares | laboratorio | interconsulta | biopsia | consentimiento | otro`; los adjuntos guardados con `radiografia`, `fotografia` y `documento` se migran a `radiografia_periapical`, `fotografias` y `otro` —, `patientId`) — acepta JPG, PNG, WebP o PDF de hasta 20 MB (`400` si no), guarda el archivo y devuelve `DentalAttachment { id, name, kind, mime, size, createdAt }`. La historia lo referencia cuando se guardan los cambios.
- [ ] `GET /clinical-history/attachments/:attachmentId/file` — descarga del archivo original, verificando que el usuario tenga acceso al paciente.
- [ ] **Almacenamiento real de adjuntos:** definir servicio (disco, blob storage), límites, antivirus, retención y borrado de archivos huérfanos (archivos subidos cuyos cambios se descartaron sin guardar). Hoy el frontend los guarda en IndexedDB del navegador.
- [ ] **Texto legal del consentimiento de datos:** hoy el frontend muestra un texto provisional (`dataConsentText`). Definir con la clínica el texto definitivo y si debe versionarse (guardar qué versión aceptó cada paciente).
- [ ] **Identificadores generados en el servidor.** Hoy el frontend crea los ids con `createId()` (`front/src/shared/lib/id.ts`), un UUID v4 que también funciona sin HTTPS: `crypto.randomUUID` solo existe en HTTPS o `localhost`, y el despliegue actual se sirve por HTTP en la IP del Droplet. Con backend real:
  - **Adjunto:** `POST /clinical-history/attachments` genera el `id` del `DentalAttachment`.
  - **Nota aclaratoria:** la genera el servidor.
  - **Tratamientos propuestos y atención:** el frontend los crea con id propio. El backend debe validar que cada id sea un UUID único, o reemplazarlos y devolver los definitivos.
- [ ] **Migración de datos locales:** las historias registradas en modo mock viven en el navegador de cada equipo. Definir si se importan al backend a partir del export "Historia completa JSON" de cada paciente (ya trae `{ record, encounters }`).

## `treatments`

- [x] `GET /treatments` (paginado, búsqueda por nombre o categoría).
- [x] `GET /treatments?active=true`.
- [x] `GET /treatments/:id`.
- [x] `POST /treatments`.
- [x] `PUT /treatments/:id`.
- [x] `DELETE /treatments/:id`.
- [x] **Insumos del tratamiento (`consumption`):** se guardan en `POST`/`PUT` (tabla `treatment_consumptions`) y se devuelven en todas las lecturas. `400` por línea (`errors["consumption[1].itemId"]`) si un insumo no existe o está repetido. Si el body no trae `consumption`, se toma como lista vacía.
- [ ] **`DELETE /treatments/:id` de un tratamiento ya usado:** responder `409` si tiene tratamientos realizados (asignaciones) y sugerir desactivarlo.
- [ ] `GET /treatments/:id/assignments`.
- [ ] `GET /treatment-assignments?patientId=` — asignaciones de un paciente, de la más reciente a la más antigua. Lo usa la pestaña "Tratamientos" de la historia clínica para mostrar el progreso de las asignaciones antiguas con varias sesiones.
- [ ] `POST /treatment-assignments` (body: `treatmentId`, `patientId`, `date`, `tooth`, `sourceEncounterId`, `sourceKey`, `price`) — registra un tratamiento **realizado** en una atención: crea la asignación ya `completado` con 1 de 1 sesión y descuenta stock de inventario por cada línea de `Treatment.consumption` (ver `inventory.registerConsumption`). **Idempotente por `sourceKey`** (atención + tratamiento de esa atención): si ya existe, devuelve la existente sin descontar de nuevo (el registro de la atención puede reintentarse). `404` si el tratamiento no existe y `400` si está inactivo. No valida deuda del paciente. Reemplaza a `POST /treatment-assignments/:id/advance-session`, que el frontend ya no usa (se quitó "+ Sesión").
- [ ] Persistir `tooth`, `sourceEncounterId` y `sourceKey` (opcionales) en `TreatmentAssignment`, para trazar en qué atención y pieza se realizó cada tratamiento. `GET /treatments/:id/assignments` debe devolverlos: el detalle del catálogo los muestra en "Pacientes que recibieron este tratamiento".
- [ ] **Costo cobrado del tratamiento (`price`):** el doctor puede ajustar el costo en la atención (por ejemplo, un descuento). Persistir `price` en `TreatmentAssignment` (número ≥ 0; si falta, se usa el precio del catálogo, como en las asignaciones anteriores) y devolverlo en `GET /treatments/:id/assignments` y `GET /treatment-assignments?patientId=`. La cartera de Finanzas (`totalValue`, `pendingBalance`, `patientResponsibility`) y el ingreso estimado de reportes deben calcularse con `price`, no con el precio del catálogo. Hoy el mock de Finanzas resume por tratamiento + paciente y toma el costo de la asignación más reciente; con backend, la cartera debería calcularse por asignación (se revisará junto con pagos y abonos, ítem 8).

## `inventory`

Implementado en `back/src/ClinicApp.Api/Modules/Inventory/`. Roles: los tres pueden leer `GET /inventory/items` y `GET /inventory/items/:id` (los formularios de tratamientos, que usa el médico, cargan la lista); el resto es solo para `admin` y `recepcion`. Cada entrada y salida pasa por `StockService`, que bloquea la fila del insumo (`SELECT … FOR UPDATE`) dentro de una transacción y mantiene `stock = Σ lotes`: dos salidas simultáneas no pueden dejar el stock negativo. Movimientos, órdenes y ciclos guardan el usuario que los registró (`created_by_user_id`, no se expone).

- [x] `GET /inventory/items` — paginado, ordenado por nombre; `search` busca en nombre, categoría y proveedor.
- [x] `GET /inventory/items/:id`.
- [x] `POST /inventory/items` — incluye `kind: "consumible" | "instrumental"`; nace con `stock = 0`.
- [x] `PUT /inventory/items/:id` — no toca el stock.
- [x] `DELETE /inventory/items/:id` — `409` si el insumo tiene movimientos o lotes, o aparece en una orden de compra, un ciclo de esterilización o un tratamiento.
- [x] `GET /inventory/items/:id/movements` — del más reciente al más antiguo.
- [x] `POST /inventory/items/:id/movements` — una entrada crea un lote nuevo (con `expirationDate` opcional, `"YYYY-MM-DD"` o vacío); una salida descuenta por FEFO y, si abarca varios lotes, crea un movimiento por lote y devuelve el primero. Salida mayor al stock: `400` "Stock insuficiente. Disponible: N" con `errors.quantity`.
- [x] `GET /inventory/items/:id/lots` — en orden FEFO (los que no vencen, al final).
- [x] **Consumo por lote (FEFO)** — `StockService.ConsumeAsync`: lotes por vencimiento ascendente, sin vencimiento al final y, entre iguales, el más antiguo. Es tolerante (si el stock no alcanza descuenta lo disponible y deja un aviso en el log); la salida manual valida antes. Lo usará `POST /treatment-assignments`.
- [x] `GET /inventory/suppliers` — ordenados por nombre.
- [x] `POST /inventory/suppliers` — solo el nombre es obligatorio; correo válido o vacío. Los campos vacíos se guardan como `null`.
- [x] `PUT /inventory/suppliers/:id`.
- [x] `DELETE /inventory/suppliers/:id` — `409` si el proveedor tiene órdenes de compra.
- [x] `GET /inventory/purchase-orders` — de la más reciente a la más antigua, con sus líneas en el orden en que se crearon.
- [x] `POST /inventory/purchase-orders` — crea con estado `pendiente`. `400` si el proveedor o un insumo no existen (`errors.supplierId`, `errors["lines[0].itemId"]`).
- [x] `POST /inventory/purchase-orders/:id/receive` — en una sola transacción, por cada línea un lote y un movimiento de entrada (`reason` "Recepción de orden de compra #<id>"); la orden pasa a `recibida` con `receivedAt`. La orden se bloquea: dos recepciones simultáneas no duplican el stock. `409` si no está `pendiente` (el mock usa `400`; el mensaje es el mismo).
- [x] `POST /inventory/purchase-orders/:id/cancel` — `409` si no está `pendiente`.
- [x] `GET /inventory/sterilization-cycles` — por fecha, del más reciente al más antiguo.
- [x] `POST /inventory/sterilization-cycles` — `itemIds` solo de insumos `instrumental` (`400` si alguno no existe o es consumible; los repetidos se unen). `performedAt` en `"YYYY-MM-DD"`, no futura según el día de la clínica (`ClinicClock`, `Clinic:TimeZone`).
- [x] **Llaves foráneas:** `sterilization_cycles.responsible_professional_id` → `professionals` (se valida que exista y esté activo; la migración pasó los ciclos con responsables inexistentes a un profesional inactivo "Responsable no registrado") y `stock_movements.patient_id` → `patients`.
- [ ] `stock_movements.treatment_assignment_id` → `treatment_assignments` (con los tratamientos realizados).
- [ ] **Desactivar insumos:** un insumo con historia no se puede borrar (`409`) y el frontend no tiene opción de desactivarlo. Agregar `active` al insumo y al formulario si la clínica lo necesita.
- [ ] **Más de 100 insumos:** "Stock crítico", el formulario de órdenes de compra, el de esterilización y los de tratamientos piden `GET /inventory/items?pageSize=100`, el máximo de la API. Con más insumos faltarían en esas pantallas: agregar un filtro (`?critical=true`, `?kind=instrumental`) o una lista sin paginar para los selectores.

## `reports`

Todos restringidos al rol `admin`. Query `from`/`to` en `YYYY-MM-DD`, **inclusivos**, en la zona horaria de la clínica. La agregación debe hacerse en SQL del lado del servidor (el frontend hoy la simula en memoria); las formas de respuesta están en `front/src/modules/reports/types/report.types.ts`.

- [ ] **Conflicto de rol con el Inicio:** la página de Inicio (`app/pages/dashboard-page.tsx`) la ven los tres roles y llama a `GET /reports/summary` y `GET /reports/agenda` del mes en curso. Si estos endpoints quedan solo para `admin`, recepción y médico recibirán `403` en el Inicio. Opciones: permitir esos dos endpoints a todos los roles, o crear `GET /dashboard/summary` con los indicadores del Inicio (y que el frontend lo use).

- [ ] `GET /reports/summary` — `patientsTotal`, `activeTreatments` (asignaciones `en_progreso`) y `criticalStockItems` (`stock <= minStock`) son puntuales, ignoran el periodo. `patientsNewInPeriod` filtra `patients.createdAt`; `appointmentsInPeriod/Completed/NoShow` filtran `appointments.start`; `notificationsSent` filtra `sentAt` con `status = enviada`. `noShowRate = noShow / (completadas + noShow)` (0 si el denominador es 0).
- [ ] `GET /reports/agenda` — `byDay` con todos los días del periodo (relleno en cero) y conteos por estado; `byStatus` con los 5 estados; `occupancyByRoom` con minutos reservados (citas no canceladas) y bloqueados por consultorio, más una fila "Sin consultorio" si hay citas sin `roomId`.
- [ ] `GET /reports/productivity` — por profesional: programadas, completadas, no asistió, canceladas, `completionRate = completadas / max(1, programadas − canceladas)`. No incluir sesiones de tratamiento por profesional hasta que `treatment-assignments` registre `professionalId`.
- [ ] `GET /reports/treatments` — por tratamiento: citas del periodo (`appointments.treatmentId`), asignaciones activas/completadas y sesiones (filtrando `assignments.startDate`), `estimatedRevenue` = suma de `price` (costo cobrado; precio del catálogo si falta) de las asignaciones completadas — **provisional**, reemplazar por ingresos reales cuando exista facturación (ítem 8).
- [ ] `GET /reports/inventory` — `criticalItems` puntual; `purchasesInPeriod` filtra `purchase_orders.createdAt` con `total = Σ qty × unitCost` y `purchasesTotal` excluyendo canceladas; `consumptionInPeriod` = movimientos `salida` del periodo agrupados por insumo.

## `notifications`

- [ ] `GET /notifications` (query: `page`, `pageSize`, `search` — nombre o identificación del paciente, requiere JOIN con `patients` —, `dateFrom`, `dateTo`) — reporte de notificaciones enviadas.
- [ ] `GET /notifications?appointmentId=:id` — notificaciones asociadas a una cita puntual (usado para mostrar "cliente notificado" en el detalle de la cita).
- [ ] `GET /notifications/template` — plantilla predeterminada de notificación (mensaje con variables sin reemplazar, ej. `[nombre del cliente]`, `[fecha de la cita]`, `[hora de la cita]`, `[profesional]`, `[nombre de la clínica]`; ver `notification.types.ts` para la lista completa de tokens).
- [ ] `PUT /notifications/template` — actualiza el mensaje (body: `{ message: string }`).
- [ ] **Disparo automático de notificaciones** — el backend debe generar un `NotificationLog` (tipo `confirmacion_cita`) al crear una cita y uno (tipo `cancelacion_cita`) al cancelarla, reemplazando las variables de la plantilla con los datos reales, **solo si** `patient.notificationsEnabled` es `true`. En el frontend esto hoy está simulado en el propio mock (`notificationsApi.logAppointmentEvent`); no expone ni debe exponer un endpoint propio — es un efecto secundario de `POST /appointments` y `PATCH /appointments/:id/status`, no una llamada aparte del frontend.
- [ ] **Recordatorios (`recordatorio_cita`)** — requieren un scheduler/cron real (disparo por tiempo antes de la cita, no por una acción de usuario). No hay forma de simular esto desde el frontend; queda enteramente del lado del backend/infraestructura.
- [ ] Definir el canal real de envío (hoy el modelo soporta `email`/`sms` pero no hay integración con ningún proveedor).

## `finance`

Cartera y resúmenes financieros por tratamiento y por paciente. **El frontend no tiene funciones `*Real` ni `TODO` en este módulo:** `finance.api.ts` llama directamente a los cálculos del mock (`finance.mock-data.ts`). Los endpoints de abajo son una propuesta; al implementarlos hay que agregar el par Mock/Real en `finance.api.ts`. Las formas de respuesta están en `front/src/modules/finance/types/finance.types.ts`.

- [ ] `GET /finance/portfolio` — cartera activa (`FinancialPortfolioRow[]`): una fila por paciente + tratamiento con `total`, `paid`, `pending`, `overdue`, `nextDueDate`, `daysLate` y `status` (`al_dia | parcial | vencida`). Pantalla "Finanzas" (`/finanzas`).
- [ ] `GET /finance/treatments/:treatmentId/summary?patientId=` — `FinancialSummary` de un tratamiento (opcionalmente de un paciente): valor total, pagado, saldo pendiente y vencido, cobertura del seguro, responsabilidad del paciente, próximo vencimiento, pagos, cuotas, seguro y factura. Lo usa el detalle del tratamiento.
- [ ] `GET /finance/patients/:patientId/summary` — `PatientFinancialSummary` (tratamientos, total pagado, pendiente, vencido, próximo vencimiento, cantidad de pagos). Lo usa la ficha del paciente.
- [ ] Calcular los montos con el costo cobrado de cada asignación (`price`; ver `treatments`), no con el precio del catálogo.
- [ ] **Rol del médico (decidido):** el médico **no** ve montos. Los resúmenes financieros responden `403` para `medico`, y el frontend debe ocultar esos bloques en la ficha del paciente y en el detalle del tratamiento para ese rol (cambio pendiente).
- [ ] **Pagos (decidido, etapa A):** tabla `financial_payments` y endpoints para registrar y anular pagos de los pacientes (`POST /finance/payments`, `POST /finance/payments/:id/void`), para que la cartera descuente lo pagado. Ver `docs/plan-finanzas.md`. **Cuotas, seguros y facturación electrónica (SRI)** (ítem 8): el modelo existe en el frontend (`Installment`, `InsuranceCoverage`, `Invoice`), pero sus endpoints esperan el diseño del ítem 8. El cobro a las clínicas por usar ClinicApp es otra cosa y no se crea por ahora.

## `institution`

Perfil de la institución (`/perfil-institucion`). **El frontend no tiene archivo `institution.api.ts`:** lee y guarda el perfil en `localStorage` (`institution.types.ts` → `readInstitutionProfile` / `writeInstitutionProfile`). Los endpoints de abajo son una propuesta; al implementarlos hay que crear el par Mock/Real.

- [ ] `GET /institution/profile` — `InstitutionProfile` (`name`, `legalName`, `ruc`, `phone`, `email`, `address`, `website`, `logoText`, `logoImage`, `notes`, `hours`, `branches[]` con `id`, `name`, `address`, `phone`, `hours`, `isMain`). **Debe ser público (sin token) o tener una variante pública** con nombre y logo: la pantalla de inicio de sesión muestra el logo de la institución (`auth-layout.tsx`).
- [ ] `PUT /institution/profile` — solo `admin`. Validar el RUC (13 dígitos) y que haya como máximo una sede principal (`isMain`).
- [ ] **Logo:** hoy `logoImage` es una imagen en base64 dentro del perfil. Definir si se sube como archivo aparte (por ejemplo, `POST /institution/logo`) con límite de tamaño y formato.
- [ ] **Sedes:** el backlog de producto (ítem 2) tiene pendiente definir si el grupo maneja una o varias sedes. Si son varias, las citas, consultorios y profesionales podrían tener que vincularse a una sede; es un cambio de modelo, no solo de endpoint.

---

## Notas

- Este archivo es un desglose técnico del contrato ya definido en [`../documentacion/arquitectura-frontend.md`](../documentacion/arquitectura-frontend.md) — si cambia el contrato del lado frontend, actualizar ambos documentos.
- La priorización y el responsable de cada funcionalidad (a nivel de producto) están en [`../documentacion/backlog.md`](../documentacion/backlog.md); este archivo es solo el detalle de implementación del lado del backend.
