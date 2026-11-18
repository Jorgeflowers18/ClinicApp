# Plan de implementación — `finance`

- **Responsable:** Jorge Flores
- **Orden:** 8 de [`backlog-desgloce.md`](../backlog-desgloce.md)
- **Estado:** en revisión. **F1 (pagos en la etapa A) y F5 (el médico no ve montos) aprobadas** (2026-11-17). Cuotas, seguros y facturación esperan el diseño del ítem 8 en el frontend.
- **Depende de:** los tratamientos realizados (ya implementados: el costo cobrado de cada uno) y `patients` (ya implementado).
- **Detalle de endpoints:** [`backlog.md` § `finance`](../backlog.md#finance)
- **Contrato del frontend:** `front/src/modules/finance/types/finance.types.ts` (`FinancialPortfolioRow`, `FinancialSummary`, `PatientFinancialSummary`). **No hay funciones `*Real`:** `finance.api.ts` llama directo a los cálculos del mock (`finance.mock-data.ts`), así que hay que crear el par Mock/Real.

## 1. Objetivo y alcance

Los 3 endpoints de lectura que usan la pantalla Finanzas, la ficha del paciente y el detalle del tratamiento:
- la cartera activa;
- el resumen de un tratamiento (opcionalmente de un paciente);
- el resumen de un paciente.

**El problema:** sin pagos registrados, toda la cartera aparece como deuda. Las pantallas para registrar pagos no existen todavía (ítem 8 del backlog de producto). Por eso este plan crea la tabla de pagos y los endpoints para registrarlos (F1, aprobada).

**No confundir con el cobro del servicio:** aquí se registran los pagos que **los pacientes hacen a la clínica** por sus tratamientos. El cobro a las clínicas por usar ClinicApp (suscripción, plan, habilitar o suspender el acceso) es otra cosa, **no se crea por ahora** y está anotado en [`plan-multiclinica.md`](./plan-multiclinica.md) § 9.

## 2. Decisiones

| # | Decisión | Propuesta |
|---|---|---|
| F1 | En qué orden | ✅ **Aprobada.** **Dos etapas.** **Etapa A (este plan):** se crea la tabla de pagos y un endpoint mínimo para registrarlos y anularlos (`admin`, `recepcion`), más los 3 resúmenes calculados con los pagos reales. **Etapa B (después del diseño del ítem 8):** cuotas, seguros y factura electrónica del SRI, con su propio plan. Sin la etapa A, la cartera sería inútil: todos deberían todo. |
| F2 | Unidad de la cartera | **Una fila por paciente + tratamiento,** como espera `FinancialPortfolioRow`, sumando el costo cobrado (`price`) de **todas** sus asignaciones. El mock tomaba solo la más reciente, y eso subestimaba la deuda de quien se hizo el mismo tratamiento dos veces. |
| F3 | A qué se aplica un pago | A un paciente + tratamiento, como `FinancialPayment` en el frontend. Si el paciente tiene el mismo tratamiento varias veces, el pago cubre el total de ese par (F2). |
| F4 | Estado de la fila | `al_dia` si no hay saldo; `vencida` si hay saldo vencido; `parcial` en los demás casos. Mientras no existan cuotas (etapa B) no hay vencimientos: el saldo es `parcial` y `nextDueDate` es `null`. |
| F5 | Conflicto de rol | ✅ **Aprobada.** La ficha del paciente y el detalle del tratamiento (visibles para los tres roles) muestran el resumen financiero, pero Finanzas es solo para `admin` y `recepcion`. Propuesta: el médico **no** ve montos. Los resúmenes responden `403` para `medico` y el frontend oculta esos bloques para ese rol (cambio pendiente). |
| F6 | Pagos anulados | Un pago no se borra: se anula (`status = anulado`, con motivo) y deja de contar. Queda el registro de quién lo hizo y cuándo. |

## 3. Archivos

### Nuevos

```text
back/docs/plan-finanzas.md                          ← este plan (se borra al terminar)
back/src/ClinicApp.Api/Modules/Finance/
├── FinancialPayment.cs           ← entidad, métodos y estados de pago
├── FinanceConfiguration.cs       ← tabla, CHECK, índices
├── FinanceDtos.cs                ← PortfolioRowDto, FinancialSummaryDto, PatientFinancialSummaryDto, PaymentRequest, VoidPaymentRequest
├── FinanceCalculator.cs          ← totales por paciente + tratamiento en SQL (una consulta agrupada)
├── FinanceController.cs          ← /api/finance (resúmenes)
└── PaymentsController.cs         ← /api/finance/payments (etapa A)
back/src/ClinicApp.Api/Data/Migrations/<fecha>_CrearPagos.cs (+ .Designer.cs)
```

### Modificados

| Archivo | Cambio |
|---|---|
| `Data/AppDbContext.cs` | `DbSet<FinancialPayment>` |
| `ClinicApp.Api.http`, `docs/*`, `backlog.md`, `backlog-desgloce.md` | Documentación |

## 4. Entidad

### `FinancialPayment` → tabla `financial_payments`

| Atributo | Tipo C# | Columna | Reglas |
|---|---|---|---|
| `Id` | `Guid` | `uuid` PK | |
| `PatientId` | `Guid` | `uuid` FK → `patients` (restrict) | Índice `(patient_id, treatment_id)` |
| `TreatmentId` | `Guid` | `uuid` FK → `treatments` (restrict) | El paciente debe tener al menos un tratamiento realizado de ese tipo |
| `Date` | `DateOnly` | `date` | No futura |
| `Amount` | `decimal` | `numeric(10,2)` | Mayor que 0 |
| `Method` | `string` | `varchar(20)` | Los 7 métodos de `PaymentMethod` (`CHECK`) |
| `Reference` | `string` | `varchar(100)` | N.° de transferencia, voucher… |
| `Observations` | `string` | `varchar(500)` | |
| `Status` | `string` | `varchar(10)` | `registrado`, `anulado`, `reversado` (`CHECK`) |
| `VoidReason` | `string?` | `varchar(300)` null | Obligatorio al anular (F6) |
| `RegisteredByUserId` | `Guid?` | `uuid` FK → `users` (set null) | Se expone como `registeredBy` (nombre) |
| `CreatedAt` / `VoidedAt` | `DateTime` / `DateTime?` | `timestamptz` | |

## 5. Endpoints

Roles: `admin` y `recepcion` (F5).

| Método y ruta | Respuesta | Errores |
|---|---|---|
| `GET /api/finance/portfolio` | `200` `FinancialPortfolioRow[]`, solo filas con saldo, de la mayor deuda a la menor | |
| `GET /api/finance/treatments/:treatmentId/summary?patientId=` | `200` `FinancialSummary`. `installments: []`, `insurance: null`, `invoice: null` hasta la etapa B. | `404` tratamiento o paciente; `400` sin `patientId` si el tratamiento lo recibió más de un paciente |
| `GET /api/finance/patients/:patientId/summary` | `200` `PatientFinancialSummary` | `404` |
| `POST /api/finance/payments` | `201` `FinancialPayment` | `400` monto, método, fecha, o un tratamiento que el paciente no tiene. `409` si el pago supera el saldo pendiente. |
| `POST /api/finance/payments/:id/void` `{ reason }` | `200` | `404`; `409` si ya está anulado |

## 6. Reglas de negocio

Para cada paciente + tratamiento:
- **Total** = Σ `price` de sus asignaciones (el precio del catálogo si `price` falta).
- **Pagado** = Σ pagos `registrado`.
- **Pendiente** = máx(total − pagado, 0).
- **Vencido** = 0 hasta que existan cuotas.
- **Responsabilidad del paciente** = total − cobertura del seguro (0 hasta la etapa B).

Todo se calcula en una sola consulta agrupada en PostgreSQL, no en memoria.

## 7. Migración

`CrearPagos`: crea `financial_payments` con sus `CHECK` y sus índices.

## 8. Pruebas

- **Roles:** `medico` recibe `403` en todo (F5).
- **Cartera:**
  - con dos asignaciones del mismo tratamiento, el total es la suma (F2);
  - un pago parcial deja la fila `parcial`;
  - el pago completo la saca de la cartera.
- **Pagos:**
  - registrar;
  - monto mayor que el saldo: `409`;
  - tratamiento que el paciente no tiene: `400`;
  - anular sin motivo: `400`;
  - anular: deja de contar y el saldo vuelve.
- **Resúmenes:** coinciden con la cartera; el del paciente suma todos sus tratamientos.
- **Montos:** sin errores de redondeo (por ejemplo, 3 pagos de 33,33 sobre 99,99).

## 9. Al terminar

- **Anotar como pendientes:**
  - en el frontend: el par Mock/Real de `finance.api.ts`, una pantalla para registrar y anular pagos, y ocultar los resúmenes al médico (F5);
  - la etapa B (cuotas, seguros y factura electrónica), con su plan, después del diseño del ítem 8.
- Actualizar `estructura-base.md` y `endpoints-api.md`.
- Commit. Borrar este plan.
