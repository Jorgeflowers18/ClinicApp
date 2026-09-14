import { z } from "zod"

export const itemKinds = ["consumible", "instrumental"] as const
export type ItemKind = (typeof itemKinds)[number]

export const itemKindLabels: Record<ItemKind, string> = {
  consumible: "Consumible",
  instrumental: "Instrumental esterilizable",
}

export const inventoryItemSchema = z.object({
  name: z.string().min(2, "Mínimo 2 caracteres"),
  category: z.string().min(2, "Mínimo 2 caracteres"),
  unit: z.string().min(1, "La unidad es obligatoria"),
  kind: z.enum(itemKinds, { message: "Selecciona un tipo de insumo" }),
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
  expirationDate: z.string().optional(),
})

export type MovementFormValues = z.infer<typeof movementSchema>

/**
 * Una salida que abarca más de un lote (FEFO: primero en vencer, primero en salir) genera
 * un `StockMovement` por cada lote tocado, no uno solo con múltiples lotes.
 */
export interface StockMovement {
  id: string
  itemId: string
  type: MovementType
  quantity: number
  reason: string
  lotId?: string
  treatmentAssignmentId?: string
  patientId?: string
  purchaseOrderId?: string
  createdAt: string
}

/** Lote de stock: se crea en cada entrada (compra o ajuste manual) y se consume por FEFO. */
export interface StockLot {
  id: string
  itemId: string
  quantity: number
  expirationDate?: string
  purchaseOrderId?: string
  receivedAt: string
}

export const supplierSchema = z.object({
  name: z.string().min(2, "Mínimo 2 caracteres"),
  contactName: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email("Correo inválido").or(z.literal("")).optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
})

export type SupplierFormValues = z.infer<typeof supplierSchema>

export interface Supplier extends SupplierFormValues {
  id: string
  createdAt: string
}

export const purchaseOrderStatuses = ["pendiente", "recibida", "cancelada"] as const
export type PurchaseOrderStatus = (typeof purchaseOrderStatuses)[number]

export const purchaseOrderStatusLabels: Record<PurchaseOrderStatus, string> = {
  pendiente: "Pendiente",
  recibida: "Recibida",
  cancelada: "Cancelada",
}

export const purchaseOrderLineSchema = z.object({
  itemId: z.string().min(1, "Selecciona un insumo"),
  quantity: z.coerce.number().int().min(1, "Mínimo 1"),
  unitCost: z.coerce.number().min(0, "No puede ser negativo"),
  expirationDate: z.string().optional(),
})

export const purchaseOrderSchema = z.object({
  supplierId: z.string().min(1, "Selecciona un proveedor"),
  lines: z.array(purchaseOrderLineSchema).min(1, "Agrega al menos una línea"),
  notes: z.string().optional(),
})

export type PurchaseOrderFormValues = z.infer<typeof purchaseOrderSchema>
export type PurchaseOrderLine = z.infer<typeof purchaseOrderLineSchema>

export interface PurchaseOrder extends PurchaseOrderFormValues {
  id: string
  status: PurchaseOrderStatus
  createdAt: string
  receivedAt?: string
}

export const sterilizationResults = ["aprobado", "fallido"] as const
export type SterilizationResult = (typeof sterilizationResults)[number]

export const sterilizationResultLabels: Record<SterilizationResult, string> = {
  aprobado: "Aprobado",
  fallido: "Fallido",
}

export const sterilizationCycleSchema = z.object({
  itemIds: z.array(z.string()).min(1, "Selecciona al menos un instrumento"),
  performedAt: z.string().min(1, "La fecha es obligatoria"),
  result: z.enum(sterilizationResults, { message: "Selecciona un resultado" }),
  responsibleProfessionalId: z.string().min(1, "Selecciona un responsable"),
  notes: z.string().optional(),
})

export type SterilizationCycleFormValues = z.infer<typeof sterilizationCycleSchema>

export interface SterilizationCycle extends SterilizationCycleFormValues {
  id: string
  createdAt: string
}
