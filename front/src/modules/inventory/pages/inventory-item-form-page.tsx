import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm } from "react-hook-form"
import { useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/shared/components/page-header"
import { getErrorMessage } from "@/shared/lib/error-message"

import {
  useCreateInventoryItem,
  useInventoryItem,
  useUpdateInventoryItem,
} from "../api/inventory.queries"
import { inventoryItemSchema, itemKindLabels, itemKinds, type InventoryItemFormValues } from "../types/inventory.types"

export function InventoryItemFormPage() {
  const { id } = useParams<{ id: string }>()
  const isEditMode = Boolean(id)
  const navigate = useNavigate()

  const { data: item, isLoading: isLoadingItem } = useInventoryItem(id)
  const createItem = useCreateInventoryItem()
  const updateItem = useUpdateInventoryItem(id ?? "")

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<InventoryItemFormValues>({
    resolver: zodResolver(inventoryItemSchema),
    values: item
      ? {
          name: item.name,
          category: item.category,
          unit: item.unit,
          kind: item.kind,
          minStock: item.minStock,
          unitCost: item.unitCost,
          supplier: item.supplier ?? "",
        }
      : undefined,
    defaultValues: {
      name: "",
      category: "",
      unit: "",
      kind: "consumible",
      minStock: 0,
      unitCost: 0,
      supplier: "",
    },
  })

  async function onSubmit(values: InventoryItemFormValues) {
    try {
      if (isEditMode && id) {
        await updateItem.mutateAsync(values)
        toast.success("Insumo actualizado")
        navigate(`/inventario/${id}`)
      } else {
        const created = await createItem.mutateAsync(values)
        toast.success("Insumo creado. Registra una entrada de stock para inicializarlo.")
        navigate(`/inventario/${created.id}`)
      }
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  if (isEditMode && isLoadingItem) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-80 w-full" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title={isEditMode ? "Editar insumo" : "Nuevo insumo"}
        description={
          isEditMode
            ? "Actualiza la información del insumo."
            : "Registra un nuevo insumo o producto médico. El stock inicial se agrega mediante un movimiento de entrada."
        }
      />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 rounded-xl border bg-background p-6">
        <FieldGroup>
          <Field data-invalid={!!errors.name}>
            <FieldLabel htmlFor="name">Nombre</FieldLabel>
            <Input id="name" aria-invalid={!!errors.name} {...register("name")} />
            <FieldError errors={errors.name ? [errors.name] : undefined} />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field data-invalid={!!errors.category}>
              <FieldLabel htmlFor="category">Categoría</FieldLabel>
              <Input id="category" aria-invalid={!!errors.category} {...register("category")} />
              <FieldError errors={errors.category ? [errors.category] : undefined} />
            </Field>

            <Field data-invalid={!!errors.unit}>
              <FieldLabel htmlFor="unit">Unidad de medida</FieldLabel>
              <Input id="unit" placeholder="unidad, caja, ml..." aria-invalid={!!errors.unit} {...register("unit")} />
              <FieldError errors={errors.unit ? [errors.unit] : undefined} />
            </Field>

            <Field data-invalid={!!errors.kind}>
              <FieldLabel htmlFor="kind">Tipo de insumo</FieldLabel>
              <Controller
                control={control}
                name="kind"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="kind" className="w-full" aria-invalid={!!errors.kind}>
                      <SelectValue placeholder="Selecciona..." />
                    </SelectTrigger>
                    <SelectContent>
                      {itemKinds.map((kind) => (
                        <SelectItem key={kind} value={kind}>
                          {itemKindLabels[kind]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <FieldError errors={errors.kind ? [errors.kind] : undefined} />
              <FieldDescription>El instrumental esterilizable se puede registrar en ciclos de esterilización.</FieldDescription>
            </Field>

            <Field data-invalid={!!errors.minStock}>
              <FieldLabel htmlFor="minStock">Stock mínimo</FieldLabel>
              <Input
                id="minStock"
                type="number"
                min={0}
                aria-invalid={!!errors.minStock}
                {...register("minStock")}
              />
              <FieldError errors={errors.minStock ? [errors.minStock] : undefined} />
              <FieldDescription>Se mostrará una alerta cuando el stock caiga a este nivel.</FieldDescription>
            </Field>

            <Field data-invalid={!!errors.unitCost}>
              <FieldLabel htmlFor="unitCost">Costo unitario (USD)</FieldLabel>
              <Input
                id="unitCost"
                type="number"
                min={0}
                step="0.01"
                aria-invalid={!!errors.unitCost}
                {...register("unitCost")}
              />
              <FieldError errors={errors.unitCost ? [errors.unitCost] : undefined} />
            </Field>
          </div>

          <Field data-invalid={!!errors.supplier}>
            <FieldLabel htmlFor="supplier">Proveedor</FieldLabel>
            <Input id="supplier" {...register("supplier")} />
          </Field>
        </FieldGroup>

        <div className="flex justify-end gap-2 border-t pt-4">
          <Button type="button" variant="outline" onClick={() => navigate(-1)}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Guardando..." : isEditMode ? "Guardar cambios" : "Crear insumo"}
          </Button>
        </div>
      </form>
    </div>
  )
}
