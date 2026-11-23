import type { components } from "@/shared/api/schema"
import { withoutNulls } from "@/shared/lib/dto"
import { apiDelete, apiGet, apiPost, apiPut } from "@/shared/lib/http"
import type { Paginated } from "@/shared/types/common"

import type { InventoryApi } from "./inventory.contract"
import type {
  InventoryItem,
  InventoryItemOption,
  MovementType,
  PurchaseOrder,
  PurchaseOrderStatus,
  StockLot,
  StockMovement,
  SterilizationCycle,
  SterilizationResult,
  Supplier,
} from "../types/inventory.types"

type Schemas = components["schemas"]
type ItemDto = Schemas["InventoryItemDto"]

const toItem = (dto: ItemDto): InventoryItem => ({ ...withoutNulls(dto), kind: dto.kind as InventoryItem["kind"] })
const toMovement = (dto: Schemas["StockMovementDto"]): StockMovement => ({ ...withoutNulls(dto), type: dto.type as MovementType })
const toLot = (dto: Schemas["StockLotDto"]): StockLot => withoutNulls(dto)
const toSupplier = (dto: Schemas["SupplierDto"]): Supplier => withoutNulls(dto)
const toOrder = (dto: Schemas["PurchaseOrderDto"]): PurchaseOrder => ({
  ...withoutNulls(dto),
  status: dto.status as PurchaseOrderStatus,
  lines: dto.lines.map((line) => withoutNulls(line)),
})
const toCycle = (dto: Schemas["SterilizationCycleDto"]): SterilizationCycle => ({ ...withoutNulls(dto), result: dto.result as SterilizationResult })

export const httpInventoryApi: InventoryApi = {
  async list(query, signal) {
    const page = await apiGet<Paginated<ItemDto>>("/inventory/items", { params: query, signal })
    return { ...page, items: page.items.map(toItem) }
  },
  async listOptions(signal) {
    const options = await apiGet<Schemas["InventoryItemOptionDto"][]>("/inventory/items/options", { signal })
    return options.map((dto): InventoryItemOption => ({ ...dto, kind: dto.kind as InventoryItemOption["kind"] }))
  },
  async get(id, signal) {
    return toItem(await apiGet<ItemDto>(`/inventory/items/${id}`, { signal }))
  },
  async create(values) {
    return toItem(await apiPost<ItemDto>("/inventory/items", values))
  },
  async update(id, values) {
    return toItem(await apiPut<ItemDto>(`/inventory/items/${id}`, values))
  },
  async remove(id) {
    await apiDelete(`/inventory/items/${id}`)
  },
  async listMovements(itemId, signal) {
    return (await apiGet<Schemas["StockMovementDto"][]>(`/inventory/items/${itemId}/movements`, { signal })).map(toMovement)
  },
  async registerMovement(itemId, values) {
    const body: Schemas["MovementRequest"] = { ...values, expirationDate: values.expirationDate || null }
    return toMovement(await apiPost<Schemas["StockMovementDto"]>(`/inventory/items/${itemId}/movements`, body))
  },
  async listLots(itemId, signal) {
    return (await apiGet<Schemas["StockLotDto"][]>(`/inventory/items/${itemId}/lots`, { signal })).map(toLot)
  },
  async listSuppliers(signal) {
    return (await apiGet<Schemas["SupplierDto"][]>("/inventory/suppliers", { signal })).map(toSupplier)
  },
  async createSupplier(values) {
    return toSupplier(await apiPost<Schemas["SupplierDto"]>("/inventory/suppliers", values))
  },
  async updateSupplier(id, values) {
    return toSupplier(await apiPut<Schemas["SupplierDto"]>(`/inventory/suppliers/${id}`, values))
  },
  async removeSupplier(id) {
    await apiDelete(`/inventory/suppliers/${id}`)
  },
  async listPurchaseOrders(signal) {
    return (await apiGet<Schemas["PurchaseOrderDto"][]>("/inventory/purchase-orders", { signal })).map(toOrder)
  },
  async createPurchaseOrder(values) {
    const body: Schemas["PurchaseOrderRequest"] = {
      ...values,
      lines: values.lines.map((line) => ({ ...line, expirationDate: line.expirationDate || null })),
    }
    return toOrder(await apiPost<Schemas["PurchaseOrderDto"]>("/inventory/purchase-orders", body))
  },
  async receivePurchaseOrder(id) {
    return toOrder(await apiPost<Schemas["PurchaseOrderDto"]>(`/inventory/purchase-orders/${id}/receive`))
  },
  async cancelPurchaseOrder(id) {
    return toOrder(await apiPost<Schemas["PurchaseOrderDto"]>(`/inventory/purchase-orders/${id}/cancel`))
  },
  async listSterilizationCycles(signal) {
    return (await apiGet<Schemas["SterilizationCycleDto"][]>("/inventory/sterilization-cycles", { signal })).map(toCycle)
  },
  async createSterilizationCycle(values) {
    return toCycle(await apiPost<Schemas["SterilizationCycleDto"]>("/inventory/sterilization-cycles", values))
  },
}
