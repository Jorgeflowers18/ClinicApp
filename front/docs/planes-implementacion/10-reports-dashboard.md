# Plan 10 — `reports` e Inicio

## Objetivo

Los 5 reportes de `/reportes` y los indicadores del Inicio (`/`) contra la API (`endpoints-api.md` § 14). Los cálculos pasan del navegador a PostgreSQL.

**Módulo del conmutador:** `reports`. **Necesita:** que estén conectados los módulos que alimentan los números: pacientes, agenda, tratamientos, inventario, notificaciones y finanzas (planes 3 a 9). Si se conecta antes, los reportes muestran la base real y las pantallas el mock, y no coinciden.

## Mocks que se deshabilitan

`reports.api.ts` calcula todo en el navegador importando los datos mock de **seis** módulos:
- `mockPatients`;
- `mockAppointments`, `mockProfessionals`, `mockRooms` y `mockScheduleBlocks`;
- `mockTreatments` y `mockTreatmentAssignments`;
- `mockInventoryItems`, `mockPurchaseOrders`, `mockStockMovements` y `mockSuppliers`;
- `mockNotifications`.

| Mock | Qué calcula | Se reemplaza por |
|---|---|---|
| `getSummaryMock` | Pacientes, citas del periodo, no asistió, tratamientos activos, stock crítico y notificaciones enviadas | `GET /reports/summary?from&to` (los tres roles; lo usa el Inicio) |
| `getAgendaMock` | Citas por día, por estado y ocupación por consultorio | `GET /reports/agenda?from&to` (los tres roles). Agrupa por el **día de la clínica**. |
| `getProductivityMock` | Por profesional | `GET /reports/productivity?from&to` (admin) |
| `getTreatmentsMock` | Por tratamiento, con ingresos estimados | `GET /reports/treatments?from&to` (admin; `estimatedRevenue` provisional) |
| `getInventoryMock` | Críticos, compras y consumo | `GET /reports/inventory?from&to` (admin) |

## Diferencias de contrato

| Punto | Frontend | API | Resuelve |
|---|---|---|---|
| Formas de respuesta | `report.types.ts` | El back se construyó con esos tipos | Coinciden. Verificar con los tipos generados (plan 0). |
| `ReportPeriod` | `{ from, to }` | Obligatorios, inclusivos y de hasta 366 días; `400` si no | Front: el selector de periodo ya limita los presets. Validar el rango personalizado (`period.ts`) y mostrar el `400` si llega. |
| Días del periodo | `eachDayOfInterval` con la zona del navegador | Días de la clínica | Coinciden si el navegador está en Ecuador. El back es la fuente. |
| `activeTreatments` | Cuenta `en_progreso` del mock | Será 0, porque la API solo registra completados (salvo datos importados) | La tarjeta del Inicio (`dashboard-page.tsx:73`) mostraría siempre 0. Decidir con diseño si se cambia por "Tratamientos realizados en el periodo", que necesitaría un campo nuevo en `summary` (back). |
| Fila "Sin consultorio" | El mock la arma con `roomName: "Sin consultorio"` | La misma fila, con `roomId: ""` | Coinciden |
| Exportación CSV | En el navegador, con los datos del reporte | Igual: sale de la respuesta | Sin cambios |

## Cambios en el frontend

1. **Estándar del plan 0:**
   - `reports.contract.ts`, `.http.ts`, `.mock.ts` (los 5 cálculos actuales, con sus importaciones de mocks) y `.api.ts`;
   - pasar `signal` (cambiar de periodo cancela la petición anterior).
2. **Inicio** (`dashboard-page.tsx`): sin cambios de uso (`useReportsSummary` y `useAgendaReport` con el mes actual). Los tres roles pueden pedirlos.
3. **`/reportes`:**
   - ya es solo admin;
   - cada pestaña pide su reporte solo al abrirla (`enabled` por pestaña), para no hacer 5 consultas de golpe;
   - con `keepPreviousData`, el cambio de periodo no deja la pantalla en blanco.
4. **Errores:** un `400` del periodo se muestra junto al selector, no como error genérico.

## Cambios necesarios en el back

Ninguno. Para que el reporte de tratamientos tenga ingresos reales falta la etapa B de finanzas.

## Verificación

- **Datos conocidos:** con datos de desarrollo, crear en un mes sin datos 3 citas (completada, no asistió y cancelada). El resumen da `noShowRate` 0,5 y la agenda muestra el día con 3 citas y 1 cancelada. Es el mismo escenario de `back/tests/…/ReportsTests.cs`.
- **Cita a las 23:30:** cuenta en ese día, no en el siguiente.
- **Médico:** ve el Inicio con números; `/reportes` lo manda a `/403`.
- **Periodo de 400 días:** error junto al selector.
- **E2E:** `dashboard-redesign.spec.ts` y `finance-reports-redesign.spec.ts`.

## Terminado

- Los 5 reportes y el Inicio salen de la API.
- `reports.mock.ts` es el único archivo que importa datos mock de otros módulos.
