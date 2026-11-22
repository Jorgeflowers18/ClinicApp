# Desglose del backend por módulo — ClinicApp

Trabajo de la API .NET por módulo y en orden de implementación. El detalle de cada endpoint (contrato, validaciones y casos de error) está en [`backlog.md`](./backlog.md). Este archivo dice **en qué orden** se hace cada módulo y **de qué depende**.

- **Responsable de todo el backend:** **Jorge Flores**. Desde el 2026-11-16 también le corresponden los módulos que antes estaban asignados a Josue Cevallos (`patients`, `appointments`, `institution`, `notifications`, `finance` y `reports`).
- **Criterio de terminado:** el frontend ya está aprobado por la clienta. Cada módulo se da por terminado cuando su pantalla funciona con `VITE_USE_MOCK_API=false` contra la API real.

---

## Resumen

| Orden | Módulo | Estado | Fase | Depende de |
|---|---|---|---|---|
| ✅ | Base del proyecto y `auth` | Hecho (falta conectar el frontend y desplegar) | 0 | — |
| ✅ | `treatments`: catálogo con sus insumos | Hecho | 1 | Base, `inventory` |
| ✅ | `inventory` | Hecho | 1 y 2 | Base |
| ✅ 1 | `patients` | Hecho (falta importar los pacientes de la clínica) | 1 | Base |
| ✅ 2 | `appointments`: profesionales y consultorios | Hecho (falta su pantalla en el frontend) | 1 | Base |
| ✅ 3 | `appointments`: citas y bloqueos | Hecho (falta que el frontend envíe el rango del calendario) | 2 | `patients`, profesionales y consultorios |
| ✅ 4 | `treatments`: tratamientos realizados (`treatment-assignments`) | Hecho | 2 | `patients`, `treatments`, `inventory` |
| ✅ 5 | `clinical-history` | Hecho, con el registro de la atención en una transacción y el archivo clínico | 3 | `patients`, profesionales, citas, tratamientos realizados |
| ✅ 6 | `institution` | Hecho (falta su `institution.api.ts` en el frontend) | 1 | Base |
| ✅ 7 | `notifications` | Hecho (falta elegir el proveedor de envío) | 2 | Citas, `patients` |
| ✅ 8 | `finance` | Etapa A hecha (pagos, cartera y resúmenes); la etapa B espera el ítem 8 | 4 | Tratamientos realizados, `patients` |
| ✅ 9 | `reports` | Hecho | 4 | Todos los anteriores |

## Pendientes al cerrar los planes (2026-11-17)

Los 9 planes están implementados, más lo que pidió el frontend el 2026-11-20 (91 endpoints, 258 pruebas: [`docs/pruebas.md`](./docs/pruebas.md)). Lo que queda, en orden de importancia. El detalle de cada punto está en la sección del módulo en [`backlog.md`](./backlog.md).

**1. Decisiones de la clínica:**
- **Canal y proveedor de notificaciones** (SMS o WhatsApp). Hasta elegirlo, en producción no se envía ni se registra nada.
- **Qué es una atención:** las preguntas A1 a A8 de `backlog.md` § `clinical-history`. El registro en una transacción ya existe con las reglas actuales; las respuestas pueden cambiarlas (varias sesiones, cortesías, borradores).
- **Teléfono del paciente:** la API lo dejó opcional, porque hay pacientes importados sin teléfono. Confirmar con la clínica.
- **Importación de los 820 pacientes:** las preguntas de `documentacion/decisiones-backend.md` § 5 (número de ficha, datos cortados, especialidad, segundo teléfono).
- **Texto legal del consentimiento** y la forma de **firmar** (paciente y profesional).
- **Una o varias sedes** (ítem 2 del backlog de producto).
- **Diseño del ítem 8** (cuotas, seguros y factura electrónica): habilita la etapa B de finanzas.

