# Desglose del backend por módulo — ClinicApp

Reparto del trabajo de la API .NET entre **Jorge Flores** y **Josue Cevallos**, por módulo y en orden de implementación. El detalle de cada endpoint (contrato, validaciones y casos de error) está en [`backlog.md`](./backlog.md); este archivo dice **quién** hace cada módulo, **en qué orden** y **qué tiene que coordinarse** entre ambos.

El frontend ya está aprobado por la clienta. Cada módulo se da por terminado cuando su pantalla funciona con `VITE_USE_MOCK_API=false` contra la API real.

---

## Resumen

| # | Módulo | Responsable | Fase | Depende de |
|---|---|---|---|---|
| 1 | Base del proyecto y `auth` | Jorge Flores | 0 | — |
| 2 | `patients` | Josue Cevallos | 1 | Base |
| 3 | `appointments` (citas, profesionales, consultorios, bloqueos) | Josue Cevallos | 1 y 2 | Base, `patients` |
| 4 | `institution` | Josue Cevallos | 1 | Base |
| 5 | `treatments` (catálogo y tratamientos realizados) | Jorge Flores | 1 y 2 | Base, `patients`, `inventory` |
| 6 | `inventory` | Jorge Flores | 1 y 2 | Base, `appointments` (profesionales) |
| 7 | `notifications` | Josue Cevallos | 2 | `appointments`, `patients` |
| 8 | `clinical-history` | Jorge Flores | 3 | `patients`, `appointments`, `treatments` |
| 9 | `finance` | Josue Cevallos | 4 | `treatments`, `patients` |
| 10 | `reports` | Josue Cevallos | 4 | Todos los anteriores |

**Criterio del reparto:**
- **Josue Cevallos** ya es responsable en el backlog de producto de pacientes (ítem 4), perfil de la institución (ítem 2) y cobranza (ítem 8). Toma además citas y notificaciones, que dependen una de la otra, y reportes, que agregan datos de todos los módulos.
- **Jorge Flores** hizo el frontend de la historia clínica. Toma la base del proyecto y la historia clínica, junto con tratamientos e inventario, que están unidos: registrar un tratamiento realizado en una atención descuenta insumos del inventario.

## Fases

| Fase | Contenido | Resultado |
|---|---|---|
| **0. Base** | Proyecto .NET, base de datos, autenticación, roles, formato de errores, paginación, despliegue | Se puede iniciar sesión contra la API real. Es requisito para todo lo demás. |
| **1. Catálogos** | Pacientes, profesionales y consultorios, perfil de la institución, catálogo de tratamientos, insumos y proveedores | Las pantallas de alta y edición funcionan con la API. |
| **2. Operación** | Citas y bloqueos, notificaciones, tratamientos realizados, movimientos, lotes, órdenes de compra y esterilización | La agenda y el inventario funcionan con la API. |
| **3. Historia clínica** | Historia editable, atenciones, notas, adjuntos y exámenes solicitados | La historia clínica funciona con la API. |
| **4. Finanzas y reportes** | Cartera, resúmenes financieros y reportes | El Inicio, Finanzas y Reportes funcionan con la API. |

Las fases 1 y 2 pueden avanzar en paralelo entre ambos responsables en cuanto la fase 0 esté lista.

## Decisiones técnicas por definir antes de empezar

Se acuerdan entre ambos responsables en la fase 0:
- **Motor de base de datos y acceso a datos** (por ejemplo, SQL Server o PostgreSQL, con Entity Framework Core y migraciones).
- **Almacenamiento de archivos:** adjuntos de la historia clínica, logo de la institución y foto de perfil (disco del servidor o almacenamiento de objetos, por ejemplo, DigitalOcean Spaces).
- **Envío de correos y SMS:** proveedor para notificaciones de citas y recuperación de contraseña.
- **Despliegue:** hoy el frontend se sirve con nginx en el Droplet de DigitalOcean, por HTTP en la IP. Definir si la API corre en el mismo Droplet y pasar a HTTPS con dominio (necesario para la cookie `httpOnly` de refresh con `Secure`).
- **Identificadores:** el frontend genera UUID para atenciones y tratamientos propuestos; usar UUID en la base de datos simplifica el contrato.
- **Zona horaria de la clínica** para fechas y reportes (Ecuador, UTC−5).

---

## 1. Base del proyecto y `auth`

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
- [ ] `POST /auth/login`
- [ ] `POST /auth/logout`
- [ ] `GET /auth/me`
- [ ] `POST /auth/refresh` (propuesta)
- [ ] `PUT /auth/me/profile` (propuesta)
- [ ] `POST /auth/password-recovery` y `POST /auth/password-reset` (propuesta)
- [ ] `POST /auth/access-requests` (propuesta)

