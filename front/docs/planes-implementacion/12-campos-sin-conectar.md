# Plan 12 — Campos y datos que aún no están conectados al back

## Objetivo

Después de los planes 0 a 10, cada pantalla lee y guarda en la API. Esta lista reúne lo que **todavía no**: campos que se muestran pero no tienen dato real, controles deshabilitados, y lecturas que funcionaban con los datos de demostración pero no con los 820 pacientes reales. Se revisó el 2026-11-22, con todos los planes aplicados y la app probada contra la API, buscando en el código `pageSize: 100`, `localStorage`, textos "no disponible" y campos que la API devuelve vacíos.

Cada punto dice qué se ve hoy, por qué no está conectado y qué hace falta (front, back o una decisión).

## 1. Lecturas que no escalan (urgente antes de importar los 820 pacientes)

| # | Pantalla | Qué pasa hoy | Qué hace falta |
|---|---|---|---|
| 1.1 | Nueva cita y editar cita (`appointment-form-dialog.tsx`) | El selector de paciente carga solo los **primeros 100** (`usePatientsList({ pageSize: 100 })`). El paciente 101 no se puede elegir. | **Front:** selector con búsqueda en el servidor (`GET /patients?search=`), con el paciente actual precargado (`usePatient`). |
| 1.2 | Lista de atenciones `/historial-clinico` | El nombre del paciente de cada fila sale de los primeros 100 pacientes. | **Back:** `patientName` en `EncounterListItemDto` (como ya se hizo en las citas). **Front:** usarlo. |
| 1.3 | Detalle del tratamiento, "Pacientes que recibieron este tratamiento" | Una petición `GET /patients/:id` por cada paciente de la tabla. | **Back:** `patientName` en `TreatmentAssignmentDto`. **Front:** usarlo y quitar el `useQueries`. |
| 1.4 | Historial de notificaciones `/notificaciones` | Lee **todo** el historial (`fetchAllPages`) para calcular los 4 indicadores y filtrar por canal, estado y tipo en el navegador. | **Back:** filtros `channel`, `status` y `type` en `GET /notifications`, y un resumen con los 4 indicadores. **Front:** paginar en el servidor. |
| 1.5 | Archivo clínico: nombres de tratamientos | `clinical-file-manager.tsx` resuelve los nombres con la primera página de 100 del catálogo. | **Front:** usar `references.treatments` de la historia (ya llega con la API). |
| 1.6 | Selectores de insumos (tratamientos, órdenes, esterilización) | `fetchAllPages` junta páginas de 100. Funciona, pero con muchos insumos son varias peticiones. | **Back:** un listado liviano para selectores (`?all=true` o `/inventory/items/options`). |

## 2. Campos que se muestran sin dato real

| # | Dónde | Campo | Situación | Qué hace falta |
|---|---|---|---|---|
| 2.1 | Ficha del paciente, "Última visita" | `lastVisitAt` | El back lo guarda tal cual, sin calcularlo. El front lo calcula con `usePatientLastVisit` (citas e historia), solo para admin y médico. | **Back:** calcularlo desde las atenciones (ya está en `back/backlog-desgloce.md`). |
| 2.2 | Inicio, tarjeta "Tratamientos activos" | `summary.activeTreatments` | La API solo registra tratamientos completados (una sesión), así que con datos reales siempre da 0. | **Decisión de diseño:** cambiarla por "Tratamientos realizados en el periodo" (**back:** campo nuevo en `GET /reports/summary`). |
| 2.3 | Finanzas: "Total vencido", "Próximo vencimiento", cuotas, seguro y factura | `overdue`, `nextDueDate`, `installments`, `insurance`, `invoice` | La API responde 0, `null` y listas vacías hasta la etapa B. Las secciones ya se ocultan cuando vienen vacías, pero "Total vencido" muestra $0 y "Próximo vencimiento", "Sin vencimientos pendientes". | **Decisión de la clínica** (ítem 8: cuotas, seguros y factura electrónica). Mientras tanto, **front:** ocultar "Total vencido" y "Próximo vencimiento" con la API. |
| 2.4 | Reporte de tratamientos | `estimatedRevenue` | Es una estimación (precio × realizados), no lo cobrado. | **Back:** ingresos reales desde los pagos (etapa B de finanzas). |
| 2.5 | Historial de notificaciones, columna Paciente | La cédula debajo del nombre | La API trae `patientName` pero no la cédula: con la API se muestra "—". | **Back:** sumar `patientDocumentId` a la notificación, o **front:** quitar la segunda línea. |
| 2.6 | Lista de pacientes, buscador | El texto dice "nombre, documento, teléfono o correo" | La API busca por nombres, documento, teléfono y N.° de historia, **no por correo**. | **Front:** cambiar el texto, o **back:** buscar también por correo. |