**2. Backend:**
- FK `treatment_assignments.source_encounter_id` → `clinical_encounters`: **ya se puede agregar**. Con la API, el frontend registra las atenciones solo con `…/encounters/register` (plan 7); el registro por pasos quedó en el mock.
- Comando de importación de pacientes (cuando se respondan las preguntas).
- Proveedor real de notificaciones (`INotificationSender`) y de correo para la recuperación de contraseña (hoy solo se escriben en el log).
- Última visita del paciente calculada desde las atenciones.
- Gestión de usuarios (crear, asignar rol, desactivar) y revisión de las solicitudes de acceso.
- Limpieza de tokens de sesión vencidos.
- Etapa B de finanzas; ingresos reales en el reporte de tratamientos.
- Antivirus de adjuntos.
- Multi-clínica, si se aprueba ([`docs/plan-multiclinica.md`](./docs/plan-multiclinica.md)).
- Sesiones por profesional en el reporte de productividad (los tratamientos realizados ya guardan el profesional al registrarse con `…/encounters/register`).

**3. Frontend, para consumir la API:** los 12 planes de [`front/docs/planes-implementacion/`](../front/docs/planes-implementacion/README.md), en orden. Lo que esos planes pedían al back ya está hecho (subtítulo de la institución, filtros y tipo de documento de pacientes, archivo clínico digital, registro de la atención en una transacción y alertas del día). Incluyen la sesión con refresh, el estándar de recurso de API, los pares Mock/Real que faltan (`institution` y `finance`), las pantallas nuevas (profesionales y consultorios, pagos, pacientes dados de baja) y los ajustes por módulo. El plan 0 está hecho: el frontend compila, el cliente HTTP normaliza los errores, existe el conmutador `VITE_API_MODULES` y los tipos se generan desde OpenAPI. La conversión `[0]` → `.0` ya la hace `shared/lib/field-issues.ts`. Quedó del plan 0:
- **Pruebas unitarias en el front** (Vitest) para `normalizeProblem` y los mapeos: hoy solo hay Playwright. Decidir si se agregan.
- **Del plan 1 (auth), hecho el 2026-11-21:** sesión con refresh y token solo en memoria, renovación ante el `401`, "Mi perfil", recuperar y restablecer contraseña y solicitar acceso, conectados. Quedan del lado del back: el proveedor de correo (el enlace de recuperación solo sale en el log), la pantalla para revisar las solicitudes de acceso y la gestión de usuarios (ya listados arriba).
- **Del plan 2 (institution), hecho el 2026-11-21:** perfil, marca pública y sedes con UUID del servidor, conectados. El logo se recodifica a WebP en el navegador si no es PNG, JPG o WebP (o pesa más de ~500 KB). Pendiente de la clínica: si una sede puede quedar sin nombre (hoy se muestra "Sede N").
- **Del plan 3 (patients), hecho el 2026-11-21:** lista con filtros del back, alta y edición con errores por campo, baja lógica (`deletedAt`) y reactivación, y la vista de dados de baja para el admin. "Dar de baja" está en el menú de la ficha (no en el de la lista). Pendientes: la búsqueda del back no incluye el correo; confirmar con la clínica que el teléfono sea opcional.
- **Del plan 4 (agenda), hecho el 2026-11-21:** citas y bloqueos por rango visible, choques y estados validados por el back, sin registro de notificaciones desde el front, selectores solo con activos y `patientName` en cada cita (back, con prueba). Pendientes: pantallas de administración de profesionales y consultorios (front; el back ya tiene los endpoints) y mostrar la agenda con la zona de la clínica si algún equipo tiene otra zona. Los detalles están en `front/docs/planes-implementacion/12-campos-sin-conectar.md`.
- **Del plan 5 (treatments), hecho el 2026-11-21:** catálogo y tratamientos realizados en la API; borrar uno usado ofrece desactivarlo; límites del back en el esquema. Pendiente del back: `patientName` en `TreatmentAssignmentDto` (el detalle del tratamiento pide cada paciente por separado).
- **Del plan 6 (inventory), hecho el 2026-11-21:** todo inventario en la API, sin FEFO ni cálculo de stock en el front, y `registerConsumption` fuera del contrato. Pendientes del back: desactivar insumos en lugar de borrarlos, y un listado liviano para selectores sin el límite de 100.
- **Del plan 7 (clinical-history), hecho el 2026-11-21:** historia, atención en una transacción, notas, adjuntos y archivo clínico en la API; sin IndexedDB en modo API; `references` al imprimir; profesional por defecto desde `professionalId`; aviso del `410`. Pendiente del back: `patientName` en la lista de atenciones (`EncounterListItemDto`).
- **Del plan 8 (notifications), hecho el 2026-11-22:** plantilla, historial con `patientName` y `message`, y alertas con una sola petición (`GET /alerts`); el front ya no registra notificaciones. Pendientes del back: tipar `GET /notifications` (hoy responde `IActionResult`) y filtros/indicadores en el servidor para no leer todo el historial.
- **Del plan 9 (finance), hecho el 2026-11-22:** cartera, resúmenes, registrar y anular pagos; el médico no ve montos. El detalle del tratamiento suma la cartera de todos sus pacientes. Espera la etapa B (ítem 8): cuotas, seguros y factura; mientras tanto "Total vencido" y "Próximo vencimiento" se muestran en 0 / sin vencimientos.
- **Pruebas E2E que ya fallaban antes de los planes** (no tocan código de los planes): `form-validation.spec.ts` (8) y `messaging-identity.spec.ts` (7), del commit incompleto `3e72a03`; `form-actions.spec.ts` (4), que espera `data-form-actions` en `/perfil-institucion` y en el editor de sedes, que nunca lo tuvieron; `calendar-single-date-today.spec.ts:104` (2), que espera el periodo como "9 noviembre – 15 noviembre 2026" cuando `calendar-period.ts` da "9–15 de noviembre de 2026"; `calendar-views-visual.spec.ts:42` (2), que espera `--event-color: #5350cc`; y en historia clínica `clinical-archive-menu.spec.ts:44`, `clinical-density.spec.ts:152`, `clinical-modal.spec.ts:256` (2 cada una), `dental-history.spec.ts:416` y `diagnoses-modal.spec.ts:13`, que fallan igual en el commit anterior al plan 7 (`f490c99`); y `global-interactions.spec.ts` (6) y `messaging-redesign.spec.ts:124` (intermitente), que fallan igual en ese commit.
- **CORS de las pruebas E2E:** `Cors:AllowedOrigins` de desarrollo solo tiene `http://localhost:5173`; las E2E contra la API real (plan 11) necesitan `http://127.0.0.1:5175`.

