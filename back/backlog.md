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
- [x] **Pedidos del frontend (2026-11-20):** `documentType` (con validación de la cédula), teléfono opcional, filtros `status`, `gender`, `registeredFrom`, `registeredTo` y `deleted=true` (solo admin) en `GET /patients`.
- [ ] **Importar los 820 pacientes** del archivo de la clínica: comando de una sola vez, que conserve las fichas como N.° de historia y siga la secuencia desde la última. Necesita las respuestas de `documentacion/decisiones-backend.md` § 5. El archivo real nunca se sube al repositorio.
- [ ] **Frontend:** ocultar el botón "Eliminar" al médico (la API le responde `403`); una pantalla o filtro para ver y reactivar a los dados de baja; agregar `deletedAt` al tipo `Patient`.
- [ ] **Última visita automática:** hoy `lastVisitAt` se edita a mano; calcularla desde las atenciones de la historia clínica.

## `appointments`

Implementado en `back/src/ClinicApp.Api/Modules/Appointments/`. Roles: los tres (los catálogos se editan solo con `admin`). Detalle en [`docs/endpoints-api.md`](./docs/endpoints-api.md).

- [x] `GET /appointments` — acepta `from`/`to` (fechas de la clínica, inclusivas), `patientId` y `professionalId`. Sin rango devuelve todas.
- [x] `GET /appointments?patientId=` — de la más reciente a la más antigua.
- [x] `GET /appointments/:id`.
- [x] `POST /appointments` — el frontend envía `date` + `startTime` + `endTime` en hora de la clínica y la API los convierte a UTC. Valida disponibilidad de profesional y consultorio (`409` con `errors.startTime` y los 4 mensajes del mock), con un candado por profesional y consultorio para que dos agendados simultáneos no pasen los dos. Paciente activo; profesional, consultorio y tratamiento existentes y activos.
- [x] `PUT /appointments/:id` — misma validación, excluyendo la propia cita. Solo citas `programada` o `confirmada` (`409` si no).
- [x] `PATCH /appointments/:id/status` — cambios permitidos: `programada → confirmada`; `programada`/`confirmada` → `completada`, `no_asistio` o `cancelada` (`409` en los demás). Crear y cancelar llaman a `IAppointmentEvents`, que implementará `notifications`.
- [x] `GET /professionals` — catálogo de profesionales (`id, name, specialty, registrationNumber`, más `active` y `userId`). Devuelve también los inactivos. `registrationNumber` es el registro profesional de la declaración de veracidad de la historia clínica. `POST`/`PUT /professionals` (solo `admin`) crean, editan, desactivan y vinculan el usuario; `PUT` devuelve `futureAppointments`.
- [ ] **Frontend:** pantalla para administrar profesionales y consultorios, y mostrar solo los activos en los selectores (la API devuelve también los inactivos, con `active: false`).
- [x] `GET /rooms` — catálogo de consultorios (`id, name`, más `active`). `POST`/`PUT /rooms` solo para `admin`; nombre único entre los activos. Si se definen varias sedes, los consultorios podrían vincularse a una.
- [x] `GET /schedule-blocks` — con `from`/`to` opcionales.
- [x] `POST /schedule-blocks` — `409` si se solapa con una cita no cancelada del mismo profesional o consultorio; los bloqueos sí pueden superponerse entre sí.
- [x] `DELETE /schedule-blocks/:id`.
- [x] `DELETE /treatments/:id` responde `409` si el tratamiento aparece en una cita.
- [x] Registrar una atención clínica vinculada a una cita la pasa a `completada`: lo hace `POST …/encounters/register` (si la cita estaba programada o confirmada; si no, avisa en `warnings`).
- [ ] **Frontend:** enviar `from`/`to` con el rango visible del calendario (hoy pide todas) y dejar de convertir la hora a UTC en el navegador: el mock lo hacía con la hora del equipo, que falla si el navegador está en otra zona.
- [ ] Bloqueos son puntuales únicamente (sin recurrencia) — si el negocio pide recurrencia (ej. "todos los lunes de 13:00 a 14:00"), es un cambio de modelo, no solo de endpoint.

