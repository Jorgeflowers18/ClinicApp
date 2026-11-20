# Plan 6 — `inventory`

## Objetivo

Insumos, movimientos, lotes (FEFO), proveedores, órdenes de compra y ciclos de esterilización contra la API (`endpoints-api.md` § 6).

**Módulo del conmutador:** `inventory`. **Necesita:** el plan 4, porque el responsable de un ciclo de esterilización es un profesional real. Conviene conectarlo junto con el plan 5, por los insumos del catálogo de tratamientos.

## Mocks que se deshabilitan

| Mock (`inventory.api.ts`) | Qué simula | Se reemplaza por |
|---|---|---|
| `listMock`, `getMock`, `createMock`, `updateMock`, `removeMock` | CRUD de insumos | `GET /inventory/items` (paginado), `GET`, `POST`, `PUT` y `DELETE /inventory/items/:id`. El borrado da `409` si el insumo tiene movimientos o está en uso. |
| `receiveLot`: crea el lote, sube el stock y registra la entrada | Entradas | Lo hace el back en `POST /items/:id/movements` (`type: entrada`) y al recibir una orden |
| `consumeFefo`: descuenta por lote del más próximo a vencer | Salidas | Lo hace el back. Una salida manual sin stock da `400` "Stock insuficiente. Disponible: N" (`errors.quantity`). El consumo clínico no bloquea. |
| `registerMovementMock` | Ajuste manual | `POST /inventory/items/:id/movements` |
| `registerConsumptionMock` / `registerConsumptionReal` (vacía) | Consumo clínico llamado por `treatments` | **Se borra del contrato.** El back descuenta al registrar el tratamiento realizado (plan 5). |
| `listMovementsMock`, `listLotsMock` | Historial y lotes | `GET /items/:id/movements` y `GET /items/:id/lots` (en orden FEFO, incluidos los vacíos) |
| `listSuppliersMock`, `createSupplierMock`, `updateSupplierMock`, `removeSupplierMock` | Proveedores | `GET`, `POST`, `PUT` y `DELETE /inventory/suppliers`. El borrado da `409` si tiene órdenes. |
| `listPurchaseOrdersMock`, `createPurchaseOrderMock`, `receivePurchaseOrderMock`, `cancelPurchaseOrderMock` | Órdenes | `GET` y `POST /purchase-orders`, `POST /:id/receive` (transaccional, sin duplicar) y `POST /:id/cancel` (`409` si no está pendiente) |
| `listSterilizationCyclesMock`, `createSterilizationCycleMock` | Esterilización | `GET` y `POST /sterilization-cycles` (`400` si un insumo no es instrumental, o el responsable no existe o está inactivo) |

## Diferencias de contrato

| Punto | Frontend | API | Resuelve |
|---|---|---|---|
| Campos opcionales (`supplier`, `expirationDate`, `lotId`, `purchaseOrderId`, `treatmentAssignmentId`, `patientId`, `notes`, `contactName`…) | `?: string` (`undefined`) | `null` | Mapeo en `inventory.http.ts`. Cuidado con `compareByExpiration`: si se reutiliza, debe tratar `null` igual que `undefined`. |
| Stock | Se calcula en el mock | Lo devuelve el back y nunca se envía | Coinciden: el formulario no lo envía |
| Selectores con todos los insumos | `pageSize: 100` con un bucle (`use-inventory-catalog.ts`) | `pageSize` hasta 100 | `fetchAllPages` (plan 0). Pendiente del back: un `?all=true` o un endpoint liviano para selectores si hay más de 100 insumos. |
| Roles | Rutas `/inventario` solo admin y recepción | Leer insumos: los tres; el resto: admin y recepción | Coinciden. El médico lee insumos solo desde el formulario de tratamientos. |
| Fecha del ciclo | Sin máximo | No futura según el día de la clínica | Front: `max` = hoy en el campo, y mostrar el `400` en `performedAt` |

## Cambios en el frontend

1. **Estándar del plan 0:** `inventory.contract.ts` (sin `registerConsumption`), `.http.ts`, `.mock.ts` y `.api.ts`. Las funciones internas del mock (`receiveLot`, `consumeFefo` y `compareByExpiration`) se mudan a `inventory.mock.ts`.
2. **`useInventoryCatalog`** y `useTreatmentInventory` usan `fetchAllPages`.
3. **Errores del servidor:**
   - `errors.quantity` en el diálogo de movimiento;
   - `errors["lines[0].itemId"]` y `errors.supplierId` en la orden;
   - `errors.itemIds` y `errors.responsibleProfessionalId` en el ciclo.

   Usar `applyServerFieldErrors` en los cuatro formularios.
4. **Recepción de una orden:** después de recibirla, invalidar `inventoryKeys.all`, como ya hace `useReceivePurchaseOrder`. Deshabilitar el botón mientras corre: el back ya evita la doble recepción, pero así no aparece un error.
5. **Responsable de esterilización:** el selector usa `useProfessionals()` filtrado a activos (plan 4).

## Cambios necesarios en el back

Ninguno para conectar. Pendientes conocidos, que no bloquean:
- desactivar insumos en lugar de borrarlos;
- un selector sin el límite de 100.

## Verificación

- **Entrada con vencimiento y salida:** el stock baja del lote que vence primero (ver la pestaña de lotes).
- **Salida mayor al stock:** error en la cantidad; el stock no cambia.
- **Orden de compra:**
  - crear una con dos líneas y recibirla: dos lotes nuevos y el stock sube;
  - cancelar una recibida: `409`.
- **Ciclo:** con un consumible, error "no es instrumental esterilizable".
- **Borrado:** un proveedor con órdenes o un insumo con movimientos da el aviso, no un error genérico.
- **E2E:** `inventory-redesign.spec.ts`.

## Terminado

- Todo inventario en la API.
- Sin FEFO ni cálculo de stock en el frontend en modo API.
- `registerConsumption` eliminado del contrato.
