# Backlog — Backend (.NET) — ClinicApp

TODOs pendientes para la API .NET, extraídos directamente de los comentarios `// TODO: conectar a endpoint real -> ...` en `front/src/modules/*/api/*.api.ts` y de las reglas de negocio descritas en [`../documentacion/arquitectura-frontend.md`](../documentacion/arquitectura-frontend.md). El frontend ya tiene cada función `*Real` escrita contra el endpoint esperado — activar `VITE_USE_MOCK_API=false` en `front/.env` la conecta sin tocar UI ni hooks, en cuanto el endpoint exista.

Dividido por módulo, usando los mismos nombres que `front/src/modules/`. Marca cada casilla al implementar el endpoint correspondiente.

---

## Transversal (aplica a todos los módulos)

- [ ] Autenticación JWT (`Authorization: Bearer <token>`), validada en cada endpoint salvo `/auth/login`.
- [ ] Errores de validación (400) en formato `ValidationProblemDetails` estándar de ASP.NET Core:
  ```json
  { "title": "...", "detail": "...", "errors": { "campo": ["mensaje"] } }
  ```
  El interceptor de Axios del frontend (`shared/lib/http.ts`) espera exactamente este formato para mostrar errores por campo en los formularios.
- [ ] Conflictos de negocio (choque de horario, etc.) como `409` con el mismo formato `errors` cuando aplique a un campo específico (ej. `startTime`).
- [ ] Paginación estándar donde el frontend la pide (`page`, `pageSize`, `search`) devolviendo `{ items, page, pageSize, totalItems, totalPages }`.

## `auth`

- [ ] `POST /auth/login` — valida credenciales, devuelve `{ accessToken, expiresIn, user }`.
- [ ] `POST /auth/logout`.
- [ ] `GET /auth/me` — **no implementado aún ni siquiera en el frontend real** (pendiente de agregar en ambos lados). Necesario para restaurar sesión sin re-login en cada carga, respaldado por una cookie `httpOnly` de refresh. Mientras no exista, el token vive solo en memoria en el frontend y se pierde al recargar la página (fuera de modo mock).
- [ ] Roles soportados: `admin`, `recepcion`, `medico` (usados para autorización por endpoint, no solo en el frontend).

## `patients`

- [ ] `GET /patients` (query: `page`, `pageSize`, `search` — nombre/cédula/teléfono).
- [ ] `GET /patients/:id`.
- [ ] `POST /patients`.
- [ ] `PUT /patients/:id`.
- [ ] `DELETE /patients/:id`.
- [ ] Campo `notificationsEnabled: boolean` en el body de `POST`/`PUT` — persistirlo; los pacientes nuevos deben crearse con `true` por defecto.

## `appointments`

- [ ] `GET /appointments` (idealmente con filtro de rango de fechas).
- [ ] `GET /appointments/:id`.
- [ ] `POST /appointments` — debe validar disponibilidad de **profesional y consultorio** (rechazar con `409` si hay choque de horario con otra cita no cancelada o con un bloqueo de horario activo) y disparar automáticamente la notificación de confirmación (ver módulo `notifications`).
- [ ] `PUT /appointments/:id` — misma validación de disponibilidad que `POST`, excluyendo la propia cita.
- [ ] `PATCH /appointments/:id/status` — acepta `programada | confirmada | cancelada | completada | no_asistio`; al pasar a `cancelada` debe disparar automáticamente la notificación de cancelación (ver módulo `notifications`).
- [ ] `GET /professionals` — catálogo de profesionales (`id, name, specialty`).
- [ ] `GET /rooms` — catálogo de consultorios (`id, name`). Hoy es un catálogo plano en el frontend (sin alta/edición desde la UI); si el negocio necesita administrarlo, coordinar con el módulo institucional/sedes antes de exponer un CRUD completo aquí.
- [ ] `GET /schedule-blocks` — bloqueos de horario vigentes (`id, professionalId?, roomId?, start, end, reason, createdAt`; al menos uno de `professionalId`/`roomId` presente).
- [ ] `POST /schedule-blocks` — debe validar que el rango no se solape con una cita ya agendada (no cancelada) para el mismo profesional o consultorio; los bloqueos sí pueden solaparse entre sí.
- [ ] `DELETE /schedule-blocks/:id`.
- [ ] Bloqueos son puntuales únicamente (sin recurrencia) — si el negocio pide recurrencia (ej. "todos los lunes de 13:00 a 14:00"), es un cambio de modelo, no solo de endpoint.