**Coordinar con Josue Cevallos:** el `professionalId` del usuario apunta al catálogo de profesionales de `appointments`.

**Por definir:** pantalla de gestión de usuarios; quién revisa las solicitudes de acceso.

## 2. `patients`

- **Responsable:** Josue Cevallos
- **Fase:** 1
- **Detalle:** [`backlog.md` § `patients`](./backlog.md#patients)

**Alcance:** datos del paciente y del cliente (ítem 12), número de historia clínica correlativo asignado por el servidor, `notificationsEnabled`, búsqueda por nombre, cédula o teléfono, y baja lógica.

**Entidades:** paciente.

**Endpoints:**
- [ ] `GET /patients` (paginado, con búsqueda)
- [ ] `GET /patients/:id`
- [ ] `POST /patients`
- [ ] `PUT /patients/:id`
- [ ] `DELETE /patients/:id` (baja lógica)

**Coordinar con Jorge Flores:** la historia clínica edita los mismos datos del paciente (pestaña "Datos del paciente") y muestra el número de historia clínica. Los antiguos `medicalHistory` y `allergies` pasan a la historia clínica.

**Por definir:** si la clínica tiene una numeración propia de historias clínicas; cómo se ven y reactivan los pacientes dados de baja.

## 3. `appointments`

- **Responsable:** Josue Cevallos
- **Fase:** 1 (profesionales y consultorios) y 2 (citas y bloqueos)
- **Detalle:** [`backlog.md` § `appointments`](./backlog.md#appointments)

**Alcance:** agenda con validación de disponibilidad de profesional y consultorio (`409` ante choques), estados de la cita, bloqueos de horario puntuales, y catálogos de profesionales (con registro profesional) y consultorios.

**Entidades:** cita, profesional, consultorio, bloqueo de horario.

**Endpoints:**
- [ ] `GET /appointments` (con rango de fechas y filtro `patientId`)
- [ ] `GET /appointments/:id`
- [ ] `POST /appointments`
- [ ] `PUT /appointments/:id`
- [ ] `PATCH /appointments/:id/status`
- [ ] `GET /professionals`
- [ ] `GET /rooms`
- [ ] `GET /schedule-blocks`
- [ ] `POST /schedule-blocks`
- [ ] `DELETE /schedule-blocks/:id`

**Coordinar con Jorge Flores:**
- Registrar una atención vinculada a una cita la pasa a `completada`.
- El catálogo de profesionales lo usan la historia clínica (registro profesional en la declaración de veracidad) y los ciclos de esterilización de inventario.

**Por definir:** pantalla para administrar profesionales y su registro profesional; relación con las sedes si son varias.

## 4. `institution`

- **Responsable:** Josue Cevallos
- **Fase:** 1
- **Detalle:** [`backlog.md` § `institution`](./backlog.md#institution)

**Alcance:** perfil de la clínica con sus sedes. Es un módulo nuevo en el backend: el frontend hoy lo guarda en el navegador y hay que agregarle su archivo `institution.api.ts`.

**Entidades:** perfil de la institución, sede.

**Endpoints:**
- [ ] `GET /institution/profile` (público o con variante pública para el logo del inicio de sesión) (propuesta)
- [ ] `PUT /institution/profile` (solo `admin`) (propuesta)

**Por definir:** si el grupo maneja una o varias sedes (ítem 2 del backlog de producto); cómo se sube el logo.

## 5. `treatments`

- **Responsable:** Jorge Flores
- **Fase:** 1 (catálogo) y 2 (tratamientos realizados)
- **Detalle:** [`backlog.md` § `treatments`](./backlog.md#treatments)

**Alcance:** catálogo de tratamientos con su consumo de insumos, y tratamientos realizados en una atención (asignación `completado` con pieza, atención de origen y costo cobrado). El registro es idempotente por `sourceKey` y descuenta insumos del inventario.

**Entidades:** tratamiento (con líneas de consumo), asignación de tratamiento.

**Endpoints:**
- [ ] `GET /treatments` (paginado y filtro `active`)
- [ ] `GET /treatments/:id`
- [ ] `POST /treatments`
- [ ] `PUT /treatments/:id`
- [ ] `DELETE /treatments/:id`
- [ ] `GET /treatments/:id/assignments`
- [ ] `GET /treatment-assignments?patientId=`
- [ ] `POST /treatment-assignments`

**Coordinar con Josue Cevallos:** Finanzas y Reportes calculan los montos con el costo cobrado (`price`) de cada asignación.

## 6. `inventory`

- **Responsable:** Jorge Flores
- **Fase:** 1 (insumos y proveedores) y 2 (movimientos, lotes, órdenes y esterilización)
- **Detalle:** [`backlog.md` § `inventory`](./backlog.md#inventory)

**Alcance:** insumos consumibles e instrumental, stock por lotes con salida FEFO (primero en vencer, primero en salir), movimientos manuales, proveedores, órdenes de compra y ciclos de esterilización. El consumo automático de un tratamiento realizado nunca falla por falta de stock.

**Entidades:** insumo, movimiento de stock, lote, proveedor, orden de compra (con líneas), ciclo de esterilización.

**Endpoints:**
- [ ] `GET /inventory/items`
- [ ] `GET /inventory/items/:id`
- [ ] `POST /inventory/items`
- [ ] `PUT /inventory/items/:id`
- [ ] `DELETE /inventory/items/:id`
- [ ] `GET /inventory/items/:id/movements`
- [ ] `POST /inventory/items/:id/movements`
- [ ] `GET /inventory/items/:id/lots`
- [ ] `GET /inventory/suppliers`
- [ ] `POST /inventory/suppliers`
- [ ] `PUT /inventory/suppliers/:id`
- [ ] `DELETE /inventory/suppliers/:id`
- [ ] `GET /inventory/purchase-orders`
- [ ] `POST /inventory/purchase-orders`
- [ ] `POST /inventory/purchase-orders/:id/receive`
- [ ] `POST /inventory/purchase-orders/:id/cancel`
- [ ] `GET /inventory/sterilization-cycles`
- [ ] `POST /inventory/sterilization-cycles`

**Coordinar con Josue Cevallos:** el responsable de un ciclo de esterilización es un profesional del catálogo de `appointments`; el reporte de inventario usa los movimientos y las órdenes de compra.

## 7. `notifications`

- **Responsable:** Josue Cevallos
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

**Coordinar con Jorge Flores:** el mismo proveedor de correo sirve para la recuperación de contraseña de `auth`.

**Por definir:** canal de envío (correo o SMS) y proveedor.

## 8. `clinical-history`

- **Responsable:** Jorge Flores
- **Fase:** 3
- **Detalle:** [`backlog.md` § `clinical-history`](./backlog.md#clinical-history)

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

**Coordinar con Josue Cevallos:** datos del paciente (`patients`) y paso de la cita a `completada` (`appointments`).

**Por definir:** texto legal del consentimiento y su versionado; firmas; importación de las historias registradas en modo demostración.

## 9. `finance`

- **Responsable:** Josue Cevallos
- **Fase:** 4
- **Detalle:** [`backlog.md` § `finance`](./backlog.md#finance)

**Alcance:** cartera activa y resúmenes financieros por tratamiento y por paciente, calculados con el costo cobrado de cada tratamiento realizado. El frontend aún no tiene funciones `*Real` en este módulo: hay que agregarlas.

**Endpoints:**
- [ ] `GET /finance/portfolio` (propuesta)
- [ ] `GET /finance/treatments/:treatmentId/summary` (propuesta)
- [ ] `GET /finance/patients/:patientId/summary` (propuesta)

**Coordinar con Jorge Flores:** el costo cobrado (`price`) se guarda en las asignaciones de `treatments`.

**Por definir:**
- Si el médico puede ver los resúmenes financieros en la ficha del paciente y en el detalle del tratamiento.
- Pagos, cuotas, seguros y facturación electrónica (ítem 8): primero se diseñan en el frontend; sus endpoints de escritura quedan para después.

## 10. `reports`

- **Responsable:** Josue Cevallos
- **Fase:** 4
- **Detalle:** [`backlog.md` § `reports`](./backlog.md#reports)

**Alcance:** reportes por periodo calculados en la base de datos: resumen, agenda y ocupación, productividad por profesional, tratamientos e inventario. Solo para `admin`.

**Endpoints:**
- [ ] `GET /reports/summary`
- [ ] `GET /reports/agenda`
- [ ] `GET /reports/productivity`
- [ ] `GET /reports/treatments`
- [ ] `GET /reports/inventory`

**Coordinar con Jorge Flores:** el reporte de tratamientos e inventario usa las asignaciones, los movimientos y las órdenes de compra.

**Por definir:** el Inicio lo ven los tres roles y usa `GET /reports/summary` y `GET /reports/agenda`; decidir si se abren esos dos endpoints a todos los roles o se crea `GET /dashboard/summary`.
