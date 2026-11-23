# Plan 12 — Campos y datos que aún no están conectados al back

## Objetivo

Después de los planes 0 a 10, cada pantalla lee y guarda en la API. Esta lista reúne lo que **todavía no**: campos que se muestran pero no tienen dato real, controles deshabilitados, y lecturas que funcionaban con los datos de demostración pero no con los 820 pacientes reales. Se revisó el 2026-11-22, con todos los planes aplicados y la app probada contra la API, buscando en el código `pageSize: 100`, `localStorage`, textos "no disponible" y campos que la API devuelve vacíos.

Cada punto dice qué se ve hoy, por qué no está conectado y qué hace falta (front, back o una decisión).

## 1. Lecturas que no escalan — ✅ hecho (2026-11-22)

Ningún selector ni lista depende ya de "los primeros 100" ni pide cada paciente por separado:

- **1.1** Nueva cita y editar cita, y el filtro de paciente de `/historial-clinico`: `PatientCombobox` (`modules/patients/components/patient-combobox.tsx`) busca en el servidor (`GET /patients?search=`, 20 resultados) y lee aparte al paciente elegido. El calendario ya no carga pacientes: cada cita trae `patientName`.
- **1.2** `patientName` en `EncounterListItemDto` (back, con prueba); la lista de atenciones lo usa.
- **1.3** `patientName` y `treatmentName` en `TreatmentAssignmentDto` (back, con prueba); el detalle del tratamiento ya no hace un `GET /patients/:id` por fila.
- **1.4** `GET /notifications` filtra por `channel`, `status`, `type` e `id`, y `GET /notifications/summary` da los indicadores (back, con pruebas); la página pagina en el servidor y ya no lee todo el historial.
- **1.5** El archivo clínico nombra los tratamientos con `treatmentName` del tratamiento realizado. La historia (`record-workspace`, `treatment-plan-tab`) usa el catálogo completo (`useTreatmentCatalog`) en vez de la primera página de 100.
- **1.6** `GET /inventory/items/options` (back, con prueba): todos los insumos, solo `{ id, name, unit, kind }`. Lo usan los selectores de tratamientos, órdenes de compra y esterilización (`useInventoryOptions`).

**Queda (no urgente):** la pestaña Insumos y "Stock crítico" de Inventario siguen leyendo el catálogo completo con `fetchAllPages` (necesitan stock, costo y proveedor, y filtran en el navegador); y el catálogo de tratamientos completo (`useTreatmentCatalog`) también se junta en páginas de 100. Con pocos cientos de registros alcanza; si crecen, paginar y filtrar en el servidor.

## 2. Campos que se muestran sin dato real

| # | Dónde | Campo | Situación | Qué hace falta |
|---|---|---|---|---|
| 2.1 | Ficha del paciente, "Última visita" | `lastVisitAt` | El back lo guarda tal cual, sin calcularlo. El front lo calcula con `usePatientLastVisit` (citas e historia), solo para admin y médico. | **Back:** calcularlo desde las atenciones (ya está en `back/backlog-desgloce.md`). |
| 2.2 | Inicio, tarjeta "Tratamientos activos" | `summary.activeTreatments` | La API solo registra tratamientos completados (una sesión), así que con datos reales siempre da 0. | **Decisión de diseño:** cambiarla por "Tratamientos realizados en el periodo" (**back:** campo nuevo en `GET /reports/summary`). |
| 2.3 | Finanzas: "Total vencido", "Próximo vencimiento", cuotas, seguro y factura | `overdue`, `nextDueDate`, `installments`, `insurance`, `invoice` | La API responde 0, `null` y listas vacías hasta la etapa B. Las secciones ya se ocultan cuando vienen vacías, pero "Total vencido" muestra $0 y "Próximo vencimiento", "Sin vencimientos pendientes". | **Decisión de la clínica** (ítem 8: cuotas, seguros y factura electrónica). ✅ **Front, hecho (2026-11-22):** `finance/lib/due-dates.ts` (`showDueDates = false`) oculta "Total vencido", "Seguros pendientes", las columnas Vencido, Próximo venc. y Días mora, el estado y el filtro "Vencida", y en la ficha "Total vencido" y "Próximo vencimiento". Al llegar la etapa B, poner `true`. |
| 2.4 | Reporte de tratamientos | `estimatedRevenue` | Es una estimación (precio × realizados), no lo cobrado. | **Back:** ingresos reales desde los pagos (etapa B de finanzas). |
| 2.5 | Historial de notificaciones, columna Paciente | La cédula debajo del nombre | La API trae `patientName` pero no la cédula: con la API se muestra "—". | **Back:** sumar `patientDocumentId` a la notificación, o **front:** quitar la segunda línea. |
| 2.6 | Lista de pacientes, buscador | El texto dice "nombre, documento, teléfono o correo" | La API busca por nombres, documento, teléfono y N.° de historia, **no por correo**. | ✅ **Front, hecho (2026-11-22):** el texto dice "nombre, documento, teléfono o N.° de historia". Si la clínica quiere buscar por correo, sumarlo en el back. |