## 3. Controles deshabilitados o sin pantalla

| # | Dónde | Qué | Qué hace falta |
|---|---|---|---|
| 3.1 | Inicio de sesión | Casilla "Recordarme" deshabilitada ("aún no está disponible") | **Decisión:** con la cookie de renovación la sesión ya sobrevive a la recarga (7 días). O se quita la casilla, o el back acepta `rememberMe` para alargar la cookie. |
| 3.2 | Agenda | Administrar profesionales y consultorios (nombre, especialidad, registro, activo, usuario vinculado) | El back tiene `POST`/`PUT /professionals` y `/rooms`; **front:** pantalla nueva (admin). Al desactivar, mostrar "Tiene N citas futuras" (`futureAppointments`). |
| 3.3 | Usuarios | Crear usuarios, asignar rol, desactivar, vincular a un profesional | **Back y front** (está en el backlog). Hoy los usuarios solo salen del `UserSeeder`. |
| 3.4 | Solicitudes de acceso | Se envían (`POST /auth/access-requests`) pero nadie las ve | **Back:** listado y aprobación; **front:** pantalla para el admin. |
| 3.5 | Recuperar contraseña | El enlace solo sale en el log del back | **Back:** proveedor de correo real. |
| 3.6 | Notificaciones | El envío por SMS o WhatsApp | **Decisión de la clínica** (proveedor). En producción, por ahora, no se envía nada. |

## 4. Detalles de comportamiento con la API

| # | Qué | Qué hace falta |
|---|---|---|
| 4.1 | La agenda muestra las horas en la zona del **navegador**; el back guarda en la zona de la clínica (`America/Guayaquil`). Un equipo con otra zona vería la agenda corrida. | **Front:** formatear con la zona de la clínica (necesita adaptar `react-big-calendar`). Bajo riesgo mientras todos los equipos estén en Ecuador. |
| 4.2 | Reportes: un periodo inválido (más de 366 días) da `400`, que hoy se muestra como error genérico. | **Front:** mostrarlo junto al selector de periodo. |
| 4.3 | `GET /notifications` responde `IActionResult`: el OpenAPI no trae su forma y el front la declara a mano (`notifications.http.ts`). | **Back:** `ProducesResponseType` para que salga en los tipos generados. |
| 4.4 | `PageQuery` del back publica `SafePage` y `SafePageSize` como parámetros en el OpenAPI. | **Back:** ocultarlos (`[BindNever]` o propiedades no públicas). |
| 4.5 | Alertas leídas, vista del archivo clínico y tema se guardan en el navegador. | Es intencional (preferencias del navegador). Opcional: guardarlas por usuario en el back. |

## Orden sugerido

1. Punto 1 completo (sin él, la app no sirve con los pacientes reales).
2. 1.5, 2.3, 2.6 y 4.2 (cambios chicos del front).
3. 3.2 y 3.3 (pantallas de administración).
4. Lo que espera decisiones: 2.2, 2.3 (etapa B), 3.1 y 3.6.

## Terminado

- Ningún selector ni lista depende de "los primeros 100".
- Ningún campo visible muestra un valor que la API no calcula.
- Cada control deshabilitado se conectó o se quitó.
