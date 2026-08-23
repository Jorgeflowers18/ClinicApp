import { z } from "zod"

export const inventoryItemSchema = z.object({
  name: z.string().min(2, "Mínimo 2 caracteres"),
  category: z.string().min(2, "Mínimo 2 caracteres"),
  unit: z.string().min(1, "La unidad es obligatoria"),
  minStock: z.coerce.number().int().min(0, "No puede ser negativo"),
  unitCost: z.coerce.number().min(0, "No puede ser negativo"),
  supplier: z.string().optional(),
})

export type InventoryItemFormValues = z.infer<typeof inventoryItemSchema>

export interface InventoryItem extends InventoryItemFormValues {
  id: string
  stock: number
  createdAt: string
}

export const movementTypes = ["entrada", "salida"] as const
export type MovementType = (typeof movementTypes)[number]

export const movementSchema = z.object({
  type: z.enum(movementTypes, { message: "Selecciona un tipo de movimiento" }),
  quantity: z.coerce.number().int().min(1, "Mínimo 1"),
  reason: z.string().min(3, "Describe el motivo del movimiento"),
})

export type MovementFormValues = z.infer<typeof movementSchema>

export interface StockMovement {
  id: string
  itemId: string
  type: MovementType
  quantity: number
  reason: string
  createdAt: string
}