**4. Infraestructura:** despliegue en el Droplet (nginx, `systemd`, migraciones y respaldos que **incluyan la carpeta de adjuntos**): `tutorial/fase-0.md` § 5.9.

**Por qué este orden:**
- **`patients` primero.** Casi todo apunta al paciente: citas, tratamientos realizados, historia clínica, finanzas y los movimientos de inventario. Sin esta tabla, esos módulos guardan un `patient_id` sin llave foránea que después hay que migrar.
- **Profesionales y consultorios después.** Son catálogos pequeños, y de ellos dependen las citas, la historia clínica (profesional de la atención y registro profesional), los ciclos de esterilización y el `professionalId` del usuario.
- **Citas y tratamientos realizados antes de la historia clínica.** Así la historia clínica se hace una sola vez y completa:
  - con llaves foráneas reales a pacientes, profesionales y citas;
  - y lista para el registro de la atención en una sola transacción (tratamientos realizados, atención y cita completada), pendiente.
- **`institution` en cualquier momento.** No depende de nada ni nadie depende de él, salvo el logo de la pantalla de inicio de sesión.
- **`notifications`** espera la decisión del proveedor de correo o SMS.
- **`finance` y `reports` al final,** porque calculan sobre los datos de los demás módulos.

**Multi-clínica:** es una propuesta en espera, [`docs/plan-multiclinica.md`](./docs/plan-multiclinica.md). Mientras no se apruebe, los módulos se hacen para una sola clínica.

