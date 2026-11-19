import type { InventoryItem } from "../types/inventory.types"

export function inventoryUnit(unit: string, quantity: number) {
  const pair = [["unidad", "unidades"], ["caja", "cajas"], ["litro", "litros"], ["jeringa", "jeringas"]].find(values => values.includes(unit.trim().toLowerCase()))
  return pair ? pair[quantity === 1 ? 0 : 1] : unit
}
export function isCriticalStock(item: Pick<InventoryItem, "stock" | "minStock">) { return item.stock <= item.minStock }
export function inventoryStockState(item: Pick<InventoryItem, "stock" | "minStock">) {
  if(!Number.isFinite(item.stock) || !Number.isFinite(item.minStock)) return "unavailable"
  return isCriticalStock(item) ? item.stock === 0 ? "empty" : "critical" : "sufficient"
}
export function stockLabel(item: Pick<InventoryItem, "stock" | "minStock">) {
  const state = inventoryStockState(item)
  return state === "unavailable" ? "Sin datos" : state === "empty" ? "Agotado" : state === "critical" ? "Bajo mínimo" : "Suficiente"
}