## `clinical-history`

Implementado en `back/src/ClinicApp.Api/Modules/ClinicalHistory/`. Historia clínica odontológica única por paciente: un **registro editable** (`ClinicalRecord`, con 10 secciones en columnas `jsonb`), un historial de **atenciones inmutables** (`ClinicalEncounter`) con notas aclaratorias, **versiones** de cada guardado y **adjuntos** en disco. Solo `admin` y `medico` (`403` para `recepcion`). Contrato en `front/src/modules/clinical-history/types/`; detalle en [`docs/endpoints-api.md`](./docs/endpoints-api.md).

- [x] **Roles:** solo `admin` y `medico` en los 7 endpoints.
- [x] `GET /clinical-history/encounters` (query: `page`, `pageSize`, `search`, `patientId`, `professionalId`): de la más reciente a la más antigua. `search` busca sin tildes en el motivo, los diagnósticos y el nombre o la cédula del paciente.
- [x] `GET /clinical-history/patients/:patientId` → `{ record, encounters, references }`. Sin historia, devuelve una vacía (`revision: 0`, consentimiento `pendiente`) sin guardarla. `references` trae el nombre de los tratamientos y profesionales que la historia nombra, aunque estén inactivos: es lo que debe usar la impresión. `404` si el paciente no existe.
- [x] `PUT /clinical-history/patients/:patientId` → guarda el `ClinicalRecord` completo con concurrencia optimista (`409` "Otra pestaña o usuario modificó esta historia…" si la revisión no coincide; dos guardados simultáneos: uno gana). Valida cada sección como los esquemas Zod y las referencias: tratamientos del plan en el catálogo, profesional de la declaración, adjuntos del paciente, atención de cada examen solicitado. **Antes de sobrescribir copia la versión anterior** en `clinical_record_versions`. `409` si el paciente está dado de baja.
- [x] `POST /clinical-history/patients/:patientId/encounters` → atención inmutable. Idempotente por `id` (reintento: `200` con la guardada; mismo `id` en otro paciente: `409`). Una cita tiene como máximo una atención (`409` con `errors.appointmentId`). Profesional existente y activo, cita del mismo paciente. Las estructuras del examen extraoral e intraoral que no vienen quedan `no_evaluado`.
- [x] `POST /clinical-history/encounters/:encounterId/notes` (body: `{ text }`, mínimo 10): el autor (nombre de "Mi perfil" o del usuario) y la fecha los pone el servidor.
- [x] `POST /clinical-history/attachments` (multipart: `file`, `kind`, `patientId`): JPG, PNG, WebP o PDF de hasta 20 MB, reconocidos **por los primeros bytes** (un `.txt` renombrado a `.png` da `400`). Se guarda en `{Attachments:RootPath}/{patientId}/{id}.{ext}` con nombre generado por el servidor; el nombre del usuario queda como alias (`name`).
- [x] `GET /clinical-history/attachments/:attachmentId/file`: el archivo con el alias como nombre de descarga. También si se quitó de la historia (las versiones lo nombran). `410` si el protocolo de conservación lo borró.
- [x] **Conservación de adjuntos:** lo guardado en una historia no se borra nunca; quitarlo solo lo marca (`removed_at`). Los subidos y nunca guardados se borran a las 24 h (`Attachments:OrphanHours`). Protocolo de limpieza preparado y **apagado** (`Attachments:Retention:RemovedDays` vacío, `DryRun: true`).
- [x] **Referencias en vez de copias:** el plan y los tratamientos realizados guardan solo el `treatmentId`; `description` se conserva solo en los ítems antiguos de texto libre. `DELETE /treatments/:id` responde `409` si el tratamiento está en un plan o una atención.
- [x] **Registro transaccional de la atención:** `POST /clinical-history/patients/:patientId/encounters/register` hace en una transacción los tratamientos realizados (con insumos y el profesional de la atención), la atención, la historia (propuestos usados y exámenes pendientes) y la cita completada. Reutiliza lo registrado por un intento anterior por pasos (`sourceKey`). Las respuestas a A1–A8 pueden cambiar sus reglas (por ejemplo, tratamientos de varias sesiones o cortesías).
- [ ] **FK `treatment_assignments.source_encounter_id` → `clinical_encounters`:** se agrega cuando el frontend use `…/encounters/register` y se retire el registro por pasos (hoy el tratamiento realizado se crea antes que la atención, en otra petición).
- [x] **Archivo clínico digital:** metadatos por adjunto (nombre visible, tipo clínico, fecha de estudio, categoría, etiquetas, vínculos), archivado, auditoría, catálogo de categorías y etiquetas, y duplicados por SHA-256. 9 endpoints en `docs/endpoints-api.md` § 10.
- [ ] **Qué es una atención (preguntas para la clínica):**
  - A1: ¿cuenta como atención una llamada, la revisión de un resultado o la respuesta de una interconsulta?
  - A2: ¿el diagnóstico es siempre obligatorio (controles, retiro de puntos)?
  - A3: ¿cómo se registra un tratamiento de varias sesiones?
  - A4: ¿una cita puede originar más de una atención?
  - A5: ¿se permite corregir una atención por un tiempo o solo con notas?
  - A6: ¿quién firma: el profesional de la sesión o puede registrar la asistente?
  - A7: ¿hacen falta borradores?
  - A8: ¿siempre se completa la cita, se descuentan insumos y se genera deuda (tratamientos cortesía)?
