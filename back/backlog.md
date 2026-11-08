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
- [ ] Vincular usuario y profesional: incluir `professionalId` (opcional) en el `user` de `/auth/login` y `/auth/me`. La historia clínica lo usa como profesional por defecto de una atención nueva; hoy el frontend lo deduce comparando el nombre del usuario con `GET /professionals` (`clinical-history/hooks/use-default-professional.ts`).

## `patients`

- [ ] `GET /patients` (query: `page`, `pageSize`, `search` — nombre/cédula/teléfono).
- [ ] `GET /patients/:id`.
- [ ] `POST /patients`.
- [ ] `PUT /patients/:id`.
- [ ] `DELETE /patients/:id`.
- [ ] Campo `notificationsEnabled: boolean` en el body de `POST`/`PUT` — persistirlo; los pacientes nuevos deben crearse con `true` por defecto.
- [ ] **Datos del cliente (ítem 12):** `POST`/`PUT /patients` reciben `maritalStatus` (`"" | soltero | casado | union_libre | divorciado | viudo`), `occupation`, `company` (máx. 120), `nationality` (máx. 60), `city` (ciudad / provincia, máx. 120) y `emergencyContactRelationship` (máx. 60). Se editan desde la historia clínica (pestaña "Datos del paciente") y desde la ficha; es el mismo registro. Se quitan `medicalHistory` y `allergies`: los reemplazan los antecedentes y las alergias de la historia clínica (definir la migración de los textos existentes; el mock los convierte en "Otro" y en una fila de alergia).
- [ ] **N.° de historia clínica:** `clinicalRecordNumber` (formato `HC-000123`, correlativo) lo asigna el servidor al crear el paciente y es de solo lectura (`PUT` lo ignora). Confirmar con la clínica si ya tiene una numeración propia que haya que respetar.

## `appointments`

- [ ] `GET /appointments` (idealmente con filtro de rango de fechas).
- [ ] `GET /appointments?patientId=` — citas de un paciente, de la más reciente a la más antigua (pestaña "Citas" de la historia clínica y opciones de cita al registrar una atención). Hoy el mock filtra la lista completa.
- [ ] `GET /appointments/:id`.
- [ ] `POST /appointments` — debe validar disponibilidad de **profesional y consultorio** (rechazar con `409` si hay choque de horario con otra cita no cancelada o con un bloqueo de horario activo) y disparar automáticamente la notificación de confirmación (ver módulo `notifications`).
- [ ] `PUT /appointments/:id` — misma validación de disponibilidad que `POST`, excluyendo la propia cita.
- [ ] `PATCH /appointments/:id/status` — acepta `programada | confirmada | cancelada | completada | no_asistio`; al pasar a `cancelada` debe disparar automáticamente la notificación de cancelación (ver módulo `notifications`).
- [ ] `GET /professionals` — catálogo de profesionales (`id, name, specialty, registrationNumber`). `registrationNumber` es el registro profesional que se muestra en la declaración de veracidad de la historia clínica (vacío si no se registró). Hoy no hay pantalla para administrarlo.
- [ ] `GET /rooms` — catálogo de consultorios (`id, name`). Hoy es un catálogo plano en el frontend (sin alta/edición desde la UI); si el negocio necesita administrarlo, coordinar con el módulo institucional/sedes antes de exponer un CRUD completo aquí.
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

- [ ] `GET /treatments`.
- [ ] `GET /treatments?active=true`.
- [ ] `GET /treatments/:id`.
- [ ] `POST /treatments`.
- [ ] `PUT /treatments/:id`.
- [ ] `DELETE /treatments/:id`.
- [ ] `GET /treatments/:id/assignments`.
- [ ] `GET /treatment-assignments?patientId=` — asignaciones de un paciente, de la más reciente a la más antigua. Lo usa la pestaña "Tratamientos" de la historia clínica para mostrar el progreso de las asignaciones antiguas con varias sesiones.
- [ ] `POST /treatment-assignments` (body: `treatmentId`, `patientId`, `date`, `tooth`, `sourceEncounterId`, `sourceKey`, `price`) — registra un tratamiento **realizado** en una atención: crea la asignación ya `completado` con 1 de 1 sesión y descuenta stock de inventario por cada línea de `Treatment.consumption` (ver `inventory.registerConsumption`). **Idempotente por `sourceKey`** (atención + tratamiento de esa atención): si ya existe, devuelve la existente sin descontar de nuevo (el registro de la atención puede reintentarse). `404` si el tratamiento no existe y `400` si está inactivo. No valida deuda del paciente. Reemplaza a `POST /treatment-assignments/:id/advance-session`, que el frontend ya no usa (se quitó "+ Sesión").
- [ ] Persistir `tooth`, `sourceEncounterId` y `sourceKey` (opcionales) en `TreatmentAssignment`, para trazar en qué atención y pieza se realizó cada tratamiento. `GET /treatments/:id/assignments` debe devolverlos: el detalle del catálogo los muestra en "Pacientes que recibieron este tratamiento".
- [ ] **Costo cobrado del tratamiento (`price`):** el doctor puede ajustar el costo en la atención (por ejemplo, un descuento). Persistir `price` en `TreatmentAssignment` (número ≥ 0; si falta, se usa el precio del catálogo, como en las asignaciones anteriores) y devolverlo en `GET /treatments/:id/assignments` y `GET /treatment-assignments?patientId=`. La cartera de Finanzas (`totalValue`, `pendingBalance`, `patientResponsibility`) y el ingreso estimado de reportes deben calcularse con `price`, no con el precio del catálogo. Hoy el mock de Finanzas resume por tratamiento + paciente y toma el costo de la asignación más reciente; con backend, la cartera debería calcularse por asignación (se revisará junto con pagos y abonos, ítem 8).

## `inventory`

- [ ] `GET /inventory/items`.
- [ ] `GET /inventory/items/:id`.
- [ ] `POST /inventory/items` — incluye `kind: "consumible" | "instrumental"`.
- [ ] `PUT /inventory/items/:id`.
- [ ] `DELETE /inventory/items/:id`.
- [ ] `GET /inventory/items/:id/movements`.
- [ ] `POST /inventory/items/:id/movements` — debe ajustar el stock del insumo según tipo de movimiento (entrada/salida); una entrada admite `expirationDate` opcional y **debe crear un lote nuevo** (ver `lots` abajo), no solo sumar al contador de stock.
- [ ] `GET /inventory/items/:id/lots` — lotes del insumo (cantidad restante, vencimiento, orden de compra de origen si aplica), para mostrar "próximos a vencer".
- [ ] **Consumo por lote (FEFO)** — cualquier salida de stock (manual o automática) debe descontarse de los lotes ordenados por vencimiento ascendente (primero en vencer, primero en salir), generando un movimiento por cada lote tocado si la salida abarca más de uno. El consumo automático (disparado por `POST /treatment-assignments` al registrar un tratamiento realizado) **no debe fallar si el stock no alcanza** — descuenta lo disponible y continúa; el consumo manual (vía `POST /inventory/items/:id/movements`) sí debe seguir validando que la cantidad no supere el stock disponible antes de ejecutarse.
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

---

## Notas

- Este archivo es un desglose técnico del contrato ya definido en [`../documentacion/arquitectura-frontend.md`](../documentacion/arquitectura-frontend.md) — si cambia el contrato del lado frontend, actualizar ambos documentos.
- La priorización y el responsable de cada funcionalidad (a nivel de producto) están en [`../documentacion/backlog.md`](../documentacion/backlog.md); este archivo es solo el detalle de implementación del lado del backend.
