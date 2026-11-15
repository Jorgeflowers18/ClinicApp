# Plan de implementación — `inventory`

- **Responsable:** Jorge Flores
- **Estado:** aprobado e implementado (2026-11-15). Pruebas de punta a punta: 80 de 80 correctas.
- **Detalle de endpoints:** [`backlog.md` § `inventory`](../backlog.md#inventory)
- **Contrato del frontend:** `front/src/modules/inventory/types/inventory.types.ts` y `front/src/modules/inventory/api/inventory.api.ts` (las funciones `*Mock` describen el comportamiento esperado)

## 1. Objetivo y alcance

Los 18 endpoints de inventario que el frontend ya llama: insumos, movimientos, lotes con salida FEFO, proveedores, órdenes de compra y ciclos de esterilización.

Además:
- **Insumos de cada tratamiento (`consumption`).** Pendiente de `treatments` que dependía de que existieran los insumos. Se guardan y se devuelven en `/api/treatments`.
- **Servicio de stock reutilizable (`StockService`).** Lo usarán los tratamientos realizados (`POST /treatment-assignments`) para descontar insumos sin fallar por falta de stock.

**Fuera de alcance:**
- `POST /treatment-assignments` y el consumo automático al registrar un tratamiento: necesita `patients`.
- La llave foránea al catálogo de profesionales: necesita `appointments`.
- El reporte de inventario: es de `reports`.

## 2. Decisiones que necesitan tu aprobación

| # | Decisión | Propuesta | Por qué |
|---|---|---|---|
| D1 | Quién puede **leer** insumos | `GET /inventory/items` y `GET /inventory/items/:id` para los tres roles. El resto de inventario solo para `admin` y `recepcion`. | El formulario y el detalle de tratamientos, que el médico también usa, cargan la lista de insumos para elegir y mostrar los consumos. Con la regla estricta, el médico recibiría `403`. |
| D2 | Responsable del ciclo de esterilización | `responsible_professional_id` como UUID **sin llave foránea** por ahora. Se agrega con una migración cuando exista `professionals`. | El catálogo de profesionales es de Josue y aún no existe. |
| D3 | `treatmentAssignmentId` y `patientId` en movimientos | UUID sin llave foránea por ahora. | Las tablas de asignaciones y pacientes aún no existen. Hoy siempre quedan vacíos: solo los llenará el consumo automático. |
| D4 | Eliminar un insumo con historia | `409` si tiene movimientos, si aparece en una orden de compra o en un ciclo de esterilización, o si es insumo de un tratamiento. Solo se puede borrar un insumo recién creado y sin uso. | Borrarlo perdería el historial de stock. El frontend no tiene opción de "desactivar" un insumo: queda anotado como pendiente. |
| D5 | Recibir o cancelar una orden que no está `pendiente` | `409`, con el mismo mensaje del mock. | Es un conflicto con el estado actual (regla transversal del backlog). El mock usa `400`, pero el frontend muestra el mensaje igual. |
| D6 | Proveedor del insumo | Se mantiene `supplier` como **texto libre**, igual que en el frontend, sin enlazarlo a la tabla de proveedores. | Así está el contrato del formulario. Enlazarlo es un cambio de frontend que puede hacerse después. |
| D7 | Quién hizo cada acción | Columna `created_by_user_id` (usuario de la sesión) en movimientos, órdenes de compra y ciclos. No se expone en la API por ahora. | Auditoría: en una clínica importa saber quién sacó stock o firmó una esterilización. |
| D8 | Salida manual que abarca varios lotes | Se crea un movimiento por lote y la respuesta devuelve el primero, igual que el mock. | El frontend espera un solo `StockMovement` y vuelve a pedir la lista después. |
| D9 | Cómo se guarda el stock | Columna `stock` en el insumo, que se mantiene igual a la suma de sus lotes. Cada cambio bloquea la fila del insumo (`SELECT … FOR UPDATE`) dentro de una transacción. | Lectura rápida del listado y de "stock crítico". El bloqueo evita que dos salidas simultáneas dejen el stock negativo. |

## 3. Archivos

### Nuevos

```text
back/docs/plan-inventario.md                                    ← este plan
back/src/ClinicApp.Api/Modules/Inventory/
├── InventoryEntities.cs          ← entidades y constantes (tipos, estados, resultados)
├── InventoryConfiguration.cs     ← tablas, columnas, índices, restricciones
├── StockService.cs               ← entradas (lote + movimiento) y salidas FEFO, con bloqueo
├── InventoryItemDtos.cs          ← insumos, movimientos y lotes: lo que entra y sale
├── InventoryItemsController.cs   ← /api/inventory/items (+ /movements y /lots)
├── SupplierDtos.cs
├── SuppliersController.cs        ← /api/inventory/suppliers
├── PurchaseOrderDtos.cs
├── PurchaseOrdersController.cs   ← /api/inventory/purchase-orders (+ /receive y /cancel)
├── SterilizationDtos.cs
└── SterilizationCyclesController.cs ← /api/inventory/sterilization-cycles
back/src/ClinicApp.Api/Data/Migrations/<fecha>_CrearInventario.cs (+ .Designer.cs)
back/src/ClinicApp.Api/Common/Validation.cs   ← agregado al implementar: título de los 400,
                                                 ValidationError() para errores manuales y
                                                 [IsoDate] para fechas "YYYY-MM-DD" o vacías
```

### Modificados

| Archivo | Cambio |
|---|---|
| `Data/AppDbContext.cs` | `DbSet` de las tablas nuevas |
| `Data/Migrations/AppDbContextModelSnapshot.cs` | Lo actualiza `dotnet ef` |
| `Program.cs` | Registrar `StockService` (scoped) |
| `Modules/Auth/Roles.cs` | Constante `AdminYRecepcion` = `"admin,recepcion"` |
| `Modules/Treatments/Treatment.cs` | Entidad `TreatmentConsumption` y colección `Consumption` |
| `Modules/Treatments/TreatmentConfiguration.cs` | Tabla `treatment_consumptions` |
| `Modules/Treatments/TreatmentDtos.cs` | `consumption` en la petición (validada) y en la respuesta |
| `Modules/Treatments/TreatmentsController.cs` | Cargar y guardar los consumos; `400` si un insumo no existe o está repetido |
| `ClinicApp.Api.http` | Peticiones de ejemplo de inventario |
| `backlog.md`, `backlog-desgloce.md` | Marcar lo hecho y anotar lo pendiente |

## 4. Entidades y atributos

Todas las tablas usan `id uuid` (UUID v7 generado por el servidor) y fechas en UTC (`timestamptz`), salvo las fechas sin hora (`date`). Los nombres en la base van en snake_case.

### `InventoryItem` → tabla `inventory_items`

| Atributo | Tipo C# | Columna | Reglas |
|---|---|---|---|
| `Id` | `Guid` | `uuid` PK | |
| `Name` | `string` | `varchar(120)` | Obligatorio, 2 a 120 caracteres. Índice. |
| `Category` | `string` | `varchar(80)` | Obligatorio, 2 a 80 caracteres |
| `Unit` | `string` | `varchar(30)` | Obligatorio (ej. "unidad", "caja", "ml") |
| `Kind` | `string` | `varchar(20)` | `consumible` o `instrumental` (restricción `CHECK`) |
| `MinStock` | `int` | `integer` | ≥ 0. Si `Stock <= MinStock`, el insumo está en stock crítico. |
| `UnitCost` | `decimal` | `numeric(10,2)` | ≥ 0 |
| `Supplier` | `string?` | `varchar(120)` null | Texto libre (D6) |
| `Stock` | `int` | `integer` | ≥ 0 (`CHECK`). **Solo lo cambia el servidor**: suma de los lotes. |
| `CreatedAt` | `DateTime` | `timestamptz` | |

### `StockLot` → tabla `stock_lots`

Se crea en cada entrada (manual o por recepción de una orden). Las salidas lo descuentan por FEFO.

| Atributo | Tipo C# | Columna | Reglas |
|---|---|---|---|
| `Id` | `Guid` | `uuid` PK | |
| `ItemId` | `Guid` | `uuid` FK → `inventory_items` (restrict) | |
| `Quantity` | `int` | `integer` | Cantidad **restante**, ≥ 0 (`CHECK`) |
| `ExpirationDate` | `DateOnly?` | `date` null | Sin vencimiento = sale al final |
| `PurchaseOrderId` | `Guid?` | `uuid` FK → `purchase_orders` null | Orden de origen, si vino de una compra |
| `ReceivedAt` | `DateTime` | `timestamptz` | |

Índice `(item_id, expiration_date)` para el orden FEFO.

### `StockMovement` → tabla `stock_movements`

Historial inmutable: no se edita ni se borra.

| Atributo | Tipo C# | Columna | Reglas |
|---|---|---|---|
| `Id` | `Guid` | `uuid` PK | |
| `ItemId` | `Guid` | `uuid` FK → `inventory_items` (restrict) | |
| `Type` | `string` | `varchar(10)` | `entrada` o `salida` (`CHECK`) |
| `Quantity` | `int` | `integer` | > 0 (`CHECK`) |
| `Reason` | `string` | `varchar(300)` | Obligatorio, mínimo 3 caracteres |
| `LotId` | `Guid?` | `uuid` FK → `stock_lots` null | Lote creado (entrada) o descontado (salida) |
| `PurchaseOrderId` | `Guid?` | `uuid` FK → `purchase_orders` null | |
| `TreatmentAssignmentId` | `Guid?` | `uuid` null, sin FK (D3) | |
| `PatientId` | `Guid?` | `uuid` null, sin FK (D3) | |
| `CreatedByUserId` | `Guid?` | `uuid` FK → `users` (set null) | D7, no se expone |
| `CreatedAt` | `DateTime` | `timestamptz` | |

Índice `(item_id, created_at)`.

### `Supplier` → tabla `suppliers`

| Atributo | Tipo C# | Columna | Reglas |
|---|---|---|---|
| `Id` | `Guid` | `uuid` PK | |
| `Name` | `string` | `varchar(120)` | Obligatorio, 2 a 120 caracteres |
| `ContactName` | `string?` | `varchar(120)` null | |
| `Phone` | `string?` | `varchar(30)` null | |
| `Email` | `string?` | `varchar(254)` null | Correo válido o vacío |
| `Address` | `string?` | `varchar(250)` null | |
| `Notes` | `string?` | `varchar(1000)` null | |
| `CreatedAt` | `DateTime` | `timestamptz` | |

### `PurchaseOrder` → tabla `purchase_orders`

| Atributo | Tipo C# | Columna | Reglas |
|---|---|---|---|
| `Id` | `Guid` | `uuid` PK | |
| `SupplierId` | `Guid` | `uuid` FK → `suppliers` (restrict) | Debe existir |
| `Status` | `string` | `varchar(20)` | `pendiente`, `recibida` o `cancelada` (`CHECK`) |
| `Notes` | `string?` | `varchar(1000)` null | |
| `Lines` | `List<PurchaseOrderLine>` | — | Al menos una |
| `CreatedByUserId` | `Guid?` | `uuid` FK → `users` (set null) | D7 |
| `CreatedAt` | `DateTime` | `timestamptz` | |
| `ReceivedAt` | `DateTime?` | `timestamptz` null | Se fija al recibir |

### `PurchaseOrderLine` → tabla `purchase_order_lines`

| Atributo | Tipo C# | Columna | Reglas |
|---|---|---|---|
| `Id` | `Guid` | `uuid` PK | No se expone |
| `PurchaseOrderId` | `Guid` | `uuid` FK → `purchase_orders` (cascade) | |
| `Position` | `int` | `integer` | Conserva el orden de las líneas |
| `ItemId` | `Guid` | `uuid` FK → `inventory_items` (restrict) | Debe existir |
| `Quantity` | `int` | `integer` | ≥ 1 |
| `UnitCost` | `decimal` | `numeric(10,2)` | ≥ 0 |
| `ExpirationDate` | `DateOnly?` | `date` null | Vencimiento del lote que se creará al recibir |

### `SterilizationCycle` → tabla `sterilization_cycles`

| Atributo | Tipo C# | Columna | Reglas |
|---|---|---|---|
| `Id` | `Guid` | `uuid` PK | |
| `PerformedAt` | `DateOnly` | `date` | Obligatoria, no futura |
| `Result` | `string` | `varchar(20)` | `aprobado` o `fallido` (`CHECK`) |
| `ResponsibleProfessionalId` | `Guid` | `uuid`, sin FK (D2) | Obligatorio |
| `Notes` | `string?` | `varchar(1000)` null | |
| `Items` | `List<SterilizationCycleItem>` | — | Al menos uno |
| `CreatedByUserId` | `Guid?` | `uuid` FK → `users` (set null) | D7 |
| `CreatedAt` | `DateTime` | `timestamptz` | |

### `SterilizationCycleItem` → tabla `sterilization_cycle_items`

| Atributo | Tipo C# | Columna | Reglas |
|---|---|---|---|
| `CycleId` | `Guid` | `uuid` FK → `sterilization_cycles` (cascade) | PK compuesta `(cycle_id, item_id)` |
| `ItemId` | `Guid` | `uuid` FK → `inventory_items` (restrict) | Debe ser `kind = instrumental` |

### `TreatmentConsumption` → tabla `treatment_consumptions` (módulo `treatments`)

| Atributo | Tipo C# | Columna | Reglas |
|---|---|---|---|
| `TreatmentId` | `Guid` | `uuid` FK → `treatments` (cascade) | PK compuesta `(treatment_id, item_id)` |
| `ItemId` | `Guid` | `uuid` FK → `inventory_items` (restrict) | Debe existir; sin repetidos |
| `Quantity` | `int` | `integer` | ≥ 1 |

## 5. Endpoints

| Método y ruta | Roles | Respuesta | Errores |
|---|---|---|---|
| `GET /api/inventory/items?page&pageSize&search` | todos (D1) | `200` paginado, ordenado por nombre; busca en nombre, categoría y proveedor | |
| `GET /api/inventory/items/:id` | todos (D1) | `200` | `404` |
| `POST /api/inventory/items` | admin, recepcion | `201`, con `stock = 0` | `400` |
| `PUT /api/inventory/items/:id` | admin, recepcion | `200` (no toca el stock) | `400`, `404` |
| `DELETE /api/inventory/items/:id` | admin, recepcion | `204` | `404`, `409` (D4) |
| `GET /api/inventory/items/:id/movements` | admin, recepcion | `200`, del más reciente al más antiguo | `404` |
| `POST /api/inventory/items/:id/movements` | admin, recepcion | `201` + movimiento (D8) | `400` (incluye "Stock insuficiente. Disponible: N" con `errors.quantity`), `404` |
| `GET /api/inventory/items/:id/lots` | admin, recepcion | `200`, en orden FEFO | `404` |
| `GET /api/inventory/suppliers` | admin, recepcion | `200`, por nombre | |
| `POST /api/inventory/suppliers` | admin, recepcion | `201` | `400` |
| `PUT /api/inventory/suppliers/:id` | admin, recepcion | `200` | `400`, `404` |
| `DELETE /api/inventory/suppliers/:id` | admin, recepcion | `204` | `404`, `409` si tiene órdenes |
| `GET /api/inventory/purchase-orders` | admin, recepcion | `200`, de la más reciente a la más antigua, con sus líneas | |
| `POST /api/inventory/purchase-orders` | admin, recepcion | `201`, estado `pendiente` | `400` (proveedor o insumo inexistente, en `errors.supplierId` o `errors["lines[0].itemId"]`) |
| `POST /api/inventory/purchase-orders/:id/receive` | admin, recepcion | `200` | `404`, `409` (D5) |
| `POST /api/inventory/purchase-orders/:id/cancel` | admin, recepcion | `200` | `404`, `409` (D5) |
| `GET /api/inventory/sterilization-cycles` | admin, recepcion | `200`, por fecha descendente | |
| `POST /api/inventory/sterilization-cycles` | admin, recepcion | `201` | `400` (insumo inexistente o que no es instrumental) |

Las respuestas tienen la forma de los tipos del frontend (`InventoryItem`, `StockMovement`, `StockLot`, `Supplier`, `PurchaseOrder`, `SterilizationCycle`). Las fechas sin hora van como `"YYYY-MM-DD"`.

## 6. Reglas de negocio

**Entrada** (movimiento manual o recepción de una orden): crea un lote con la cantidad y el vencimiento opcional, suma al stock del insumo y registra un movimiento `entrada` enlazado al lote. Si viene de una orden, también la enlaza.

**Salida FEFO** (`StockService.ConsumeAsync`):
1. Abre una transacción y bloquea la fila del insumo (D9).
2. Recorre los lotes con cantidad > 0, ordenados por vencimiento ascendente; los que no vencen van al final, y entre iguales gana el más antiguo.
3. Descuenta de cada lote lo que haga falta y crea un movimiento `salida` por cada lote tocado.
4. Resta el total al stock del insumo.

Hay dos modos:
- **Estricto** (salida manual): si la cantidad supera el stock, responde `400` y no toca nada.
- **Tolerante** (consumo de un tratamiento, para `treatment-assignments`): descuenta lo disponible, nunca falla, y deja un aviso en el log si faltó stock.

**Recepción de una orden:** todo en una sola transacción. Por cada línea, una entrada con `reason = "Recepción de orden de compra #<id>"`. Después la orden pasa a `recibida` con `receivedAt`. Si algo falla, no se recibe nada.

**Invariante:** en todo momento `inventory_items.stock = Σ stock_lots.quantity` del insumo. Las pruebas lo verifican.

## 7. Migración

`dotnet ef migrations add CrearInventario` crea las 8 tablas (`inventory_items`, `stock_lots`, `stock_movements`, `suppliers`, `purchase_orders`, `purchase_order_lines`, `sterilization_cycles`, `sterilization_cycle_items`) más `treatment_consumptions`, con sus restricciones `CHECK`, llaves foráneas e índices. Antes de aplicarla se revisa el SQL con `dotnet ef migrations script`.

## 8. Pruebas

Script de punta a punta con `curl` contra la base local, iniciando sesión como `admin`, `recepcion` y `medico`:

- **Insumos:** crear, editar, listar con búsqueda y obtener por id. `400` de validación.
- **Roles:** `medico` puede leer insumos pero recibe `403` en el resto de inventario.
- **Stock:**
  - Entrada con y sin vencimiento: crea lote y movimiento.
  - Salida que abarca dos lotes: dos movimientos, y sale primero el lote más próximo a vencer.
  - Salida mayor al stock: `400` y nada cambia.
  - El invariante de stock se cumple después de cada operación.
- **Proveedores:** CRUD, y `409` al eliminar uno con órdenes.
- **Órdenes de compra:** crear (con proveedor o insumo inexistente: `400`), recibir (lotes y movimientos creados, estado `recibida`), recibir de nuevo (`409`) y cancelar.
- **Esterilización:** crear con instrumental (`201`) y con un consumible (`400`).
- **Eliminar insumo:** `409` con movimientos, `204` si está sin uso.
- **Tratamientos:** guardar y leer `consumption`, y `400` con un insumo inexistente o repetido.
- **Concurrencia:** varias salidas simultáneas del mismo insumo no dejan el stock negativo.

## 9. Al terminar

- Marcar en `backlog.md` y `backlog-desgloce.md` los endpoints hechos y el ítem de insumos de `treatments`.
- **Anotar como pendientes:**
  - la FK de `responsible_professional_id` y de `patient_id` / `treatment_assignment_id`;
  - la opción de desactivar insumos en el frontend;
  - las listas de más de 100 insumos (el frontend pide `pageSize: 100` para "Stock crítico" y los selectores).
- Commit en la rama actual. El push, solo si lo pides.