- [ ] **Frontend:**
  - convertir `[0]` en `.0` en `toFieldErrors`: la API nombra los errores de listas como `plan[0].tooth`;
  - usar `references` al mostrar e imprimir (`treatmentName` en `record-workspace.tsx`) y dejar de enviar `description` en los ítems del catálogo;
  - usar `user.professionalId` como profesional por defecto en lugar de comparar nombres.
- [ ] **Última visita del paciente:** actualizar `patients.last_visit_at` al registrar una atención (hoy se edita a mano).
- [ ] **Texto legal del consentimiento de datos:** hoy el frontend muestra un texto provisional (`dataConsentText`). Definir con la clínica el texto definitivo y si debe versionarse (guardar qué versión aceptó cada paciente).
- [ ] **Firmas** del paciente y del profesional (declaración, evolución, periodontograma).
- [ ] **Antivirus de adjuntos** (por ejemplo, ClamAV) antes de guardar el archivo.
- [ ] **Versiones:** una pantalla "Versiones anteriores" si la clínica la necesita. Hoy se consultan con SQL: `SELECT revision, saved_at, data FROM clinical_record_versions WHERE patient_id = '…' ORDER BY revision`.
- [ ] **Migración de datos locales:** las historias registradas en modo mock viven en el navegador de cada equipo. Definir si se importan al backend a partir del export "Historia completa JSON" de cada paciente (ya trae `{ record, encounters }`).

## `treatments`

