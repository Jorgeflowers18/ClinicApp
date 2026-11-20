import { Badge } from "@/components/ui/badge"
import { AlertTriangle, CircleCheck } from "lucide-react"
import type { InventoryItem } from "../types/inventory.types"

import { inventoryUnit, inventoryStockState, stockLabel } from "../lib/inventory-display"
import "../inventory.css"

export function StockQuantity({ quantity, unit, secondary = false }: { quantity?: number; unit?: string; secondary?: boolean }) {
  return <span className="inventory-stock-quantity" data-secondary={secondary || undefined}>{typeof quantity === "number" && Number.isFinite(quantity) ? <>{quantity}{unit ? " " + inventoryUnit(unit, quantity) : ""}</> : <span aria-label="Cantidad no disponible">—</span>}</span>
}
export function InventoryStockStatus({ item }: { item: Pick<InventoryItem, "stock" | "minStock"> }) {
  const state = inventoryStockState(item)
  return <span className="inventory-stock-state" data-state={state}>{state === "sufficient" ? <CircleCheck aria-hidden="true" /> : state !== "unavailable" ? <AlertTriangle aria-hidden="true" /> : null}{stockLabel(item)}</span>
}
export function InventoryStock({ item, progress = false }: { item: Pick<InventoryItem, "stock" | "minStock" | "unit">; progress?: boolean }) {
  return <div className="inventory-stock">
    <StockQuantity quantity={item.stock} unit={item.unit} />
    {progress && Number.isFinite(item.minStock) && Number.isFinite(item.stock) && item.minStock > 0 && item.stock >= 0 && <span className="inventory-stock-track" role="meter" aria-label="Stock actual respecto al mínimo" aria-valuemin={0} aria-valuemax={item.minStock} aria-valuenow={item.stock} aria-valuetext={`${item.stock} de ${item.minStock} ${inventoryUnit(item.unit, item.minStock)} del mínimo`}><span style={{ width: `${Math.min(item.stock / item.minStock * 100, 100)}%` }} /></span>}
  </div>
}
export function InventoryStatus({ label, tone }: { label: string; tone: "success" | "warning" | "danger" | "neutral" }) { return <Badge className="inventory-status" data-tone={tone}>{label}</Badge> }
