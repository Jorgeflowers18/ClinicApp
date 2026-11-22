import { mockDelay, nextId, paginate } from "@/shared/lib/mock"
import { ApiError } from "@/shared/types/common"

import type { InventoryApi } from "./inventory.contract"
import {
  mockInventoryItems,
  mockPurchaseOrders,
  mockStockLots,
  mockStockMovements,
  mockSterilizationCycles,
  mockSuppliers,
} from "./inventory.mock-data"
import type { InventoryItem, PurchaseOrder, StockLot, StockMovement, SterilizationCycle, Supplier } from "../types/inventory.types"

// Demostración: lo que con la API hace el servidor (stock, lotes, FEFO y recepción de órdenes).

function compareByExpiration(a: { expirationDate?: string | null }, b: { expirationDate?: string | null }) {
  if (!a.expirationDate && !b.expirationDate) return 0
  if (!a.expirationDate) return 1
  if (!b.expirationDate) return -1
  return a.expirationDate.localeCompare(b.expirationDate)
}

function findItem(itemId: string): InventoryItem {
  const item = mockInventoryItems.find((entry) => entry.id === itemId)
  if (!item) throw new ApiError("Insumo no encontrado", 404)
  return item
}

/** Crea un lote de stock, sube el stock del insumo y registra el movimiento de entrada. */
function receiveLot(itemId: string, quantity: number, meta: { expirationDate?: string; purchaseOrderId?: string; reason: string }) {
  const item = findItem(itemId)
  const lot: StockLot = {
    id: nextId("lot"),
    itemId,
    quantity,
    expirationDate: meta.expirationDate,
    purchaseOrderId: meta.purchaseOrderId,
    receivedAt: new Date().toISOString(),
  }
  mockStockLots.push(lot)
  item.stock += quantity

  const movement: StockMovement = {
    id: nextId("mov"),
    itemId,
    type: "entrada",
    quantity,
    reason: meta.reason,
    lotId: lot.id,
    purchaseOrderId: meta.purchaseOrderId,
    createdAt: new Date().toISOString(),
  }
  mockStockMovements.unshift(movement)
  return { lot, movement }
}

/**
 * Consume stock por FEFO (primero en vencer, primero en salir) entre los lotes disponibles del insumo. No
 * lanza error si el stock no alcanza: consume lo disponible y se detiene, porque el consumo clínico nunca
 * debe bloquearse por un descuadre de inventario. Genera un `StockMovement` por cada lote tocado.
 */
function consumeFefo(itemId: string, quantity: number, meta: { reason: string; treatmentAssignmentId?: string; patientId?: string }): StockMovement[] {
  const item = findItem(itemId)
  const lots = mockStockLots.filter((lot) => lot.itemId === itemId && lot.quantity > 0).sort(compareByExpiration)
  const movements: StockMovement[] = []
  let remaining = quantity

  for (const lot of lots) {
    if (remaining <= 0) break
    const taken = Math.min(lot.quantity, remaining)
    lot.quantity -= taken
    remaining -= taken
    item.stock -= taken

    const movement: StockMovement = {
      id: nextId("mov"),
      itemId,
      type: "salida",
      quantity: taken,
      reason: meta.reason,
      lotId: lot.id,
      treatmentAssignmentId: meta.treatmentAssignmentId,
      patientId: meta.patientId,
      createdAt: new Date().toISOString(),
    }
    mockStockMovements.unshift(movement)
    movements.push(movement)
  }
  return movements
}

/**
 * Consumo clínico de un tratamiento realizado. Solo lo usa `treatments.mock.ts`: con la API, el servidor
 * descuenta los insumos al registrar el tratamiento realizado.
 */
export async function registerMockConsumption(input: {
  itemId: string
  quantity: number
  reason: string
  treatmentAssignmentId?: string
  patientId?: string
}): Promise<void> {
  await mockDelay(100)
  consumeFefo(input.itemId, input.quantity, input)
}

function findIndex<T extends { id: string }>(list: T[], id: string, notFound: string): number {
  const index = list.findIndex((entry) => entry.id === id)
  if (index === -1) throw new ApiError(notFound, 404)
  return index
}

