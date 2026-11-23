import type { PageQuery, Paginated } from "@/shared/types/common"

import type {
  InventoryItem,
  InventoryItemFormValues,
  MovementFormValues,
  PurchaseOrder,
  PurchaseOrderFormValues,
  StockLot,
  StockMovement,
  SterilizationCycle,
  SterilizationCycleFormValues,
  Supplier,
  SupplierFormValues,
} from "../types/inventory.types"

/**
 * Inventario. `inventory.http.ts` lo cumple con la API.
 *
 * El stock, los lotes y el descuento FEFO los calcula el servidor. El consumo clínico de un tratamiento
 * realizado lo descuenta el servidor al registrarlo: no está en el contrato.
 */
export interface InventoryApi {
  list(query: PageQuery, signal?: AbortSignal): Promise<Paginated<InventoryItem>>
  get(id: string, signal?: AbortSignal): Promise<InventoryItem>
  create(values: InventoryItemFormValues): Promise<InventoryItem>
  update(id: string, values: InventoryItemFormValues): Promise<InventoryItem>
  /** `409` si el insumo tiene movimientos o está en uso. */
  remove(id: string): Promise<void>
  listMovements(itemId: string, signal?: AbortSignal): Promise<StockMovement[]>
  /** Una salida mayor al stock da `400` con `errors.quantity`. */
  registerMovement(itemId: string, values: MovementFormValues): Promise<StockMovement>
  /** En orden FEFO, incluidos los lotes vacíos. */
  listLots(itemId: string, signal?: AbortSignal): Promise<StockLot[]>
  listSuppliers(signal?: AbortSignal): Promise<Supplier[]>
  createSupplier(values: SupplierFormValues): Promise<Supplier>
  updateSupplier(id: string, values: SupplierFormValues): Promise<Supplier>
  /** `409` si tiene órdenes de compra. */
  removeSupplier(id: string): Promise<void>
  listPurchaseOrders(signal?: AbortSignal): Promise<PurchaseOrder[]>
  createPurchaseOrder(values: PurchaseOrderFormValues): Promise<PurchaseOrder>
  /** Crea un lote por línea y sube el stock, sin duplicar si se repite. */
  receivePurchaseOrder(id: string): Promise<PurchaseOrder>
  cancelPurchaseOrder(id: string): Promise<PurchaseOrder>
  listSterilizationCycles(signal?: AbortSignal): Promise<SterilizationCycle[]>
  createSterilizationCycle(values: SterilizationCycleFormValues): Promise<SterilizationCycle>
}
