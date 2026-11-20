# Plan 4 — Agenda: profesionales, consultorios, citas y bloqueos

## Objetivo

El calendario `/citas`, sus diálogos y los catálogos de profesionales y consultorios, contra la API (`endpoints-api.md` § 8 y § 9).

**Módulo del conmutador:** `agenda`. **Necesita:** el plan 3, porque una cita necesita un paciente real.

## Mocks que se deshabilitan

| Mock (`appointments.api.ts`) | Qué simula | Se reemplaza por |
|---|---|---|
| `toIsoRange`: arma `start`/`end` con la **zona del navegador** | Conversión de hora | El back recibe `date` + `startTime`/`endTime` y convierte con la zona de la clínica (`America/Guayaquil`) |
| `findAppointmentConflict` y `findScheduleBlockConflict` | Choques con citas y bloqueos, con los 4 mensajes | `409` con `errors.startTime` y los mismos mensajes, más un candado de PostgreSQL para dos agendamientos simultáneos. **No se copia** al `*.http.ts`. |
| `listMock` (todas las citas) | Agenda | `GET /appointments?from&to` con el **rango visible** del calendario (sin rango, el back devuelve **todas**) |
| `listByPatientMock` | Citas del paciente | `GET /appointments?patientId=` (de la más reciente a la más antigua) |
| `getMock`, `createMock`, `updateMock` | Detalle, alta y edición | `GET`, `POST` y `PUT /appointments/:id` (`409` si la cita no es editable) |
| `updateStatusMock` | Cambio de estado | `PATCH /appointments/:id/status`, con las transiciones validadas en el back (`409` si no se permite) |
| `listProfessionalsMock`, `listRoomsMock` (`mockProfessionals`, `mockRooms`) | Catálogos fijos | `GET /professionals` y `GET /rooms` (devuelven **también los inactivos**) |
| `listScheduleBlocksMock`, `createScheduleBlockMock`, `removeScheduleBlockMock` | Bloqueos | `GET /schedule-blocks?from&to`, `POST` y `DELETE /schedule-blocks/:id` |
| `notifyAppointmentEvent` → `notificationsApi.logAppointmentEvent` (`appointments.queries.ts:60-68`) | Registrar la notificación al crear o cancelar | **Se quita en modo API.** El back guarda la notificación en la misma transacción de la cita y la envía en segundo plano. Solo queda invalidar `notificationsKeys` después de crear o cancelar. |

## Diferencias de contrato

| Punto | Frontend | API | Resuelve |
|---|---|---|---|
| `Professional.active`, `Professional.userId` | No existen | `active: boolean`, `userId: string \| null` | Front: sumarlos al tipo |
| `Room.active` | No existe | `boolean` | Front: sumarlo |
| Selectores | Muestran todos | La lista trae inactivos | Front: `appointment-form-dialog.tsx`, `schedule-block-form-dialog.tsx`, `step-reason.tsx` y `sterilization-cycle-form-dialog.tsx` muestran **solo activos** para elegir. Las vistas de lectura siguen resolviendo nombres con la lista completa. |
| `treatmentId`, `roomId`, `notes` | `undefined` si no hay | `null` | Mapeo en `appointments.http.ts` |
| Hora mostrada | `new Date(start)` en la zona del navegador | ISO en UTC | Front: formatear con `America/Guayaquil`, como ya hace la mensajería. Si un equipo de la clínica tiene otra zona, la agenda se correría. |
| Choques | Mismos 4 mensajes | Iguales | Coinciden |
| `PUT` del profesional | — | Devuelve `futureAppointments` | Para la pantalla nueva de profesionales (abajo) |

## Cambios en el frontend

1. **Estándar del plan 0** para `appointments` (citas y bloqueos) y un recurso aparte, `catalogs` (profesionales y consultorios), dentro del mismo módulo.
2. **Rango visible:**
   - `useAppointmentsList(range)` y `useScheduleBlocksList(range)` reciben `{ from, to }` en `YYYY-MM-DD`;
   - el rango sale de `date` + `view` en `appointments-calendar-page.tsx`: el mes completo con sus semanas visibles, la semana con inicio lunes o el día;
   - la clave de consulta incluye el rango, y `keepPreviousData` evita el parpadeo al navegar.
3. **`notification-message-preview.tsx`:** hoy usa `useAppointmentsList()` sin rango. Con la API pasaría a leer **todas** las citas. Se cambia en el plan 8 por un rango (por ejemplo, de hoy a 30 días).
4. **Quitar `notifyAppointmentEvent`** en modo API (ver arriba). En modo mock, mudarlo a `appointments.mock.ts`, dentro de `create` y `updateStatus`.
5. **Errores:** el `409` de choque ya llega con `errors.startTime`. Revisar que `appointment-form-dialog.tsx` use `applyServerFieldErrors`. Con `errors.roomId` en los bloqueos, igual.
6. **Pantallas nuevas (admin):** administrar profesionales y consultorios. El back ya tiene los endpoints y el frontend no tiene la pantalla.
   - **Profesionales:** nombre, especialidad, registro, activo y usuario vinculado. Al desactivar, mostrar "Tiene N citas futuras" con `futureAppointments`.
   - **Consultorios:** nombre y activo.
   - **Ubicación:** sugerida en `/perfil-institucion`, en una pestaña, o en una ruta nueva `/configuracion`. Decidirlo con el diseño. Puede ir en una entrega posterior: no bloquea conectar la agenda, porque el back crea en desarrollo los 3 profesionales y los 3 consultorios del mock.

## Cambios necesarios en el back

Ninguno.

## Verificación

- **Crear una cita a las 09:00:** se ve a las 09:00. En la base queda `14:00Z`.
- **Otra cita del mismo profesional a las 09:15:** error "El profesional ya tiene una cita agendada en ese horario" en la hora de inicio.
- **Dos pestañas agendando el mismo horario a la vez:** una pasa y la otra recibe el error.
- **Navegar semanas y meses:** cada cambio pide solo ese rango (pestaña Red del navegador).
- **Estados:** confirmar, completar, no asistió y cancelar. Una cita cancelada no se puede editar.
- **Bloqueos:** bloquear un consultorio con una cita encima → `409`; sin cita, se crea y se ve rayado.
- **Profesional inactivo** (desde Scalar o la pantalla nueva): no aparece en los selectores, pero sus citas siguen mostrando su nombre.
- **Notificaciones:** al crear la cita aparece en `/notificaciones` como enviada en unos segundos, porque en desarrollo el proveedor es `log`.
- **E2E:** `appointments-*.spec.ts` y `calendar-*.spec.ts`.

## Terminado

- Agenda por rango.
- Choques y estados validados por el back.
- Sin registro de notificaciones desde el frontend.
- Selectores solo con activos.
- Tipos con `active` y `userId`.