- [x] `GET /treatments` (paginado, búsqueda por nombre o categoría).
- [x] `GET /treatments?active=true`.
- [x] `GET /treatments/:id`.
- [x] `POST /treatments`.
- [x] `PUT /treatments/:id`.
- [x] `DELETE /treatments/:id`.
- [x] **Insumos del tratamiento (`consumption`):** se guardan en `POST`/`PUT` (tabla `treatment_consumptions`) y se devuelven en todas las lecturas. `400` por línea (`errors["consumption[1].itemId"]`) si un insumo no existe o está repetido. Si el body no trae `consumption`, se toma como lista vacía.
- [x] **`DELETE /treatments/:id` de un tratamiento ya usado:** `409` "Este tratamiento ya se usó. Desactívalo en su lugar." si aparece en una cita o en un tratamiento realizado.
- [x] `GET /treatments/:id/assignments`.
- [x] `GET /treatment-assignments?patientId=` — asignaciones de un paciente, de la más reciente a la más antigua. Lo usa la pestaña "Tratamientos" de la historia clínica para mostrar el progreso de las asignaciones antiguas con varias sesiones.
- [x] `POST /treatment-assignments` (solo `admin` y `medico`) (body: `treatmentId`, `patientId`, `date`, `tooth`, `sourceEncounterId`, `sourceKey`, `price`) — registra un tratamiento **realizado** en una atención: crea la asignación ya `completado` con 1 de 1 sesión y descuenta stock de inventario por cada línea de `Treatment.consumption` (ver `inventory.registerConsumption`). **Idempotente por `sourceKey`** (atención + tratamiento de esa atención): si ya existe, devuelve la existente sin descontar de nuevo (el registro de la atención puede reintentarse). `404` si el tratamiento no existe y `400` si está inactivo. No valida deuda del paciente. Reemplaza a `POST /treatment-assignments/:id/advance-session`, que el frontend ya no usa (se quitó "+ Sesión").
- [x] Persistir `tooth`, `sourceEncounterId` y `sourceKey` (opcionales) en `TreatmentAssignment`, para trazar en qué atención y pieza se realizó cada tratamiento. `GET /treatments/:id/assignments` debe devolverlos: el detalle del catálogo los muestra en "Pacientes que recibieron este tratamiento".
- [x] **Costo cobrado del tratamiento (`price`):** se guarda en `treatment_assignments.price` (precio del catálogo si no viene). El doctor puede ajustar el costo en la atención (por ejemplo, un descuento). Persistir `price` en `TreatmentAssignment` (número ≥ 0; si falta, se usa el precio del catálogo, como en las asignaciones anteriores) y devolverlo en `GET /treatments/:id/assignments` y `GET /treatment-assignments?patientId=`. La cartera de Finanzas (`totalValue`, `pendingBalance`, `patientResponsibility`) y el ingreso estimado de reportes deben calcularse con `price`, no con el precio del catálogo. Hoy el mock de Finanzas resume por tratamiento + paciente y toma el costo de la asignación más reciente; con backend, la cartera debería calcularse por asignación (se revisará junto con pagos y abonos, ítem 8).
- [x] `treatment_assignments.professional_id`: lo llena `POST …/encounters/register` con el profesional de la atención.
- [ ] FK `treatment_assignments.source_encounter_id` → `clinical_encounters`: ver § `clinical-history`.

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
- [x] `stock_movements.treatment_assignment_id` → `treatment_assignments`.
- [ ] **Desactivar insumos:** un insumo con historia no se puede borrar (`409`) y el frontend no tiene opción de desactivarlo. Agregar `active` al insumo y al formulario si la clínica lo necesita.
- [ ] **Más de 100 insumos:** "Stock crítico", el formulario de órdenes de compra, el de esterilización y los de tratamientos piden `GET /inventory/items?pageSize=100`, el máximo de la API. Con más insumos faltarían en esas pantallas: agregar un filtro (`?critical=true`, `?kind=instrumental`) o una lista sin paginar para los selectores.

## `reports`

Implementado en `back/src/ClinicApp.Api/Modules/Reports/`. Query `from`/`to` en `YYYY-MM-DD`, **obligatorios e inclusivos**, en la zona horaria de la clínica (máximo 366 días). La agregación se hace en SQL (`GROUP BY`, `COUNT`, `SUM`); las formas de respuesta son las de `front/src/modules/reports/types/report.types.ts`. Detalle y fórmulas en [`docs/endpoints-api.md`](./docs/endpoints-api.md).