## `clinical-history`

- [ ] `GET /clinical-history` (requiere autorización por rol en el backend — hoy el frontend solo lo restringe con rutas protegidas del lado cliente, que no son una barrera real de seguridad).
- [ ] `GET /clinical-history/:id`.
- [ ] `POST /clinical-history`.
- [ ] `PUT /clinical-history/:id`.
- [ ] Definir política real de almacenamiento de adjuntos — hoy en el frontend son solo nombres de archivo sin subida real (ni backend que los reciba).

## `treatments`

- [ ] `GET /treatments`.
- [ ] `GET /treatments?active=true`.
- [ ] `GET /treatments/:id`.
- [ ] `POST /treatments`.
- [ ] `PUT /treatments/:id`.
- [ ] `DELETE /treatments/:id`.
- [ ] `GET /treatments/:id/assignments`.
- [ ] `POST /treatment-assignments/:id/advance-session` — además de avanzar la sesión, debe descontar stock de inventario por cada línea de `Treatment.consumption` (ver `inventory.registerConsumption` más abajo). En el frontend esto ya está conectado: `advanceSession` llama a la API pública de inventario, no toca sus datos directamente.

## `inventory`

- [ ] `GET /inventory/items`.
- [ ] `GET /inventory/items/:id`.
- [ ] `POST /inventory/items` — incluye `kind: "consumible" | "instrumental"`.
- [ ] `PUT /inventory/items/:id`.
- [ ] `DELETE /inventory/items/:id`.
- [ ] `GET /inventory/items/:id/movements`.
- [ ] `POST /inventory/items/:id/movements` — debe ajustar el stock del insumo según tipo de movimiento (entrada/salida); una entrada admite `expirationDate` opcional y **debe crear un lote nuevo** (ver `lots` abajo), no solo sumar al contador de stock.
- [ ] `GET /inventory/items/:id/lots` — lotes del insumo (cantidad restante, vencimiento, orden de compra de origen si aplica), para mostrar "próximos a vencer".
- [ ] **Consumo por lote (FEFO)** — cualquier salida de stock (manual o automática) debe descontarse de los lotes ordenados por vencimiento ascendente (primero en vencer, primero en salir), generando un movimiento por cada lote tocado si la salida abarca más de uno. El consumo automático (disparado por `advance-session`) **no debe fallar si el stock no alcanza** — descuenta lo disponible y continúa; el consumo manual (vía `POST /inventory/items/:id/movements`) sí debe seguir validando que la cantidad no supere el stock disponible antes de ejecutarse.
- [ ] `GET /inventory/suppliers` — catálogo de proveedores (`id, name, contactName?, phone?, email?, address?, notes?, createdAt`).
- [ ] `POST /inventory/suppliers`.
- [ ] `PUT /inventory/suppliers/:id`.
- [ ] `DELETE /inventory/suppliers/:id` — debe responder `409` si el proveedor tiene órdenes de compra asociadas (así lo simula el mock).
- [ ] `GET /inventory/purchase-orders` — listado de órdenes de compra (sin paginar, volumen bajo esperado).
- [ ] `POST /inventory/purchase-orders` — crea con estado `pendiente`; el body trae `supplierId` (FK a `suppliers`), validar que exista.
- [ ] `POST /inventory/purchase-orders/:id/receive` — solo si está `pendiente`; por cada línea crea un lote + movimiento de entrada, marca la orden `recibida` con `receivedAt`.
- [ ] `POST /inventory/purchase-orders/:id/cancel` — solo si está `pendiente`.
- [ ] `GET /inventory/sterilization-cycles`.
- [ ] `POST /inventory/sterilization-cycles` — `itemIds` debe validarse contra insumos con `kind: "instrumental"`; `responsibleProfessionalId` referencia el mismo catálogo de `GET /professionals` del módulo `appointments`.

## `reports`