## 3. Controles deshabilitados o sin pantalla

| # | Dónde | Qué | Qué hace falta |
|---|---|---|---|
| 3.1 | Inicio de sesión | Casilla "Recordarme" deshabilitada ("aún no está disponible") | **Decisión:** con la cookie de renovación la sesión ya sobrevive a la recarga (7 días). O se quita la casilla, o el back acepta `rememberMe` para alargar la cookie. |
| 3.2 | Agenda | Administrar profesionales y consultorios (nombre, especialidad, registro, activo, usuario vinculado) | ✅ **Front, hecho (2026-11-22):** `/administracion` (solo admin, en el menú de usuario) con las pestañas Profesionales y Consultorios: alta, edición y activo. Al desactivar un profesional con citas futuras se avisa "Tiene N citas futuras". El usuario vinculado se conserva al guardar; se elige en la pestaña Usuarios (3.3). |
| 3.3 | Usuarios | Crear usuarios, asignar rol, desactivar, vincular a un profesional | ✅ **Back y front, hecho (2026-11-22):** `api/users` (solo admin) y la pestaña Usuarios de `/administracion`: crear la cuenta con un enlace de un solo uso para elegir la contraseña (72 h), rol, profesional vinculado, desactivar y "Generar enlace de contraseña". El admin no se desactiva ni se quita el rol; desactivar o cambiar el rol cierra las sesiones (el access token vigente dura hasta 15 min, aceptado). |
| 3.4 | Solicitudes de acceso | Se envían (`POST /auth/access-requests`) pero nadie las ve | **Back:** listado y aprobación; **front:** pantalla para el admin. |
| 3.5 | Recuperar contraseña | El enlace solo sale en el log del back | **Back:** proveedor de correo real. |
| 3.6 | Notificaciones | El envío por SMS o WhatsApp | **Decisión de la clínica** (proveedor). En producción, por ahora, no se envía nada. |

## 4. Detalles de comportamiento con la API

| # | Qué | Qué hace falta |
|---|---|---|
| 4.1 | La agenda muestra las horas en la zona del **navegador**; el back guarda en la zona de la clínica (`America/Guayaquil`). Un equipo con otra zona vería la agenda corrida. | **Front:** formatear con la zona de la clínica (necesita adaptar `react-big-calendar`). Bajo riesgo mientras todos los equipos estén en Ecuador. |
| 4.2 | Reportes: un periodo inválido (más de 366 días) da `400`, que hoy se muestra como error genérico. | ✅ **Front, hecho (2026-11-22):** `periodError` (`reports/lib/period.ts`, las mismas reglas del back) muestra el error junto a las fechas, con el campo marcado; las pestañas siguen con el último periodo válido y no se pide el inválido. Un `400` del servidor con `errors.from`/`errors.to` se muestra igual. |
| 4.3 | `GET /notifications` responde `IActionResult`: el OpenAPI no trae su forma y el front la declara a mano (`notifications.http.ts`). | **Back:** `ProducesResponseType` para que salga en los tipos generados. |
| 4.4 | `PageQuery` del back publica `SafePage` y `SafePageSize` como parámetros en el OpenAPI. | **Back:** ocultarlos (`[BindNever]` o propiedades no públicas). |
| 4.5 | Alertas leídas, vista del archivo clínico y tema se guardan en el navegador. | Es intencional (preferencias del navegador). Opcional: guardarlas por usuario en el back. |

## Orden sugerido

1. ~~Punto 1 completo~~ ✅ (2026-11-22).
2. ~~2.3, 2.6 y 4.2~~ ✅ (2026-11-22).
3. ~~3.2 y 3.3~~ ✅ (2026-11-22).
4. Lo que espera decisiones: 2.2, 2.3 (etapa B), 3.1 y 3.6.

## Terminado

- Ningún selector ni lista depende de "los primeros 100".
- Ningún campo visible muestra un valor que la API no calcula.
- Cada control deshabilitado se conectó o se quitó.
