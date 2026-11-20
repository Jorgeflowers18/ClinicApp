# Plan 5 — `treatments`: catálogo y tratamientos realizados

## Objetivo

El catálogo `/tratamientos`, su detalle con "Pacientes que recibieron este tratamiento" y el registro de tratamientos realizados, contra la API (`endpoints-api.md` § 5).

**Módulo del conmutador:** `treatments`. **Necesita:**
- el plan 3, para los tratamientos realizados de un paciente;
- el plan 6, o en conjunto con él, porque `consumption` apunta a insumos reales.

## Mocks que se deshabilitan

| Mock (`treatments.api.ts`) | Qué simula | Se reemplaza por |
|---|---|---|
| `listMock`, `listActiveMock`, `getMock` | Catálogo | `GET /treatments?page&pageSize&search`, `GET /treatments?active=true` (lista completa, sin paginar) y `GET /treatments/:id` |
| `createMock`, `updateMock` | Alta y edición | `POST` y `PUT /treatments/:id`. El back valida los insumos (`errors["consumption[1].itemId"]`: "El insumo no existe" o "Insumo repetido"). |
| `removeMock`: borra siempre | Borrado | `DELETE /treatments/:id`, con `409` "Este tratamiento ya se usó. Desactívalo en su lugar." si está en citas, tratamientos realizados o historias |
| `listAssignmentsMock`, `listAssignmentsByPatientMock` | Tratamientos realizados | `GET /treatments/:id/assignments` y `GET /treatment-assignments?patientId=` |
| `createAssignmentMock`: idempotente por `sourceKey` y **descuenta insumos llamando a `inventoryApi.registerConsumption`** | Registro desde la atención | En modo API la historia ya no lo llama: `POST …/encounters/register` (plan 7) registra los tratamientos realizados dentro de la misma transacción de la atención. `POST /treatment-assignments` sigue disponible, con FEFO e idempotente por `sourceKey`. **El frontend ya no llama a inventario.** |
| `mockTreatments`, `mockTreatmentAssignments` | Datos | Solo modo mock. Hoy también los importan `finance.mock-data.ts` y `reports.api.ts` (se resuelve en los planes 9 y 10). |

## Diferencias de contrato

| Punto | Frontend | API | Resuelve |
|---|---|---|---|
| `description`, `tooth`, `price`, `sourceEncounterId`, `sourceKey` | `undefined` si no hay | `null` | Mapeo en `treatments.http.ts`. `assignmentPrice` ya usa `??`, así que funciona con los dos. |
| Roles | Todos crean, editan y borran | Igual (los tres) | Coinciden |
| Registrar realizado | Lo usa solo la historia clínica | `admin` y `medico` | Coinciden: la historia ya es solo de esos roles |
| Stock insuficiente al registrar | El mock consume lo que hay | Igual: registra y deja un aviso en el log | Coinciden |
| Límites | `durationMinutes ≥ 5`, `price ≥ 0` | `durationMinutes` de 5 a 1440, `price` hasta 99 999 999,99, `consumption` hasta 50 líneas | Front: sumar los máximos al esquema Zod |

## Cambios en el frontend

1. **Estándar del plan 0:** `treatments.contract.ts`, `.http.ts`, `.mock.ts` y `.api.ts`. `createAssignmentMock` se lleva al mock su llamada a `inventoryApi.registerConsumption`.
2. **`inventoryApi.registerConsumption`:**
   - sale del contrato de inventario (plan 6), porque solo existe para el mock;
   - el comentario de `registerConsumptionReal` menciona `advance-session`, un endpoint que ya no existe: se borra junto con la función.
3. **`fetchAllPages`** (plan 0) reemplaza a `allPages` en `use-treatment-options.ts`. Para los selectores que solo necesitan activos, conviene `useActiveTreatments()` (`?active=true`), que ya trae la lista completa en una sola petición.
4. **Borrado:**
   - el `409` se muestra como aviso con la sugerencia de desactivar;
   - el diálogo de confirmación puede ofrecer "Desactivar" en su lugar.
5. **Errores por línea** en el formulario de insumos del tratamiento: `applyServerFieldErrors` ya convierte `consumption[1].itemId` en `consumption.1.itemId`. Verificar que el formulario lo use.
6. **Detalle del tratamiento** (`treatment-detail-page.tsx:40`): el resumen financiero se trata en el plan 9, porque el médico recibe `403` y hay varios pacientes.

## Cambios necesarios en el back

Ninguno.

## Verificación

- **Catálogo:** crear un tratamiento con 2 insumos. Repetir un insumo → error en esa línea.
- **Borrar:** uno sin uso se borra; uno usado en una cita → aviso de desactivar.
- **Tratamiento realizado:** registrarlo desde una atención (plan 7) y ver:
  - que el stock del insumo bajó (plan 6);
  - que aparece en "Pacientes que recibieron este tratamiento";
  - que reintentar no lo duplica.
- **E2E:** `treatments-redesign.spec.ts`.

## Terminado

- Catálogo y realizados en la API.
- El descuento de insumos ocurre solo en el back.
- Sin llamadas cruzadas a `inventoryApi` en modo API.