export const mockInventoryApi: InventoryApi = {
  async list(query) {
    await mockDelay()
    const search = query.search?.trim().toLowerCase()
    const filtered = search
      ? mockInventoryItems.filter((item) => [item.name, item.category, item.supplier].join(" ").toLowerCase().includes(search))
      : mockInventoryItems
    return paginate([...filtered].sort((a, b) => a.name.localeCompare(b.name)), query)
  },
  async get(id) {
    await mockDelay(250)
    return findItem(id)
  },
  async create(values) {
    await mockDelay()
    const item: InventoryItem = { ...values, id: nextId("inv"), stock: 0, createdAt: new Date().toISOString() }
    mockInventoryItems.unshift(item)
    return item
  },
  async update(id, values) {
    await mockDelay()
    const index = findIndex(mockInventoryItems, id, "Insumo no encontrado")
    mockInventoryItems[index] = { ...mockInventoryItems[index], ...values }
    return mockInventoryItems[index]
  },
  async remove(id) {
    await mockDelay(300)
    mockInventoryItems.splice(findIndex(mockInventoryItems, id, "Insumo no encontrado"), 1)
  },
  async listMovements(itemId) {
    await mockDelay(250)
    return mockStockMovements.filter((movement) => movement.itemId === itemId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  },
  async registerMovement(itemId, values) {
    await mockDelay()
    const item = findItem(itemId)
    if (values.type === "entrada") {
      return receiveLot(itemId, values.quantity, { expirationDate: values.expirationDate, reason: values.reason }).movement
    }
    if (values.quantity > item.stock) {
      throw new ApiError(`Stock insuficiente. Disponible: ${item.stock}`, 400,
        [{ field: "quantity", message: `No puede superar el stock disponible (${item.stock})` }])
    }
    const [movement] = consumeFefo(itemId, values.quantity, { reason: values.reason })
    return movement
  },
  async listLots(itemId) {
    await mockDelay(200)
    return mockStockLots.filter((lot) => lot.itemId === itemId).sort(compareByExpiration)
  },
  async listSuppliers() {
    await mockDelay(200)
    return [...mockSuppliers].sort((a, b) => a.name.localeCompare(b.name))
  },
  async createSupplier(values) {
    await mockDelay()
    const supplier: Supplier = { ...values, id: nextId("sup"), createdAt: new Date().toISOString() }
    mockSuppliers.unshift(supplier)
    return supplier
  },
  async updateSupplier(id, values) {
    await mockDelay()
    const index = findIndex(mockSuppliers, id, "Proveedor no encontrado")
    mockSuppliers[index] = { ...mockSuppliers[index], ...values }
    return mockSuppliers[index]
  },
  async removeSupplier(id) {
    await mockDelay(300)
    const index = findIndex(mockSuppliers, id, "Proveedor no encontrado")
    if (mockPurchaseOrders.some((order) => order.supplierId === id)) {
      throw new ApiError("No se puede eliminar: el proveedor tiene órdenes de compra asociadas", 409)
    }
    mockSuppliers.splice(index, 1)
  },
  async listPurchaseOrders() {
    await mockDelay(250)
    return [...mockPurchaseOrders].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  },
  async createPurchaseOrder(values) {
    await mockDelay()
    const order: PurchaseOrder = { ...values, id: nextId("po"), status: "pendiente", createdAt: new Date().toISOString() }
    mockPurchaseOrders.unshift(order)
    return order
  },
  async receivePurchaseOrder(id) {
    await mockDelay()
    const index = findIndex(mockPurchaseOrders, id, "Orden de compra no encontrada")
    const order = mockPurchaseOrders[index]
    if (order.status !== "pendiente") throw new ApiError("Solo se pueden recibir órdenes pendientes", 400)
    for (const line of order.lines) {
      receiveLot(line.itemId, line.quantity, { expirationDate: line.expirationDate, purchaseOrderId: id, reason: `Recepción de orden de compra #${id}` })
    }
    mockPurchaseOrders[index] = { ...order, status: "recibida", receivedAt: new Date().toISOString() }
    return mockPurchaseOrders[index]
  },
  async cancelPurchaseOrder(id) {
    await mockDelay(250)
    const index = findIndex(mockPurchaseOrders, id, "Orden de compra no encontrada")
    if (mockPurchaseOrders[index].status !== "pendiente") throw new ApiError("Solo se pueden cancelar órdenes pendientes", 400)
    mockPurchaseOrders[index] = { ...mockPurchaseOrders[index], status: "cancelada" }
    return mockPurchaseOrders[index]
  },
  async listSterilizationCycles() {
    await mockDelay(250)
    return [...mockSterilizationCycles].sort((a, b) => b.performedAt.localeCompare(a.performedAt))
  },
  async createSterilizationCycle(values) {
    await mockDelay()
    const cycle: SterilizationCycle = { ...values, id: nextId("stz"), createdAt: new Date().toISOString() }
    mockSterilizationCycles.unshift(cycle)
    return cycle
  },
}
