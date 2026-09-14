import { http } from "@/shared/lib/http"
import { env } from "@/shared/lib/env"
import { mockDelay, nextId, paginate } from "@/shared/lib/mock"
import { ApiError, type PageQuery, type Paginated } from "@/shared/types/common"

import {
  mockInventoryItems,
  mockPurchaseOrders,
  mockStockLots,
  mockStockMovements,
  mockSterilizationCycles,
  mockSuppliers,
} from "./inventory.mock-data"
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

function compareByExpiration(a: { expirationDate?: string }, b: { expirationDate?: string }) {
  if (!a.expirationDate && !b.expirationDate) return 0
  if (!a.expirationDate) return 1
  if (!b.expirationDate) return -1
  return a.expirationDate.localeCompare(b.expirationDate)
}

interface ReceiveLotMeta {
  expirationDate?: string
  purchaseOrderId?: string
  reason: string
}

/** Crea un lote de stock, sube el stock del insumo y registra el movimiento de entrada. */
function receiveLot(itemId: string, quantity: number, meta: ReceiveLotMeta) {
  const item = mockInventoryItems.find((entry) => entry.id === itemId)
  if (!item) throw new ApiError("Insumo no encontrado", 404)

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

interface ConsumeFefoMeta {
  reason: string
  treatmentAssignmentId?: string
  patientId?: string
  purchaseOrderId?: string
}

/**
 * Consume stock por FEFO (primero en vencer, primero en salir) entre los lotes disponibles
 * del insumo. No lanza error si el stock no alcanza: consume lo disponible y se detiene — el
 * consumo clínico automático (ver `registerConsumption`) nunca debe bloquearse por un
 * descuadre de inventario. Genera un `StockMovement` por cada lote efectivamente tocado.
 */
function consumeFefo(itemId: string, quantity: number, meta: ConsumeFefoMeta): StockMovement[] {
  const item = mockInventoryItems.find((entry) => entry.id === itemId)
  if (!item) throw new ApiError("Insumo no encontrado", 404)

  const lots = mockStockLots
    .filter((lot) => lot.itemId === itemId && lot.quantity > 0)
    .sort(compareByExpiration)

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
      purchaseOrderId: meta.purchaseOrderId,
      createdAt: new Date().toISOString(),
    }
    mockStockMovements.unshift(movement)
    movements.push(movement)
  }

  return movements
}

async function listMock(query: PageQuery): Promise<Paginated<InventoryItem>> {
  await mockDelay()
  const search = query.search?.trim().toLowerCase()

  const filtered = search
    ? mockInventoryItems.filter((item) =>
        [item.name, item.category, item.supplier].join(" ").toLowerCase().includes(search)
      )
    : mockInventoryItems

  return paginate([...filtered].sort((a, b) => a.name.localeCompare(b.name)), query)
}

async function getMock(id: string): Promise<InventoryItem> {
  await mockDelay(250)
  const item = mockInventoryItems.find((entry) => entry.id === id)
  if (!item) throw new ApiError("Insumo no encontrado", 404)
  return item
}

async function createMock(values: InventoryItemFormValues): Promise<InventoryItem> {
  await mockDelay()
  const item: InventoryItem = { ...values, id: nextId("inv"), stock: 0, createdAt: new Date().toISOString() }
  mockInventoryItems.unshift(item)
  return item
}

async function updateMock(id: string, values: InventoryItemFormValues): Promise<InventoryItem> {
  await mockDelay()
  const index = mockInventoryItems.findIndex((entry) => entry.id === id)
  if (index === -1) throw new ApiError("Insumo no encontrado", 404)
  mockInventoryItems[index] = { ...mockInventoryItems[index], ...values }
  return mockInventoryItems[index]
}

async function removeMock(id: string): Promise<void> {
  await mockDelay(300)
  const index = mockInventoryItems.findIndex((entry) => entry.id === id)
  if (index === -1) throw new ApiError("Insumo no encontrado", 404)
  mockInventoryItems.splice(index, 1)
}

