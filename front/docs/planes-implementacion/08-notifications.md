# Plan 8 — `notifications`: plantilla, historial, mensajería y alertas globales

## Objetivo

La página `/notificaciones` (plantilla, vista previa e historial), el aviso "cliente notificado" del detalle de la cita y el centro de alertas del encabezado, contra la API (`endpoints-api.md` § 12).

**Módulo del conmutador:** `notifications`. **Necesita:**
- el plan 2, para el nombre de la clínica en el mensaje;
- el plan 3, para los pacientes;
- el plan 4, para las citas.

## Mocks que se deshabilitan

| Mock | Qué simula | Se reemplaza por |
|---|---|---|
| `listMock` + `matchesPatientSearch` (importa `mockPatients`) (`notifications.api.ts`) | Historial con búsqueda por paciente y fechas | `GET /notifications?page&pageSize&search&dateFrom&dateTo` (admin y recepción; búsqueda sin tildes por nombre o cédula; fechas de la clínica, inclusivas) |
| `listByAppointmentMock` | "Cliente notificado" en la cita | `GET /notifications?appointmentId=` (los tres roles) |
| `getTemplateMock` / `updateTemplateMock` | Plantilla | `GET` y `PUT /notifications/template` (`message` de 10 a 1000) |
| `logAppointmentEventMock` / `logAppointmentEventReal` (devuelve `null`) | Crear la notificación desde el frontend | **Se borra del contrato.** El back la crea al crear o cancelar la cita, crea los recordatorios 24 h antes y las envía en segundo plano. |
| `mockNotifications`, `mockNotificationTemplate` | Datos | Solo modo mock (`reports.api.ts` también importa `mockNotifications`: plan 10) |
| `use-alert-reads.ts`: alertas leídas en `localStorage` por usuario | "Marcar como leída" | **Se queda:** es una preferencia del navegador, no un dato de la clínica. Opcional a futuro: guardarlo en el back por usuario. |

## Diferencias de contrato

| Punto | Frontend | API | Resuelve |
|---|---|---|---|
| `NotificationLog.appointmentId` | Opcional | Siempre viene | Coinciden |
| Notificaciones pendientes | El mock solo tiene enviadas y fallidas | Las pendientes **no** salen en la API | Coinciden: la UI no cambia |
| Sin proveedor (producción, por ahora) | — | No se registra ninguna notificación | Front: la página puede mostrar "El envío automático aún no está configurado" si la lista está vacía. Es opcional; depende de la decisión del proveedor. |
| Variables de la plantilla | Las 5 de `notificationVariables` | Las mismas 5, reemplazadas igual ("12 de septiembre", "10:00 am") | Coinciden. `resolveAppointmentMessage` (vista previa) y el back deben dar el mismo texto. |
| Mensaje enviado | No se guarda en `NotificationLog` | ✅ `message`: el texto enviado, ya armado | Front: sumarlo al tipo y mostrarlo en el detalle del historial |
| Nombre del paciente | Se busca en `mockPatients` | ✅ `patientName` en cada notificación | Front: sumarlo al tipo y usarlo en la tabla, sin pedir cada paciente |

## Cambios en el frontend

1. **Estándar del plan 0:**
   - `notifications.contract.ts` (`list`, `listByAppointment`, `getTemplate` y `updateTemplate`), `.http.ts`, `.mock.ts` y `.api.ts`;
   - `logAppointmentEvent` queda solo dentro de `appointments.mock.ts` (plan 4).
2. **Historial** (`notifications-report-page.tsx`): enviar `search`, `dateFrom` y `dateTo` al back, con `signal`. El nombre de cada fila sale de `patientName`, así que `useMessagingCatalog` ya no hace falta en esa página.
3. **Mensajería y vista previa** (`notification-message-preview.tsx`, `prepare-appointment-message.ts`):
   - el selector de citas usa `useAppointmentsList({ from: hoy, to: hoy + 30 días })` en lugar de todas las citas (plan 4);
   - el nombre de la clínica sale de la consulta del perfil (plan 2);
   - `useMessagingCatalog` deja de leer **todos** los pacientes: el paciente de la cita se pide con `usePatient(appointment.patientId)`, que ya se hace.