Todos restringidos al rol `admin`. Query `from`/`to` en `YYYY-MM-DD`, **inclusivos**, en la zona horaria de la clínica. La agregación debe hacerse en SQL del lado del servidor (el frontend hoy la simula en memoria); las formas de respuesta están en `front/src/modules/reports/types/report.types.ts`.

- [ ] `GET /reports/summary` — `patientsTotal`, `activeTreatments` (asignaciones `en_progreso`) y `criticalStockItems` (`stock <= minStock`) son puntuales, ignoran el periodo. `patientsNewInPeriod` filtra `patients.createdAt`; `appointmentsInPeriod/Completed/NoShow` filtran `appointments.start`; `notificationsSent` filtra `sentAt` con `status = enviada`. `noShowRate = noShow / (completadas + noShow)` (0 si el denominador es 0).
- [ ] `GET /reports/agenda` — `byDay` con todos los días del periodo (relleno en cero) y conteos por estado; `byStatus` con los 5 estados; `occupancyByRoom` con minutos reservados (citas no canceladas) y bloqueados por consultorio, más una fila "Sin consultorio" si hay citas sin `roomId`.
- [ ] `GET /reports/productivity` — por profesional: programadas, completadas, no asistió, canceladas, `completionRate = completadas / max(1, programadas − canceladas)`. No incluir sesiones de tratamiento por profesional hasta que `treatment-assignments` registre `professionalId`.
- [ ] `GET /reports/treatments` — por tratamiento: citas del periodo (`appointments.treatmentId`), asignaciones activas/completadas y sesiones (filtrando `assignments.startDate`), `estimatedRevenue = price × asignaciones completadas` — **provisional**, reemplazar por ingresos reales cuando exista facturación (ítem 8).
- [ ] `GET /reports/inventory` — `criticalItems` puntual; `purchasesInPeriod` filtra `purchase_orders.createdAt` con `total = Σ qty × unitCost` y `purchasesTotal` excluyendo canceladas; `consumptionInPeriod` = movimientos `salida` del periodo agrupados por insumo.

## `notifications`

- [ ] `GET /notifications` (query: `page`, `pageSize`, `search` — nombre o identificación del paciente, requiere JOIN con `patients` —, `dateFrom`, `dateTo`) — reporte de notificaciones enviadas.
- [ ] `GET /notifications?appointmentId=:id` — notificaciones asociadas a una cita puntual (usado para mostrar "cliente notificado" en el detalle de la cita).
- [ ] `GET /notifications/template` — plantilla predeterminada de notificación (mensaje con variables sin reemplazar, ej. `[nombre del cliente]`, `[fecha de la cita]`, `[hora de la cita]`, `[profesional]`, `[nombre de la clínica]`; ver `notification.types.ts` para la lista completa de tokens).
- [ ] `PUT /notifications/template` — actualiza el mensaje (body: `{ message: string }`).
- [ ] **Disparo automático de notificaciones** — el backend debe generar un `NotificationLog` (tipo `confirmacion_cita`) al crear una cita y uno (tipo `cancelacion_cita`) al cancelarla, reemplazando las variables de la plantilla con los datos reales, **solo si** `patient.notificationsEnabled` es `true`. En el frontend esto hoy está simulado en el propio mock (`notificationsApi.logAppointmentEvent`); no expone ni debe exponer un endpoint propio — es un efecto secundario de `POST /appointments` y `PATCH /appointments/:id/status`, no una llamada aparte del frontend.
- [ ] **Recordatorios (`recordatorio_cita`)** — requieren un scheduler/cron real (disparo por tiempo antes de la cita, no por una acción de usuario). No hay forma de simular esto desde el frontend; queda enteramente del lado del backend/infraestructura.
- [ ] Definir el canal real de envío (hoy el modelo soporta `email`/`sms` pero no hay integración con ningún proveedor).

---

## Notas

- Este archivo es un desglose técnico del contrato ya definido en [`../documentacion/arquitectura-frontend.md`](../documentacion/arquitectura-frontend.md) — si cambia el contrato del lado frontend, actualizar ambos documentos.
- La priorización y el responsable de cada funcionalidad (a nivel de producto) están en [`../documentacion/backlog.md`](../documentacion/backlog.md); este archivo es solo el detalle de implementación del lado del backend.