## Fases

| Fase | Contenido | Resultado |
|---|---|---|
| **0. Base** | Proyecto .NET, base de datos, autenticación, roles, formato de errores, paginación, despliegue | Se puede iniciar sesión contra la API real. Es requisito para todo lo demás. |
| **1. Catálogos** | Pacientes, profesionales y consultorios, perfil de la institución, catálogo de tratamientos, insumos y proveedores | Las pantallas de alta y edición funcionan con la API. |
| **2. Operación** | Citas y bloqueos, notificaciones, tratamientos realizados, movimientos, lotes, órdenes de compra y esterilización | La agenda y el inventario funcionan con la API. |
| **3. Historia clínica** | Historia editable, atenciones, notas, adjuntos y exámenes solicitados | La historia clínica funciona con la API. |
| **4. Finanzas y reportes** | Cartera, resúmenes financieros y reportes | El Inicio, Finanzas y Reportes funcionan con la API. |

## Decisiones técnicas

Tomadas en [`documentacion/decisiones-backend.md`](../documentacion/decisiones-backend.md):
- **API:** .NET 10 (LTS) con ASP.NET Core Web API y controladores, Entity Framework Core con migraciones, un solo proyecto con carpetas por módulo.
- **Base de datos:** PostgreSQL en Docker, con tablas relacionales y columnas `jsonb` para las estructuras anidadas de la historia clínica; identificadores UUID.
- **Despliegue:** API y base de datos en el mismo Droplet de DigitalOcean, detrás de nginx; HTTPS con dominio antes de producción; respaldos diarios.
- **Adjuntos:** disco del Droplet por ahora.
- **Zona horaria:** Ecuador (UTC−5).

Siguen por definir:
- **Envío de correos y SMS o WhatsApp:** proveedor para notificaciones de citas y recuperación de contraseña. Solo el 4 % de los pacientes tiene correo.
- **Importación de la base de pacientes actual** (820 pacientes): ver las preguntas a la clínica en `decisiones-backend.md` § 5.

---

## Base del proyecto y `auth` ✅