4. **Centro de alertas** (`use-global-alerts.ts`). Hoy, cada 5 minutos, lee:
   - **todos** los pacientes (para cumpleaños y nombres);
   - **todas** las citas;
   - **todo** el inventario;
   - **todo** el historial de notificaciones.

   Con datos reales son decenas de peticiones por usuario. En modo API se reemplaza todo por **una sola petición**, `GET /alerts`, cada 5 minutos:
   - `buildGlobalAlerts` arma las alertas desde la respuesta:
     - `appointmentsToday` ya trae `patientName`;
     - `birthdaysToday`;
     - `criticalItems`, con `unit` para `inventoryUnit`;
     - `failedDeliveries`, con `patientName`;
   - los ids de las alertas siguen igual (`inventory:…`, `delivery:…`, `appointment:…`, `birthday:…`), para que `use-alert-reads.ts` conserve las leídas;
   - el médico recibe `criticalItems` y `failedDeliveries` vacíos, así que `canManage` deja de decidir qué se pide.
5. **`collectAlertPages`** se borra en modo API. Donde quede un uso, se reemplaza por `fetchAllPages` (plan 0).
6. **Editor de la plantilla:** avisar cuando el mensaje armado pasa de 160 caracteres, el largo de un SMS. Usar la vista previa con datos reales, porque las variables cambian el largo.
7. **Invalidaciones:** después de crear o cancelar una cita, invalidar `notificationsKeys.byAppointment(id)` con unos segundos de retraso, o volver a consultar al abrir el detalle, porque el envío es en segundo plano (cada 10 s en desarrollo).

## Cambios necesarios en el back

✅ **Hecho** (`d0aeeed`; `endpoints-api.md` § 12):
- **`GET /api/alerts`** (los tres roles):

  ```json
  {
    "date": "2026-11-20",
    "appointmentsToday": [ { "id", "start", "end", "status", "patientId", "patientName", "professionalId", "professionalName" } ],
    "birthdaysToday": [ { "patientId", "patientName", "birthDate" } ],
    "criticalItems": [ { "itemId", "name", "stock", "minStock", "unit" } ],
    "failedDeliveries": [ { "id", "patientId", "patientName", "appointmentId", "channel", "type", "sentAt" } ]
  }
  ```

  - Las citas son las programadas o confirmadas que empiezan hoy, en el día de la clínica.
  - Los cumpleaños son de pacientes activos; los del 29 de febrero se muestran el 28 en los años no bisiestos.
  - Inventario y envíos fallidos (últimos 7 días) solo para admin y recepción.
- **`patientName` y `message`** en cada notificación del historial. El destinatario no se expone.

Ya no queda nada del back para este plan.

## Verificación

- **Plantilla:** editarla y guardarla; recargar: se mantiene. Con 5 caracteres, error en `message`.
- **Cita nueva:** a los segundos aparece en el historial como enviada (proveedor `log` en desarrollo) y el detalle de la cita muestra "cliente notificado".
- **Cancelar:** aparece la cancelación y la confirmación pendiente se descarta.
- **Búsqueda:** "gonzalez" encuentra a "González"; el rango de fechas filtra.
- **Médico:** ve "cliente notificado" en la cita, pero no entra a `/notificaciones`.
- **Alertas:** con los datos de desarrollo aparecen las citas de hoy y el stock crítico. En la pestaña Red no hay listados completos cada 5 minutos.
- **E2E:** `messaging-*.spec.ts`.

## Terminado

- Plantilla e historial en la API.
- El frontend no registra notificaciones.
- Mensajería y alertas sin leer listados completos: el centro de alertas usa `GET /alerts`.
