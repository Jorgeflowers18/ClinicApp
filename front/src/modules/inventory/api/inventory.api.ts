import { http } from "@/shared/lib/http"
import { env } from "@/shared/lib/env"
import { mockDelay, nextId, paginate } from "@/shared/lib/mock"
import { ApiError, type PageQuery, type Paginated } from "@/shared/types/common"

import { mockInventoryItems, mockStockMovements } from "./inventory.mock-data"
import type {
  InventoryItem,
  InventoryItemFormValues,
  MovementFormValues,
  StockMovement,
} from "../types/inventory.types"

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

  if (values.type === "salida" && values.quantity > item.stock) {
    throw new ApiError(
      `Stock insuficiente. Disponible: ${item.stock}`,
      400,
      [{ field: "quantity", message: `No puede superar el stock disponible (${item.stock})` }]
    )
  }

  item.stock += values.type === "entrada" ? values.quantity : -values.quantity

  const movement: StockMovement = {
    id: nextId("mov"),
    itemId,
    type: values.type,
    quantity: values.quantity,
    reason: values.reason,
    createdAt: new Date().toISOString(),
  }
  mockStockMovements.unshift(movement)
  return movement
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

export const inventoryApi = {
  list: env.useMockApi ? listMock : listReal,
  get: env.useMockApi ? getMock : getReal,
  create: env.useMockApi ? createMock : createReal,
  update: env.useMockApi ? updateMock : updateReal,
  remove: env.useMockApi ? removeMock : removeReal,
  listMovements: env.useMockApi ? listMovementsMock : listMovementsReal,
  registerMovement: env.useMockApi ? registerMovementMock : registerMovementReal,
}
