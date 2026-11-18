# Plan de implementación — `reports`

- **Responsable:** Jorge Flores
- **Orden:** 9 de [`backlog-desgloce.md`](../backlog-desgloce.md), el último: calcula sobre los datos de todos los demás módulos.
- **Estado:** en revisión. Ninguna decisión aprobada.
- **Depende de:** pacientes, citas, bloqueos, tratamientos realizados, inventario y notificaciones.
- **Detalle de endpoints:** [`backlog.md` § `reports`](../backlog.md#reports), con la fórmula de cada indicador.
- **Contrato del frontend:** `front/src/modules/reports/types/report.types.ts` y `api/reports.api.ts`. Las funciones `*Mock` calculan en memoria lo que la API debe calcular en SQL.

## 1. Objetivo y alcance

Los 5 reportes por periodo:
- **Resumen:** indicadores del Inicio y de Reportes.
- **Agenda:** por día, por estado y ocupación por consultorio.
- **Productividad:** por profesional.
- **Tratamientos.**
- **Inventario.**

Todos se calculan **en la base de datos**, sin traer las filas a memoria.

## 2. Decisiones

| # | Decisión | Propuesta |
|---|---|---|
| R1 | Conflicto de rol con el Inicio | El Inicio lo ven los tres roles y llama a `GET /reports/summary` y `GET /reports/agenda`. Ninguno de los dos muestra dinero, así que se **abren esos dos a los tres roles**. Productividad, tratamientos (trae ingresos) e inventario quedan solo para `admin`. El frontend no cambia. |
| R2 | Periodo | `from` y `to` obligatorios, `YYYY-MM-DD`, **inclusivos**, en hora de la clínica. Se convierten al rango UTC `[from 00:00, to + 1 día 00:00)` con `ClinicClock`. Máximo 366 días; `from > to` o más de 366: `400`. |
| R3 | Etiquetas | La API devuelve las etiquetas en español, como el mock: "lun 12" para los días (`EEE d`) y los nombres de los estados. Los días se arman con una lista propia (`lun`, `mar`…), porque .NET agrega un punto ("lun.") que el mock no tiene. |
| R4 | Ingresos estimados | Σ `price` de los tratamientos realizados del periodo. Es **provisional**: se reemplaza por los pagos reales cuando la facturación (finanzas, etapa B) exista. El nombre `estimatedRevenue` ya lo indica. |
| R5 | Asignaciones "activas" | Cuenta `en_progreso`. Como la API solo registra tratamientos `completado`, será 0 salvo en datos importados. Se mantiene por contrato. |

## 3. Archivos

### Nuevos

```text
back/docs/plan-reportes.md                          ← este plan (se borra al terminar)
back/src/ClinicApp.Api/Modules/Reports/
├── ReportDtos.cs                 ← ReportsSummary, AgendaReport, ProductivityReport, TreatmentsReport, InventoryReport (formas de report.types.ts)
├── ReportPeriod.cs               ← validación y conversión del periodo (R2)
├── ReportQueries.cs              ← una consulta agrupada por reporte
└── ReportsController.cs          ← /api/reports
```

### Modificados

| Archivo | Cambio |
|---|---|
| Configuraciones de citas, pacientes y movimientos | Índices que falten para los filtros por fecha (`appointments.start`, `patients.created_at`, `notification_logs.sent_at`, `stock_movements (type, created_at)`), si no existen ya |
| `ClinicApp.Api.http`, `docs/*`, `backlog.md`, `backlog-desgloce.md` | Documentación |

No hay tablas nuevas. Si faltan índices, va una migración `IndicesReportes`.

## 4. Endpoints

Todos con `?from=YYYY-MM-DD&to=YYYY-MM-DD`.

| Método y ruta | Roles | Respuesta (`report.types.ts`) |
|---|---|---|
| `GET /api/reports/summary` | Los tres (R1) | `ReportsSummary` |
| `GET /api/reports/agenda` | Los tres (R1) | `AgendaReport` |
| `GET /api/reports/productivity` | `admin` | `ProductivityReport` |
| `GET /api/reports/treatments` | `admin` | `TreatmentsReport` |
| `GET /api/reports/inventory` | `admin` | `InventoryReport` |

Errores: `400` periodo inválido (R2); `403` según el rol.

## 5. Cálculos

| Reporte | Indicador | Cálculo |
|---|---|---|
| Resumen | `patientsTotal` | Pacientes activos (sin baja), sin importar el periodo |
| | `patientsNewInPeriod` | `patients.created_at` en el periodo |
| | `appointmentsInPeriod` / `Completed` / `NoShow` | Citas con `start` en el periodo, todas o por estado |
| | `noShowRate` | `noShow / (completadas + noShow)`; 0 si no hay |
| | `activeTreatments` | Asignaciones `en_progreso` (R5) |
| | `criticalStockItems` | Insumos con `stock <= min_stock` |
| | `notificationsSent` | `enviada` con `sent_at` en el periodo |
| Agenda | `byDay` | Todos los días del periodo, también los vacíos (en cero), con total, completadas, no asistió y canceladas |
| | `byStatus` | Los 5 estados, también los que están en cero |
| | `occupancyByRoom` | Por consultorio: minutos reservados (citas no canceladas) y bloqueados (recortados al periodo). Más una fila "Sin consultorio" (`roomId: ""`) si hay citas sin consultorio. |
| Productividad | por profesional | Programadas, completadas, no asistió, canceladas; `completionRate = completadas / max(1, programadas − canceladas)` |
| Tratamientos | por tratamiento | Citas del periodo con ese tratamiento; asignaciones activas y completadas, y sesiones hechas y planificadas (por `start_date`); `estimatedRevenue` (R4) |
| Inventario | `criticalItems` | Insumos en stock crítico, sin importar el periodo |
| | `purchasesInPeriod` | Órdenes con `created_at` en el periodo, con `total = Σ cantidad × costo` |
| | `purchasesTotal` | Suma de las anteriores, sin las canceladas |
| | `consumptionInPeriod` | Movimientos `salida` del periodo, agrupados por insumo |

## 6. Pruebas

Se cargan datos conocidos con SQL (pacientes, citas en varios estados y días, bloqueos, asignaciones, órdenes y movimientos) y se compara cada número con el esperado calculado a mano.

- **Periodo:**
  - una cita a las 23:30 hora de Ecuador del último día entra en el periodo, aunque en UTC ya sea el día siguiente;
  - `from > to` y más de 366 días: `400`.
- **Roles:** `medico` ve el resumen y la agenda; `403` en los otros tres.
- **Agenda:**
  - los días sin citas salen en cero;
  - un bloqueo que empieza antes del periodo se cuenta solo desde el inicio del periodo;
  - aparece la fila "Sin consultorio".
- **Etiquetas:** "lun 12" y los nombres de los estados.
- **Rendimiento:** con 10 000 citas de prueba, cada reporte responde en menos de 500 ms.

## 7. Al terminar

- **Anotar como pendientes:**
  - los ingresos reales cuando exista la facturación (R4);
  - las sesiones por profesional cuando las asignaciones tengan el profesional.
- Actualizar `endpoints-api.md`.
- Commit. Borrar este plan.