- [x] **Conflicto de rol con el Inicio (decidido):** `GET /reports/summary` y `GET /reports/agenda` quedan abiertos a los tres roles (no muestran dinero), así el Inicio funciona sin cambios. Los otros tres, solo `admin`.
- [x] `GET /reports/summary`.
- [x] `GET /reports/agenda` — `byDay` agrupa por el día de la clínica (no por el día UTC) y rellena con ceros; `occupancyByRoom` con minutos reservados y bloqueados recortados al periodo, más "Sin consultorio".
- [x] `GET /reports/productivity`.
- [x] `GET /reports/treatments` — `estimatedRevenue` con el costo cobrado; **provisional** hasta que exista facturación.
- [x] `GET /reports/inventory`.
- [ ] **Sesiones por profesional** en productividad: los tratamientos realizados ya guardan `professional_id` cuando se registran con `…/encounters/register`; falta sumarlo al reporte.
- [ ] **Ingresos reales** (pagos o facturas) en lugar del ingreso estimado, cuando exista la facturación (finanzas, etapa B).
- [ ] **Medir el rendimiento** con volumen real (miles de citas). Los filtros por fecha ya tienen índice (`appointments.start`, `patients.created_at`, `notification_logs.sent_at`, `stock_movements (type, created_at)`).

## `notifications`

Implementado en `back/src/ClinicApp.Api/Modules/Notifications/`. Detalle en [`docs/endpoints-api.md`](./docs/endpoints-api.md).

- [x] `GET /notifications` (query: `page`, `pageSize`, `search` — nombre o cédula del paciente —, `dateFrom`, `dateTo`) — reporte paginado, solo `admin` y `recepcion`. Fechas inclusivas en hora de la clínica.
- [x] `GET /notifications?appointmentId=:id` — notificaciones de una cita, sin paginar. **Abierto a los tres roles**, porque el detalle de la cita lo ven todos.
- [x] `GET /notifications/template` y `PUT /notifications/template` (body: `{ message }`, 10 a 1000) — `admin` y `recepcion`. La migración crea la plantilla predeterminada del mock.
- [x] **Disparo automático:** crear una cita guarda una `confirmacion_cita` pendiente y cancelarla, una `cancelacion_cita` (se descarta la confirmación si no salió). Es un efecto de `POST /appointments` y `PATCH /appointments/:id/status`, en la misma transacción (`IAppointmentEvents` → `AppointmentNotifications`), solo si `patient.notificationsEnabled`. El mensaje se arma con la plantilla y la hora de la clínica.
- [x] **Recordatorios (`recordatorio_cita`):** `NotificationDispatcher` (tarea en segundo plano) crea uno por cita programada o confirmada que empieza en las próximas 24 h, y envía las pendientes cada 10 s con hasta 3 intentos.
- [x] `GET /api/alerts` (citas y cumpleaños de hoy; stock crítico y envíos fallidos para admin y recepción) y `patientName` y `message` en el historial.
- [ ] **Canal y proveedor de envío:** por definir con la clínica (solo el 4 % de los pacientes tiene correo y el 92 % tiene celular: SMS o WhatsApp). Al elegirlo, implementar `INotificationSender` y su valor en `Notifications:Provider`. **Hasta entonces, en producción no se registran notificaciones.**
- [ ] **Frontend:** el editor de la plantilla debería avisar que un SMS admite 160 caracteres.

## `finance`

Implementado (etapa A) en `back/src/ClinicApp.Api/Modules/Finance/`. Solo `admin` y `recepcion`. Detalle en [`docs/endpoints-api.md`](./docs/endpoints-api.md).