- **Responsable:** Jorge Flores
- **Fase:** 0
- **Detalle:** [`backlog.md` § Transversal](./backlog.md#transversal-aplica-a-todos-los-módulos) y [§ `auth`](./backlog.md#auth)

**Alcance:**
- Proyecto .NET (estructura por módulo), base de datos y migraciones, CORS para el frontend.
- Errores `400` como `ValidationProblemDetails`, `409` de conflictos y paginación estándar.
- Autorización por rol en cada endpoint (tabla en `backlog.md` § Transversal).
- Usuarios con rol y `professionalId` opcional; usuarios iniciales por semilla.

**Entidades:** usuario (nombre, correo, contraseña cifrada, rol, profesional vinculado, perfil), token de refresh, token de recuperación de contraseña, solicitud de acceso.

**Endpoints:**
- [x] `POST /auth/login`
- [x] `POST /auth/logout`
- [x] `GET /auth/me`
- [x] `POST /auth/refresh`
- [x] `PUT /auth/me/profile`
- [x] `POST /auth/password-recovery` y `POST /auth/password-reset` (falta el proveedor de correo)
- [x] `POST /auth/access-requests`

**Hecho además:** proyecto, base de datos y migraciones, CORS, errores `400` y `ProblemDetails`, paginación, usuarios iniciales por semilla, límite de intentos por IP, autorización por rol, chequeo de salud y configuración de producción por variables de entorno.

**Pendiente:**
- [ ] Conectar el frontend (`withCredentials`, restaurar la sesión al cargar, renovar ante un `401`, funciones `*Real`, pantalla `/restablecer-contrasena`): lista en [`backlog.md` § `auth`](./backlog.md#auth).
- [ ] `professionalId`: llave foránea cuando exista el catálogo de profesionales (orden 2).
- [ ] Proveedor de correo para la recuperación de contraseña (el mismo de `notifications`).
- [ ] Despliegue en el Droplet (nginx, servicio `systemd`, migraciones y respaldos): `tutorial/fase-0.md` § 5.9.

**Por definir:** pantalla de gestión de usuarios; quién revisa las solicitudes de acceso.

## `inventory` ✅

- **Responsable:** Jorge Flores
- **Fase:** 1 (insumos y proveedores) y 2 (movimientos, lotes, órdenes y esterilización)
- **Detalle:** [`backlog.md` § `inventory`](./backlog.md#inventory)

**Alcance:** insumos consumibles e instrumental, stock por lotes con salida FEFO (primero en vencer, primero en salir), movimientos manuales, proveedores, órdenes de compra y ciclos de esterilización. El consumo automático de un tratamiento realizado nunca falla por falta de stock.

**Entidades:** insumo, movimiento de stock, lote, proveedor, orden de compra (con líneas), ciclo de esterilización.

**Endpoints:** los 18 de [`backlog.md` § `inventory`](./backlog.md#inventory) están hechos (insumos, movimientos, lotes, proveedores, órdenes de compra y ciclos de esterilización).

**Hecho además:** `StockService` (entradas y salidas FEFO con bloqueo de fila), listo para que `POST /treatment-assignments` descuente insumos sin fallar por falta de stock.

**Pendiente:**
- [x] Llaves foráneas del responsable de esterilización a `professionals` y de `patient_id` de los movimientos.
- [x] Llave foránea de `treatment_assignment_id` de los movimientos.
- [ ] Desactivar insumos en lugar de borrarlos (requiere cambio en el frontend).
- [ ] Selectores y "Stock crítico" con más de 100 insumos.

## 1. `patients` ✅

- **Responsable:** Jorge Flores
- **Fase:** 1
- **Detalle:** [`backlog.md` § `patients`](./backlog.md#patients)

**Alcance:** datos del paciente y del cliente (ítem 12), número de historia clínica correlativo asignado por el servidor, `notificationsEnabled`, búsqueda por nombre, cédula o teléfono, y baja lógica.

**Entidades:** paciente.

**Endpoints:**
- [x] `GET /patients` (paginado, con búsqueda)
- [x] `GET /patients/:id`
- [x] `POST /patients`
- [x] `PUT /patients/:id`
- [x] `DELETE /patients/:id` (baja lógica)
- [x] `POST /patients/:id/restore` (reactivar, solo `admin`)

**Pendiente:** importar los 820 pacientes de la clínica; en el frontend, ocultar "Eliminar" al médico y una vista para reactivar; la última visita automática desde la historia clínica. Detalle en [`backlog.md` § `patients`](./backlog.md#patients).

**Relación con otros módulos:**
- La historia clínica edita los mismos datos del paciente (pestaña "Datos del paciente") y muestra el número de historia clínica.
- Los antiguos `medicalHistory` y `allergies` pasan a la historia clínica.
- Al crearlo se agrega la llave foránea de `stock_movements.patient_id`.

**Por definir:** si la clínica tiene una numeración propia de historias clínicas; cómo se ven y reactivan los pacientes dados de baja; la importación de los 820 pacientes actuales.

## 2 y 3. `appointments` ✅

- **Responsable:** Jorge Flores
- **Fase:** 1 (profesionales y consultorios, orden 2) y 2 (citas y bloqueos, orden 3)
- **Detalle:** [`backlog.md` § `appointments`](./backlog.md#appointments)

**Alcance:** agenda con validación de disponibilidad de profesional y consultorio (`409` ante choques), estados de la cita, bloqueos de horario puntuales, y catálogos de profesionales (con registro profesional) y consultorios.

**Entidades:** cita, profesional, consultorio, bloqueo de horario.

**Endpoints:**
- [x] `GET /professionals` (y `POST`/`PUT` para `admin`)
- [x] `GET /rooms` (y `POST`/`PUT` para `admin`)
- [x] `GET /appointments` (con rango de fechas y filtro `patientId`)
- [x] `GET /appointments/:id`
- [x] `POST /appointments`
- [x] `PUT /appointments/:id`
- [x] `PATCH /appointments/:id/status`
- [x] `GET /schedule-blocks`
- [x] `POST /schedule-blocks`
- [x] `DELETE /schedule-blocks/:id`

**Relación con otros módulos:**
- Registrar una atención vinculada a una cita la pasa a `completada` (historia clínica).
- El catálogo de profesionales lo usan la historia clínica (registro profesional en la declaración de veracidad), los ciclos de esterilización y el `professionalId` del usuario: al crearlo se agregan esas llaves foráneas.
- Crear o cancelar una cita dispara la notificación (`notifications`).

**Por definir:** pantalla para administrar profesionales y su registro profesional; relación con las sedes si son varias.

## 4. `treatments`: tratamientos realizados ✅

- **Responsable:** Jorge Flores
- **Fase:** 1 (catálogo, ✅) y 2 (tratamientos realizados, orden 4)
- **Detalle:** [`backlog.md` § `treatments`](./backlog.md#treatments)

**Alcance:** catálogo de tratamientos con su consumo de insumos, y tratamientos realizados en una atención (asignación `completado` con pieza, atención de origen y costo cobrado). El registro es idempotente por `sourceKey` y descuenta insumos del inventario.

**Entidades:** tratamiento (con líneas de consumo), asignación de tratamiento.

**Endpoints:**
- [x] `GET /treatments` (paginado y filtro `active`)
- [x] `GET /treatments/:id`
- [x] `POST /treatments`
- [x] `PUT /treatments/:id`
- [x] `DELETE /treatments/:id`
- [x] Insumos de cada tratamiento (`consumption`)
- [x] `409` al eliminar un tratamiento ya usado (requiere las asignaciones)
- [x] `GET /treatments/:id/assignments`
- [x] `GET /treatment-assignments?patientId=`
- [x] `POST /treatment-assignments`

**Relación con otros módulos:**
- Descuenta insumos con `StockService` (ya listo) y llena `stock_movements.treatment_assignment_id`.
- Finanzas y Reportes calculan los montos con el costo cobrado (`price`) de cada asignación.

## 5. `clinical-history` ✅

- **Responsable:** Jorge Flores
- **Fase:** 3
- **Detalle:** [`backlog.md` § `clinical-history`](./backlog.md#clinical-history). Implementado en `Modules/ClinicalHistory/`.

**Alcance:**
- Historia editable por paciente con concurrencia optimista (`revision`): odontograma, antecedentes, alergias y medicación, hábitos, plan por fases, consentimiento, declaración de veracidad, adjuntos y exámenes solicitados.
- Atenciones inmutables con copia del odontograma y de las alertas, diagnósticos, evaluación clínica y notas aclaratorias.
- Adjuntos (imágenes y PDF de hasta 20 MB).
- Registro de la atención en una sola transacción (recomendado): tratamientos realizados, atención, quitar propuestos, exámenes solicitados y cita completada.
- Solo para `admin` y `medico`.

**Entidades:** historia clínica, atención, nota aclaratoria, adjunto, examen solicitado.

**Endpoints:**
- [x] `GET /clinical-history/encounters` (paginado, con búsqueda)
- [x] `GET /clinical-history/patients/:patientId`
- [x] `PUT /clinical-history/patients/:patientId`
- [x] `POST /clinical-history/patients/:patientId/encounters`
- [x] `POST /clinical-history/encounters/:encounterId/notes`
- [x] `POST /clinical-history/attachments`
- [x] `GET /clinical-history/attachments/:attachmentId/file`

**Relación con otros módulos:** datos del paciente (`patients`), profesional de la atención, paso de la cita a `completada` (`appointments`) y tratamientos realizados.

**Por definir:** texto legal del consentimiento y su versionado; firmas; importación de las historias registradas en modo demostración.

## 6. `institution` ✅

- **Responsable:** Jorge Flores
- **Fase:** 1
- **Detalle:** [`backlog.md` § `institution`](./backlog.md#institution)

**Alcance:** perfil de la clínica con sus sedes. Es un módulo nuevo en el backend: el frontend hoy lo guarda en el navegador y hay que agregarle su archivo `institution.api.ts`.

**Entidades:** perfil de la institución, sede.

**Endpoints:**
- [x] `GET /institution/profile` y `GET /institution/public` (sin sesión, para el logo del inicio de sesión)
- [x] `PUT /institution/profile` (solo `admin`)

**Relación con otros módulos:** el perfil ya está en la tabla `institutions` (una fila), lista para la multi-clínica ([`docs/plan-multiclinica.md`](./docs/plan-multiclinica.md), M1). Las notificaciones usan su nombre.

**Por definir:** si el grupo maneja una o varias sedes (ítem 2 del backlog de producto); cómo se sube el logo.

## 7. `notifications` ✅

- **Responsable:** Jorge Flores
- **Fase:** 2
- **Detalle:** [`backlog.md` § `notifications`](./backlog.md#notifications)

**Alcance:** plantilla de mensaje, registro de notificaciones enviadas y envío automático al crear o cancelar una cita (solo si el paciente tiene las notificaciones activas). No hay un endpoint para disparar el envío: es un efecto de `POST /appointments` y `PATCH /appointments/:id/status`.

**Entidades:** registro de notificación, plantilla.

**Endpoints:**
- [x] `GET /notifications` (paginado, con filtro `appointmentId`)
- [x] `GET /notifications/template`
- [x] `PUT /notifications/template`
- [x] Envío automático de confirmación y cancelación de cita (con el proveedor `log` mientras no se elija uno)
- [x] Recordatorios programados (tarea en segundo plano)

**Relación con otros módulos:** el mismo proveedor de correo sirve para la recuperación de contraseña de `auth`.

**Por definir:** canal de envío (correo o SMS) y proveedor.

## 8. `finance` ✅ (etapa A)

- **Responsable:** Jorge Flores
- **Fase:** 4
- **Detalle:** [`backlog.md` § `finance`](./backlog.md#finance)

**Alcance:** cartera activa y resúmenes financieros por tratamiento y por paciente, calculados con el costo cobrado de cada tratamiento realizado. El frontend aún no tiene funciones `*Real` en este módulo: hay que agregarlas.

**Endpoints:**
- [x] `GET /finance/portfolio`
- [x] `GET /finance/treatments/:treatmentId/summary`
- [x] `GET /finance/patients/:patientId/summary`
- [x] `POST /finance/payments` y `POST /finance/payments/:id/void`

**Relación con otros módulos:** el costo cobrado (`price`) se guarda en las asignaciones de `treatments`.

**Por definir:**
- ~~Si el médico puede ver los resúmenes financieros~~ **Decidido:** el médico no ve montos.
- Pagos: se crean en la etapa A (aprobado). Cuotas, seguros y facturación electrónica (ítem 8): primero se diseñan en el frontend. El cobro a las clínicas por usar ClinicApp no se crea por ahora.

## 9. `reports` ✅

- **Responsable:** Jorge Flores
- **Fase:** 4
- **Detalle:** [`backlog.md` § `reports`](./backlog.md#reports)

**Alcance:** reportes por periodo calculados en la base de datos: resumen, agenda y ocupación, productividad por profesional, tratamientos e inventario. Solo para `admin`.

**Endpoints:**
- [x] `GET /reports/summary`
- [x] `GET /reports/agenda`
- [x] `GET /reports/productivity`
- [x] `GET /reports/treatments`
- [x] `GET /reports/inventory`

**Relación con otros módulos:** el reporte de tratamientos e inventario usa las asignaciones, los movimientos y las órdenes de compra.

**Decidido:** el resumen y la agenda quedan abiertos a los tres roles (los usa el Inicio); productividad, tratamientos e inventario, solo `admin`.
