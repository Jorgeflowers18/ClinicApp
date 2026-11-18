# Plan de implementación — `notifications`

- **Responsable:** Jorge Flores
- **Orden:** 7 de [`backlog-desgloce.md`](../backlog-desgloce.md)
- **Estado:** en revisión. Ninguna decisión aprobada. **Bloqueado en parte:** falta elegir el canal y el proveedor de envío (N1).
- **Depende de:** [`plan-citas.md`](./plan-citas.md) (`IAppointmentEvents`), `patients` (ya implementado) y, para `[nombre de la clínica]`, [`plan-institucion.md`](./plan-institucion.md).
- **Detalle de endpoints:** [`backlog.md` § `notifications`](../backlog.md#notifications)
- **Contrato del frontend:** `front/src/modules/notifications/types/notification.types.ts` (`NotificationLog`, `NotificationTemplate`, `notificationVariables`) y `api/notifications.api.ts`.

## 1. Objetivo y alcance

- **Plantilla:** leer y guardar el mensaje, con sus variables.
- **Registro de notificaciones:** la pantalla de reporte y "cliente notificado" en el detalle de la cita.
- **Envío automático** al crear una cita (`confirmacion_cita`) y al cancelarla (`cancelacion_cita`), solo si el paciente tiene las notificaciones activas.
- **Recordatorios** (`recordatorio_cita`) antes de la cita, con una tarea en segundo plano.

**Fuera de alcance hasta decidir N1:** la integración con un proveedor real. El plan deja todo listo detrás de una interfaz (`INotificationSender`), de modo que conectar el proveedor sea un archivo nuevo más su configuración.

## 2. Decisiones

| # | Decisión | Propuesta |
|---|---|---|
| N1 | Canal y proveedor | **Por definir con la clínica.** Solo el 4 % de los pacientes tiene correo y el 92 % tiene celular, así que el canal útil es SMS o WhatsApp. Opciones a evaluar cuando se decida: Twilio, Infobip, la API de WhatsApp Business de Meta, o un proveedor local de SMS. Cada una tiene costos por mensaje. |
| N2 | Sin proveedor configurado | En desarrollo, `LogNotificationSender` escribe el mensaje en el log y lo marca `enviada`. En producción sin proveedor, **no se registra nada** (solo un aviso en el log), para no mostrar "cliente notificado" cuando no se envió. |
| N3 | No frenar la cita | Al crear o cancelar una cita, la notificación se guarda como **pendiente** en la misma transacción, y una tarea en segundo plano la envía unos segundos después. La cita nunca falla ni se demora por el proveedor, y si la API se reinicia, la pendiente no se pierde. Las pendientes no salen en `GET /notifications`, porque el frontend solo conoce `enviada` y `fallida`. |
| N4 | Canal por paciente | Celular si tiene teléfono (SMS o WhatsApp, según N1); si no, correo; si no tiene ninguno, no se notifica. |
| N5 | Recordatorios | Cada 15 minutos, la tarea busca citas `programada` o `confirmada` que empiezan dentro de `Notifications:ReminderHoursBefore` (24 h) y no tienen recordatorio, y crea uno pendiente. |
| N6 | Plantilla | **Una sola** para los tres tipos, como en el frontend. El mensaje enviado se guarda ya armado en el registro, para saber qué se le dijo al paciente. Máximo 1000 caracteres; el editor debería avisar que un SMS tiene 160 (cambio en el frontend). |
| N7 | Conflicto de rol | `/notificaciones` es para `admin` y `recepcion`, pero el detalle de la cita, que ven los tres roles, pide `GET /notifications?appointmentId=`. Propuesta: esa variante (solo la de una cita) se abre a los tres roles. |

## 3. Archivos

### Nuevos

```text
back/docs/plan-notificaciones.md                      ← este plan (se borra al terminar)
back/src/ClinicApp.Api/Modules/Notifications/
├── NotificationEntities.cs           ← NotificationLog, NotificationTemplate, tipos, canales y estados
├── NotificationConfiguration.cs      ← tablas, CHECK, índices
├── NotificationDtos.cs               ← NotificationLogDto, TemplateDto, TemplateRequest, NotificationQuery
├── TemplateRenderer.cs               ← reemplaza las variables (fecha y hora en español, en hora de la clínica)
├── INotificationSender.cs            ← interfaz del proveedor; LogNotificationSender para desarrollo (N2)
├── AppointmentNotifications.cs       ← implementa IAppointmentEvents: crea la pendiente (N3, N4)
├── NotificationDispatcher.cs         ← tarea en segundo plano: envía pendientes y crea recordatorios (N5)
└── NotificationsController.cs        ← /api/notifications
back/src/ClinicApp.Api/Data/Migrations/<fecha>_CrearNotificaciones.cs (+ .Designer.cs)
```

### Modificados

| Archivo | Cambio |
|---|---|
| `Data/AppDbContext.cs` | `DbSet` de las 2 tablas |
| `Program.cs` | Registrar el sender según `Notifications:Provider`, `AppointmentNotifications` y `NotificationDispatcher` |
| `appsettings.json` | `Notifications:Provider` (`log` en desarrollo, vacío en producción), `ReminderHoursBefore` = 24 |
| `ClinicApp.Api.http`, `docs/*`, `backlog.md`, `backlog-desgloce.md`, `README.md` | Documentación; variables del proveedor cuando exista |

## 4. Entidades

### `NotificationTemplate` → tabla `notification_templates` (una fila)

| Atributo | Tipo C# | Columna | Reglas |
|---|---|---|---|
| `Id` | `Guid` | `uuid` PK | Fijo |
| `Message` | `string` | `varchar(1000)` | 10 a 1000 |
| `UpdatedAt` | `DateTime` | `timestamptz` | |
| `UpdatedByUserId` | `Guid?` | `uuid` FK → `users` (set null) | |

La migración inserta el mensaje predeterminado del mock.

### `NotificationLog` → tabla `notification_logs`

| Atributo | Tipo C# | Columna | Reglas |
|---|---|---|---|
| `Id` | `Guid` | `uuid` PK | |
| `PatientId` | `Guid` | `uuid` FK → `patients` (restrict) | |
| `AppointmentId` | `Guid?` | `uuid` FK → `appointments` (restrict) null | Índice |
| `Type` | `string` | `varchar(25)` | 3 tipos (`CHECK`). Único `(appointment_id, type)`: no se repite el mismo aviso para una cita. |
| `Channel` | `string` | `varchar(10)` | `email`, `sms` (más `whatsapp` si se elige en N1) |
| `Status` | `string` | `varchar(10)` | `pendiente` (interno, N3), `enviada`, `fallida` |
| `Recipient` | `string` | `varchar(254)` | Teléfono o correo usado. No se expone. |
| `Message` | `string` | `varchar(1000)` | Mensaje ya armado (N6). No se expone. |
| `Error` | `string?` | `varchar(500)` null | Motivo de la falla, para el log |
| `Attempts` | `int` | `integer` | Se reintenta hasta 3 veces; después, `fallida` |
| `CreatedAt` | `DateTime` | `timestamptz` | |
| `SentAt` | `DateTime?` | `timestamptz` null | Índice. Se expone como `sentAt`. |

## 5. Endpoints

| Método y ruta | Roles | Respuesta | Errores |
|---|---|---|---|
| `GET /api/notifications?page&pageSize&search&dateFrom&dateTo` | `admin`, `recepcion` | `200` paginado `NotificationLog`, del más reciente al más antiguo. `search`: nombre o cédula del paciente. Fechas inclusivas en hora de la clínica. | `400` fechas inválidas |
| `GET /api/notifications?appointmentId=` | Los tres (N7) | `200` `NotificationLog[]` (sin paginar, como espera el frontend) | |
| `GET /api/notifications/template` | `admin`, `recepcion` | `200` `{ id, message, updatedAt }` | |
| `PUT /api/notifications/template` | `admin`, `recepcion` | `200` | `400` mensaje corto o largo |

## 6. Reglas de negocio

**Variables de la plantilla:**

| Variable | Valor |
|---|---|
| `[nombre del cliente]` | Nombres y apellidos del paciente |
| `[nombre de la clínica]` | `institutions.name` |
| `[fecha de la cita]` | "12 de septiembre", en hora de la clínica |
| `[hora de la cita]` | "10:00 am" |
| `[profesional]` | Nombre del profesional |

**Envío (`NotificationDispatcher`):**
- Toma las pendientes, de la más antigua a la más nueva, y llama a `INotificationSender`.
- Si sale bien: `enviada` con `sentAt`. Si falla: reintenta en la siguiente vuelta; al tercer intento, `fallida`.
- Si la cita se canceló antes de enviar su confirmación, la confirmación pendiente se descarta.

**Recordatorios (N5):** solo si el paciente tiene las notificaciones activas en ese momento. Una cita cancelada no recibe recordatorio.

## 7. Migración

`CrearNotificaciones`: crea las dos tablas y la plantilla predeterminada.

## 8. Pruebas

- **Roles:**
  - `medico` recibe `403` en la lista y en la plantilla;
  - `GET ?appointmentId=` funciona para los tres.
- **Plantilla:** leer, guardar y el `400` por largo.
- **Envío automático:**
  - crear una cita de un paciente con las notificaciones activas: se crea la pendiente, y a los segundos queda `enviada` con el mensaje armado (sender de log);
  - un paciente sin notificaciones no recibe nada;
  - cancelar la cita: llega `cancelacion_cita`;
  - con un sender que falla: 3 intentos y luego `fallida`.
- **Recordatorio:** una cita en 23 h recibe uno solo, aunque la tarea corra varias veces.
- **Lista:** paginación, búsqueda por nombre y cédula, rango de fechas; no muestra pendientes.
- **Producción sin proveedor:** no se registra nada y queda un aviso en el log.
- **Regresión:** crear citas no se vuelve más lento.

## 9. Al terminar

- **Anotar como pendientes:**
  - la decisión del proveedor (N1) y su integración;
  - el aviso de 160 caracteres en el editor (N6);
  - el mismo proveedor de correo para la recuperación de contraseña de `auth`.
- Actualizar `estructura-base.md` y `endpoints-api.md`.
- Commit. Borrar este plan.