- [x] `GET /finance/portfolio` — cartera (`FinancialPortfolioRow[]`): una fila por paciente + tratamiento, sumando el costo cobrado de **todas** sus asignaciones (el mock tomaba solo la más reciente) menos los pagos registrados. Incluye las que están al día, de la mayor deuda a la menor.
- [x] `GET /finance/treatments/:treatmentId/summary?patientId=` — `FinancialSummary` con los pagos. Sin `patientId`, si lo recibió un solo paciente se usa ese; si fueron varios, `400`.
- [x] `GET /finance/patients/:patientId/summary` — `PatientFinancialSummary`.
- [x] Los montos se calculan con el costo cobrado de cada asignación (`price`), no con el precio del catálogo (salvo en las antiguas sin `price`).
- [x] **Rol del médico (decidido):** el médico **no** ve montos: los endpoints de finanzas le responden `403`.
- [x] **Pagos (decidido, etapa A):** tabla `financial_payments`, `POST /finance/payments` (el paciente debe tener el tratamiento realizado; `409` si supera el saldo, con candado para pagos simultáneos) y `POST /finance/payments/:id/void` (anular con motivo; nunca se borra).
- [ ] **Frontend:**
  - crear el par Mock/Real en `finance.api.ts` (hoy llama directo al mock);
  - una pantalla para registrar y anular pagos;
  - ocultar al médico los resúmenes financieros de la ficha del paciente y del detalle del tratamiento.
- [ ] **Etapa B — cuotas, seguros y facturación electrónica del SRI (ítem 8 del backlog de producto):** el modelo existe en el frontend (`Installment`, `InsuranceCoverage`, `Invoice` con clave de acceso, XML y RIDE), pero sus endpoints esperan el diseño del ítem 8. Con las cuotas se calcularán el saldo vencido, el próximo vencimiento y los días de atraso (hoy 0 y `null`).
- [ ] **Cobro a las clínicas por usar ClinicApp** (suscripción): distinto de estos pagos; no se crea por ahora (ver `docs/plan-multiclinica.md`).

## `institution`

Implementado en `back/src/ClinicApp.Api/Modules/Institution/`. Perfil de la institución (`/perfil-institucion`) en la tabla `institutions` (una fila) y sus sedes en `institution_branches`. Detalle en [`docs/endpoints-api.md`](./docs/endpoints-api.md).

- [x] `GET /institution/profile` (los tres roles) — `InstitutionProfile` completo, con sus sedes en orden.
- [x] `GET /institution/public` (**sin sesión**) — `{ name, logoText, logoImage }` para la pantalla de inicio de sesión.
- [x] `PUT /institution/profile` — solo `admin`. Reemplaza el perfil completo y sincroniza las sedes por `id`. Valida el RUC (13 dígitos o vacío), el correo, el sitio web, el logo (data URL PNG/JPG/WebP de hasta ~500 KB, sin SVG) y como máximo una sede principal.
- [x] **Logo:** se guarda como data URL dentro del perfil (igual que la foto de "Mi perfil"); el contrato del frontend no cambia. Si llega a pesar demasiado, pasar a un archivo aparte (`POST /institution/logo`).
- [x] `subtitle` (hasta 120) en el perfil y en `GET /institution/public` (lo muestran el login y la barra lateral).
- [ ] **Frontend:** crear `institution.api.ts` con el par Mock/Real (hoy el perfil vive en `localStorage`) y que `auth-layout.tsx` lea `GET /institution/public`.
- [ ] **Sedes:** el backlog de producto (ítem 2) tiene pendiente definir si el grupo maneja una o varias sedes. Si son varias, las citas, consultorios y profesionales podrían tener que vincularse a una sede; es un cambio de modelo, no solo de endpoint.

---

## Notas

- Este archivo es un desglose técnico del contrato ya definido en [`../documentacion/arquitectura-frontend.md`](../documentacion/arquitectura-frontend.md) — si cambia el contrato del lado frontend, actualizar ambos documentos.
- La priorización y el responsable de cada funcionalidad (a nivel de producto) están en [`../documentacion/backlog.md`](../documentacion/backlog.md); este archivo es solo el detalle de implementación del lado del backend.
