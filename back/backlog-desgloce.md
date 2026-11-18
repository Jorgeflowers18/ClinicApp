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
| **5** | `clinical-history` | Plan aprobado, en espera de su turno: [`docs/plan-historia-clinica.md`](./docs/plan-historia-clinica.md) | 3 | `patients`, profesionales, citas, tratamientos realizados |
| **6** | `institution` | Plan en revisión: [`docs/plan-institucion.md`](./docs/plan-institucion.md) | 1 | Base |
| **7** | `notifications` | Plan en revisión: [`docs/plan-notificaciones.md`](./docs/plan-notificaciones.md). Falta elegir el proveedor de envío. | 2 | Citas, `patients` |
| **8** | `finance` | Plan en revisión: [`docs/plan-finanzas.md`](./docs/plan-finanzas.md). Pagos aprobados; cuotas, seguros y factura esperan el ítem 8. | 4 | Tratamientos realizados, `patients` |
| **9** | `reports` | Plan en revisión: [`docs/plan-reportes.md`](./docs/plan-reportes.md) | 4 | Todos los anteriores |

**Por qué este orden:**
- **`patients` primero.** Casi todo apunta al paciente: citas, tratamientos realizados, historia clínica, finanzas y los movimientos de inventario. Sin esta tabla, esos módulos guardan un `patient_id` sin llave foránea que después hay que migrar.
- **Profesionales y consultorios después.** Son catálogos pequeños, y de ellos dependen las citas, la historia clínica (profesional de la atención y registro profesional), los ciclos de esterilización y el `professionalId` del usuario.
- **Citas y tratamientos realizados antes de la historia clínica.** Así la historia clínica se hace una sola vez y completa:
  - con llaves foráneas reales (D1 del plan);
  - con el registro de la atención en una sola transacción (D2): tratamientos realizados, atención y cita completada.
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

## 5. `clinical-history`

- **Responsable:** Jorge Flores
- **Fase:** 3
- **Detalle:** [`backlog.md` § `clinical-history`](./backlog.md#clinical-history). Plan de implementación en [`docs/plan-historia-clinica.md`](./docs/plan-historia-clinica.md).

**Alcance:**
- Historia editable por paciente con concurrencia optimista (`revision`): odontograma, antecedentes, alergias y medicación, hábitos, plan por fases, consentimiento, declaración de veracidad, adjuntos y exámenes solicitados.
- Atenciones inmutables con copia del odontograma y de las alertas, diagnósticos, evaluación clínica y notas aclaratorias.
- Adjuntos (imágenes y PDF de hasta 20 MB).
- Registro de la atención en una sola transacción (recomendado): tratamientos realizados, atención, quitar propuestos, exámenes solicitados y cita completada.
- Solo para `admin` y `medico`.

**Entidades:** historia clínica, atención, nota aclaratoria, adjunto, examen solicitado.

**Endpoints:**
- [ ] `GET /clinical-history/encounters` (paginado, con búsqueda)
- [ ] `GET /clinical-history/patients/:patientId`
- [ ] `PUT /clinical-history/patients/:patientId`
- [ ] `POST /clinical-history/patients/:patientId/encounters`
- [ ] `POST /clinical-history/encounters/:encounterId/notes`
- [ ] `POST /clinical-history/attachments`
- [ ] `GET /clinical-history/attachments/:attachmentId/file`

**Relación con otros módulos:** datos del paciente (`patients`), profesional de la atención, paso de la cita a `completada` (`appointments`) y tratamientos realizados.

**Por definir:** texto legal del consentimiento y su versionado; firmas; importación de las historias registradas en modo demostración.

## 6. `institution`

- **Responsable:** Jorge Flores
- **Fase:** 1
- **Detalle:** [`backlog.md` § `institution`](./backlog.md#institution)

**Alcance:** perfil de la clínica con sus sedes. Es un módulo nuevo en el backend: el frontend hoy lo guarda en el navegador y hay que agregarle su archivo `institution.api.ts`.

**Entidades:** perfil de la institución, sede.

**Endpoints:**
- [ ] `GET /institution/profile` (público o con variante pública para el logo del inicio de sesión) (propuesta)
- [ ] `PUT /institution/profile` (solo `admin`) (propuesta)

**Relación con otros módulos:** si se aprueba la multi-clínica, el perfil va en la tabla `institutions` ([`docs/plan-multiclinica.md`](./docs/plan-multiclinica.md), M1).

**Por definir:** si el grupo maneja una o varias sedes (ítem 2 del backlog de producto); cómo se sube el logo.

## 7. `notifications`

- **Responsable:** Jorge Flores
- **Fase:** 2
- **Detalle:** [`backlog.md` § `notifications`](./backlog.md#notifications)

**Alcance:** plantilla de mensaje, registro de notificaciones enviadas y envío automático al crear o cancelar una cita (solo si el paciente tiene las notificaciones activas). No hay un endpoint para disparar el envío: es un efecto de `POST /appointments` y `PATCH /appointments/:id/status`.

**Entidades:** registro de notificación, plantilla.

**Endpoints:**
- [ ] `GET /notifications` (paginado, con filtro `appointmentId`)
- [ ] `GET /notifications/template`
- [ ] `PUT /notifications/template`
- [ ] Envío automático de confirmación y cancelación de cita
- [ ] Recordatorios programados (requieren una tarea periódica en el servidor)

**Relación con otros módulos:** el mismo proveedor de correo sirve para la recuperación de contraseña de `auth`.

**Por definir:** canal de envío (correo o SMS) y proveedor.

## 8. `finance`

- **Responsable:** Jorge Flores
- **Fase:** 4
- **Detalle:** [`backlog.md` § `finance`](./backlog.md#finance)

**Alcance:** cartera activa y resúmenes financieros por tratamiento y por paciente, calculados con el costo cobrado de cada tratamiento realizado. El frontend aún no tiene funciones `*Real` en este módulo: hay que agregarlas.

**Endpoints:**
- [ ] `GET /finance/portfolio` (propuesta)
- [ ] `GET /finance/treatments/:treatmentId/summary` (propuesta)
- [ ] `GET /finance/patients/:patientId/summary` (propuesta)

**Relación con otros módulos:** el costo cobrado (`price`) se guarda en las asignaciones de `treatments`.

**Por definir:**
- ~~Si el médico puede ver los resúmenes financieros~~ **Decidido:** el médico no ve montos.
- Pagos: se crean en la etapa A (aprobado). Cuotas, seguros y facturación electrónica (ítem 8): primero se diseñan en el frontend. El cobro a las clínicas por usar ClinicApp no se crea por ahora.

## 9. `reports`

- **Responsable:** Jorge Flores
- **Fase:** 4
- **Detalle:** [`backlog.md` § `reports`](./backlog.md#reports)

**Alcance:** reportes por periodo calculados en la base de datos: resumen, agenda y ocupación, productividad por profesional, tratamientos e inventario. Solo para `admin`.

**Endpoints:**
- [ ] `GET /reports/summary`
- [ ] `GET /reports/agenda`
- [ ] `GET /reports/productivity`
- [ ] `GET /reports/treatments`
- [ ] `GET /reports/inventory`

**Relación con otros módulos:** el reporte de tratamientos e inventario usa las asignaciones, los movimientos y las órdenes de compra.

**Por definir:** el Inicio lo ven los tres roles y usa `GET /reports/summary` y `GET /reports/agenda`; decidir si se abren esos dos endpoints a todos los roles o se crea `GET /dashboard/summary`.