async function listMovementsMock(itemId: string): Promise<StockMovement[]> {
  await mockDelay(250)
  return mockStockMovements
    .filter((movement) => movement.itemId === itemId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

async function registerMovementMock(
  itemId: string,
  values: MovementFormValues
): Promise<StockMovement> {
  await mockDelay()
  const item = mockInventoryItems.find((entry) => entry.id === itemId)
  if (!item) throw new ApiError("Insumo no encontrado", 404)

  if (values.type === "entrada") {
    const { movement } = receiveLot(itemId, values.quantity, {
      expirationDate: values.expirationDate,
      reason: values.reason,
    })
    return movement
  }

  if (values.quantity > item.stock) {
    throw new ApiError(
      `Stock insuficiente. Disponible: ${item.stock}`,
      400,
      [{ field: "quantity", message: `No puede superar el stock disponible (${item.stock})` }]
    )
  }

  const [movement] = consumeFefo(itemId, values.quantity, { reason: values.reason })
  return movement
}

interface RegisterConsumptionInput {
  itemId: string
  quantity: number
  reason: string
  treatmentAssignmentId?: string
  patientId?: string
}

async function registerConsumptionMock(input: RegisterConsumptionInput): Promise<void> {
  await mockDelay(100)
  consumeFefo(input.itemId, input.quantity, input)
}

async function listLotsMock(itemId: string): Promise<StockLot[]> {
  await mockDelay(200)
  return mockStockLots.filter((lot) => lot.itemId === itemId).sort(compareByExpiration)
}

async function listPurchaseOrdersMock(): Promise<PurchaseOrder[]> {
  await mockDelay(250)
  return [...mockPurchaseOrders].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

async function createPurchaseOrderMock(values: PurchaseOrderFormValues): Promise<PurchaseOrder> {
  await mockDelay()
  const order: PurchaseOrder = {
    ...values,
    id: nextId("po"),
    status: "pendiente",
    createdAt: new Date().toISOString(),
  }
  mockPurchaseOrders.unshift(order)
  return order
}

async function receivePurchaseOrderMock(id: string): Promise<PurchaseOrder> {
  await mockDelay()
  const index = mockPurchaseOrders.findIndex((order) => order.id === id)
  if (index === -1) throw new ApiError("Orden de compra no encontrada", 404)

  const order = mockPurchaseOrders[index]
  if (order.status !== "pendiente") {
    throw new ApiError("Solo se pueden recibir órdenes pendientes", 400)
  }

  for (const line of order.lines) {
    receiveLot(line.itemId, line.quantity, {
      expirationDate: line.expirationDate,
      purchaseOrderId: id,
      reason: `Recepción de orden de compra #${id}`,
    })
  }

  mockPurchaseOrders[index] = { ...order, status: "recibida", receivedAt: new Date().toISOString() }
  return mockPurchaseOrders[index]
}

async function cancelPurchaseOrderMock(id: string): Promise<PurchaseOrder> {
  await mockDelay(250)
  const index = mockPurchaseOrders.findIndex((order) => order.id === id)
  if (index === -1) throw new ApiError("Orden de compra no encontrada", 404)

  if (mockPurchaseOrders[index].status !== "pendiente") {
    throw new ApiError("Solo se pueden cancelar órdenes pendientes", 400)
  }

  mockPurchaseOrders[index] = { ...mockPurchaseOrders[index], status: "cancelada" }
  return mockPurchaseOrders[index]
}

async function listSterilizationCyclesMock(): Promise<SterilizationCycle[]> {
  await mockDelay(250)
  return [...mockSterilizationCycles].sort((a, b) => b.performedAt.localeCompare(a.performedAt))
}

async function createSterilizationCycleMock(
  values: SterilizationCycleFormValues
): Promise<SterilizationCycle> {
  await mockDelay()
  const cycle: SterilizationCycle = { ...values, id: nextId("stz"), createdAt: new Date().toISOString() }
  mockSterilizationCycles.unshift(cycle)
  return cycle
}

// TODO: conectar a endpoint real -> GET /inventory/items
async function listReal(query: PageQuery): Promise<Paginated<InventoryItem>> {
  const { data } = await http.get<Paginated<InventoryItem>>("/inventory/items", { params: query })
  return data
}

// TODO: conectar a endpoint real -> GET /inventory/items/:id
async function getReal(id: string): Promise<InventoryItem> {
  const { data } = await http.get<InventoryItem>(`/inventory/items/${id}`)
  return data
}

// TODO: conectar a endpoint real -> POST /inventory/items
async function createReal(values: InventoryItemFormValues): Promise<InventoryItem> {
  const { data } = await http.post<InventoryItem>("/inventory/items", values)
  return data
}

// TODO: conectar a endpoint real -> PUT /inventory/items/:id
async function updateReal(id: string, values: InventoryItemFormValues): Promise<InventoryItem> {
  const { data } = await http.put<InventoryItem>(`/inventory/items/${id}`, values)
  return data
}

// TODO: conectar a endpoint real -> DELETE /inventory/items/:id
async function removeReal(id: string): Promise<void> {
  await http.delete(`/inventory/items/${id}`)
}

// TODO: conectar a endpoint real -> GET /inventory/items/:id/movements
async function listMovementsReal(itemId: string): Promise<StockMovement[]> {
  const { data } = await http.get<StockMovement[]>(`/inventory/items/${itemId}/movements`)
  return data
}

// TODO: conectar a endpoint real -> POST /inventory/items/:id/movements
async function registerMovementReal(
  itemId: string,
  values: MovementFormValues
): Promise<StockMovement> {
  const { data } = await http.post<StockMovement>(`/inventory/items/${itemId}/movements`, values)
  return data
}

// No conecta a ningún endpoint: en producción el backend descuenta stock desde su propio
// endpoint POST /treatment-assignments/:id/advance-session, el frontend no debe invocarlo.
async function registerConsumptionReal(): Promise<void> {
  return
}

// TODO: conectar a endpoint real -> GET /inventory/items/:id/lots
async function listLotsReal(itemId: string): Promise<StockLot[]> {
  const { data } = await http.get<StockLot[]>(`/inventory/items/${itemId}/lots`)
  return data
}

// TODO: conectar a endpoint real -> GET /inventory/purchase-orders
async function listPurchaseOrdersReal(): Promise<PurchaseOrder[]> {
  const { data } = await http.get<PurchaseOrder[]>("/inventory/purchase-orders")
  return data
}

// TODO: conectar a endpoint real -> POST /inventory/purchase-orders
async function createPurchaseOrderReal(values: PurchaseOrderFormValues): Promise<PurchaseOrder> {
  const { data } = await http.post<PurchaseOrder>("/inventory/purchase-orders", values)
  return data
}

// TODO: conectar a endpoint real -> POST /inventory/purchase-orders/:id/receive
async function receivePurchaseOrderReal(id: string): Promise<PurchaseOrder> {
  const { data } = await http.post<PurchaseOrder>(`/inventory/purchase-orders/${id}/receive`)
  return data
}

// TODO: conectar a endpoint real -> POST /inventory/purchase-orders/:id/cancel
async function cancelPurchaseOrderReal(id: string): Promise<PurchaseOrder> {
  const { data } = await http.post<PurchaseOrder>(`/inventory/purchase-orders/${id}/cancel`)
  return data
}

// TODO: conectar a endpoint real -> GET /inventory/sterilization-cycles
async function listSterilizationCyclesReal(): Promise<SterilizationCycle[]> {
  const { data } = await http.get<SterilizationCycle[]>("/inventory/sterilization-cycles")
  return data
}

// TODO: conectar a endpoint real -> POST /inventory/sterilization-cycles
async function createSterilizationCycleReal(
  values: SterilizationCycleFormValues
): Promise<SterilizationCycle> {
  const { data } = await http.post<SterilizationCycle>("/inventory/sterilization-cycles", values)
  return data
}

async function listSuppliersMock(): Promise<Supplier[]> {
  await mockDelay(200)
  return [...mockSuppliers].sort((a, b) => a.name.localeCompare(b.name))
}

async function createSupplierMock(values: SupplierFormValues): Promise<Supplier> {
  await mockDelay()
  const supplier: Supplier = { ...values, id: nextId("sup"), createdAt: new Date().toISOString() }
  mockSuppliers.unshift(supplier)
  return supplier
}

async function updateSupplierMock(id: string, values: SupplierFormValues): Promise<Supplier> {
  await mockDelay()
  const index = mockSuppliers.findIndex((entry) => entry.id === id)
  if (index === -1) throw new ApiError("Proveedor no encontrado", 404)
  mockSuppliers[index] = { ...mockSuppliers[index], ...values }
  return mockSuppliers[index]
}

async function removeSupplierMock(id: string): Promise<void> {
  await mockDelay(300)
  const index = mockSuppliers.findIndex((entry) => entry.id === id)
  if (index === -1) throw new ApiError("Proveedor no encontrado", 404)

  const inUse = mockPurchaseOrders.some((order) => order.supplierId === id)
  if (inUse) {
    throw new ApiError("No se puede eliminar: el proveedor tiene órdenes de compra asociadas", 409)
  }

  mockSuppliers.splice(index, 1)
}

// TODO: conectar a endpoint real -> GET /inventory/suppliers
async function listSuppliersReal(): Promise<Supplier[]> {
  const { data } = await http.get<Supplier[]>("/inventory/suppliers")
  return data
}

// TODO: conectar a endpoint real -> POST /inventory/suppliers
async function createSupplierReal(values: SupplierFormValues): Promise<Supplier> {
  const { data } = await http.post<Supplier>("/inventory/suppliers", values)
  return data
}

// TODO: conectar a endpoint real -> PUT /inventory/suppliers/:id
async function updateSupplierReal(id: string, values: SupplierFormValues): Promise<Supplier> {
  const { data } = await http.put<Supplier>(`/inventory/suppliers/${id}`, values)
  return data
}

// TODO: conectar a endpoint real -> DELETE /inventory/suppliers/:id (409 si tiene órdenes asociadas)
async function removeSupplierReal(id: string): Promise<void> {
  await http.delete(`/inventory/suppliers/${id}`)
}

export const inventoryApi = {
  listSuppliers: env.useMockApi ? listSuppliersMock : listSuppliersReal,
  createSupplier: env.useMockApi ? createSupplierMock : createSupplierReal,
  updateSupplier: env.useMockApi ? updateSupplierMock : updateSupplierReal,
  removeSupplier: env.useMockApi ? removeSupplierMock : removeSupplierReal,
  list: env.useMockApi ? listMock : listReal,
  get: env.useMockApi ? getMock : getReal,
  create: env.useMockApi ? createMock : createReal,
  update: env.useMockApi ? updateMock : updateReal,
  remove: env.useMockApi ? removeMock : removeReal,
  listMovements: env.useMockApi ? listMovementsMock : listMovementsReal,
  registerMovement: env.useMockApi ? registerMovementMock : registerMovementReal,
  registerConsumption: env.useMockApi ? registerConsumptionMock : registerConsumptionReal,
  listLots: env.useMockApi ? listLotsMock : listLotsReal,
  listPurchaseOrders: env.useMockApi ? listPurchaseOrdersMock : listPurchaseOrdersReal,
  createPurchaseOrder: env.useMockApi ? createPurchaseOrderMock : createPurchaseOrderReal,
  receivePurchaseOrder: env.useMockApi ? receivePurchaseOrderMock : receivePurchaseOrderReal,
  cancelPurchaseOrder: env.useMockApi ? cancelPurchaseOrderMock : cancelPurchaseOrderReal,
  listSterilizationCycles: env.useMockApi ? listSterilizationCyclesMock : listSterilizationCyclesReal,
  createSterilizationCycle: env.useMockApi ? createSterilizationCycleMock : createSterilizationCycleReal,
}
