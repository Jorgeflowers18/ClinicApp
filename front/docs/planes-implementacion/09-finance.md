# Plan 9 — `finance`: cartera, resúmenes y pagos

## Objetivo

Cartera `/finanzas`, la pestaña Finanzas del paciente y el resumen del detalle del tratamiento contra la API (`endpoints-api.md` § 13), con dos pantallas nuevas: **registrar un pago** y **anular un pago**. Es la etapa A: sin cuotas, seguros ni factura.

**Módulo del conmutador:** `finance`. **Necesita:** el plan 3 (pacientes) y el plan 5 (tratamientos realizados, que generan el saldo).

## Mocks que se deshabilitan

`finance.api.ts` **no tiene versión real**: las tres funciones llaman directo a `finance.mock-data.ts`.

| Mock (`finance.mock-data.ts`) | Qué simula | Se reemplaza por |
|---|---|---|
| `buildPortfolioRows` | Cartera por paciente + tratamiento | `GET /finance/portfolio` (también las filas al día, de mayor a menor deuda; calculado en PostgreSQL) |
| `getTreatmentFinancialSummary(treatmentId, patientId?)`. **Sin `patientId` toma el primer paciente que tenga ese tratamiento.** | Resumen con pagos, cuotas, seguro y factura | `GET /finance/treatments/:treatmentId/summary?patientId=` (`installments: []`, `insurance: null`, `invoice: null` hasta la etapa B). **Sin `patientId` y con varios pacientes → `400`.** |
| `getPatientFinancialSummary` | Totales del paciente | `GET /finance/patients/:patientId/summary` |
| `mockFinancialPayments`, `mockInstallments`, `mockInsuranceCoverage`, `mockInvoices` | Pagos, cuotas, seguros y facturas de ejemplo | Pagos: `POST /finance/payments` y `POST /finance/payments/:id/void`. Cuotas, seguros y facturas: **no existen** (etapa B, ítem 8). |

## Diferencias de contrato

| Punto | Frontend (mock) | API | Resuelve |
|---|---|---|---|
| **`total`** | Precio del **último** tratamiento realizado de ese tipo | **Suma** del costo de **todos** los realizados del paciente con ese tratamiento | Es una corrección: con dos profilaxis, se deben dos. Avisar a quien revise los números. |
| `overdue`, `nextDueDate`, `daysLate` | Calculados de las cuotas | `0`, `null` y `0` | Front: ocultar "Vencido" y "Próximo vencimiento" mientras sean `0`/`null`, o mostrar "Sin cuotas" |
| `PaymentStatus` | `registrado`, `anulado` y `reversado` | `registrado` y `anulado` | Front: quitar `reversado`, o dejarlo sin uso hasta la etapa B |
| `FinancialPayment.voidReason` | No existe | `string \| null` | Front: sumarlo y mostrarlo en los anulados |
| Roles | La pestaña Finanzas del paciente y el resumen del detalle del tratamiento se piden **para todos los roles** | Solo admin y recepción: **el médico recibe `403`** | Front: no pedir ni mostrar montos al médico (ver abajo) |
| Resumen del detalle del tratamiento | Un paciente cualquiera | Pide `patientId` | Front: calcular el resumen del tratamiento sumando las filas de `GET /finance/portfolio` con ese `treatmentId`, sin cambio de back |

## Cambios en el frontend

1. **Recurso nuevo** con el estándar del plan 0:
   - `finance.contract.ts`: `listPortfolio`, `getTreatmentSummary`, `getPatientSummary`, `registerPayment` y `voidPayment`;
   - `finance.http.ts`;
   - `finance.mock.ts`, que envuelve `finance.mock-data.ts` y suma `registerPayment` y `voidPayment` en memoria;
   - `finance.api.ts`;
   - `finance.queries.ts`, con las mutaciones.
2. **Roles:**
   - `patient-detail-page.tsx:52,70`: la pestaña "Finanzas" solo para admin y recepción;
   - `treatment-detail-page.tsx:40`: `useTreatmentFinancialSummary` con `enabled` solo para esos roles, y la tarjeta oculta para el médico.

   Así no hay `403` en pantalla.
3. **Detalle del tratamiento:** reemplazar `useTreatmentFinancialSummary(id)` por un `useTreatmentPortfolio(id)`, que filtra la cartera y suma `total`, `paid` y `pending`.
4. **Pantalla "Registrar pago"**, desde la fila de la cartera o desde el detalle del tratamiento de un paciente:
   - **Campos:**
     - fecha, que no puede ser futura;
     - monto, de 0,01 hasta el saldo pendiente;
     - método: `efectivo`, `transferencia`, `tarjeta_debito`, `tarjeta_credito`, `deposito`, `cheque` u `otros`;
     - comprobante, hasta 100;
     - observaciones, hasta 500.
   - **Errores:** el `409` "El pago supera el saldo pendiente (N)" llega en `errors.amount`; el `400` en `errors.treatmentId` si el paciente no tiene ese tratamiento.
   - **Al guardar:** invalidar `financeKeys.all`.
5. **Anular pago:** en la lista de pagos (`PatientTreatmentLedger`), con un diálogo que pide el motivo (3 a 300). Un pago anulado muestra su motivo y no se puede volver a anular (`409`).
6. **Secciones de la etapa B:** cuotas, seguro y factura ya se ocultan cuando vienen vacías (`installments.length > 0`, `invoice &&`). Revisar el resumen del tratamiento.

## Cambios necesarios en el back

Ninguno para la etapa A. La etapa B (cuotas, seguros y factura) espera la decisión del ítem 8.

## Verificación

- **Saldo inicial:** registrar una atención con un tratamiento de $40 (plan 7). La cartera muestra $40 pendiente y el paciente, "Total pendiente $40".
- **Pagos:**
  - pagar $15: queda $25, estado "parcial";
  - pagar $30: error "supera el saldo pendiente (25)" en el monto;
  - anular el pago de $15: vuelve a $40 y el pago muestra su motivo.
- **Médico:** no ve la pestaña Finanzas ni la tarjeta del detalle del tratamiento, y no hay `403` en la consola.
- **E2E:** `finance-reports-redesign.spec.ts`.

## Terminado

- Finanzas en la API.
- Pagos registrables y anulables.
- El médico no pide montos.
- Sin cuotas ni seguros simulados en modo API.
