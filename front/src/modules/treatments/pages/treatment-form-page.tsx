import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useFieldArray, useForm } from "react-hook-form"
import { useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"
import { Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { PageHeader } from "@/shared/components/page-header"
import { getErrorMessage } from "@/shared/lib/error-message"
import { useInventoryList } from "@/modules/inventory/api/inventory.queries"

import { useCreateTreatment, useTreatment, useUpdateTreatment } from "../api/treatments.queries"
import { treatmentSchema, type TreatmentFormValues } from "../types/treatment.types"

export function TreatmentFormPage() {
  const { id } = useParams<{ id: string }>()
  const isEditMode = Boolean(id)
  const navigate = useNavigate()

  const { data: treatment, isLoading: isLoadingTreatment } = useTreatment(id)
  const { data: inventoryPage } = useInventoryList({ page: 1, pageSize: 100 })
  const inventoryItems = inventoryPage?.items ?? []

  const createTreatment = useCreateTreatment()
  const updateTreatment = useUpdateTreatment(id ?? "")

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<TreatmentFormValues>({
    resolver: zodResolver(treatmentSchema),
    values: treatment
      ? {
          name: treatment.name,
          category: treatment.category,
          description: treatment.description ?? "",
          durationMinutes: treatment.durationMinutes,
          price: treatment.price,
          active: treatment.active,
          consumption: treatment.consumption,
        }
      : undefined,
    defaultValues: {
      name: "",
      category: "",
      description: "",
      durationMinutes: 30,
      price: 0,
      active: true,
      consumption: [],
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: "consumption" })

  async function onSubmit(values: TreatmentFormValues) {
    try {
      if (isEditMode && id) {
        await updateTreatment.mutateAsync(values)
        toast.success("Tratamiento actualizado")
        navigate(`/tratamientos/${id}`)
      } else {
        const created = await createTreatment.mutateAsync(values)
        toast.success("Tratamiento creado")
        navigate(`/tratamientos/${created.id}`)
      }
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  if (isEditMode && isLoadingTreatment) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title={isEditMode ? "Editar tratamiento" : "Nuevo tratamiento"}
        description={
          isEditMode
            ? "Actualiza la información del tratamiento."
            : "Registra un nuevo tratamiento o servicio del catálogo."
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

            <Field data-invalid={!!errors.durationMinutes}>
              <FieldLabel htmlFor="durationMinutes">Duración (minutos)</FieldLabel>
              <Input
                id="durationMinutes"
                type="number"
                min={5}
                aria-invalid={!!errors.durationMinutes}
                {...register("durationMinutes")}
              />
              <FieldError errors={errors.durationMinutes ? [errors.durationMinutes] : undefined} />
            </Field>

            <Field data-invalid={!!errors.price}>
              <FieldLabel htmlFor="price">Precio (USD)</FieldLabel>
              <Input id="price" type="number" min={0} step="0.01" aria-invalid={!!errors.price} {...register("price")} />
              <FieldError errors={errors.price ? [errors.price] : undefined} />
            </Field>
          </div>

          <Field data-invalid={!!errors.description}>
            <FieldLabel htmlFor="description">Descripción</FieldLabel>
            <Textarea id="description" rows={3} {...register("description")} />
          </Field>

          <Field orientation="horizontal">
            <FieldLabel htmlFor="active" className="flex-1">
              Tratamiento activo
              <FieldDescription>Los tratamientos inactivos no aparecen al agendar citas.</FieldDescription>
            </FieldLabel>
            <Controller
              control={control}
              name="active"
              render={({ field }) => (
                <Switch id="active" checked={field.value} onCheckedChange={field.onChange} />
              )}
            />
          </Field>

          <FieldSeparator>Consumo de insumos</FieldSeparator>

          <div className="space-y-3">
            {fields.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Este tratamiento no consume insumos de inventario.
              </p>
            )}

            {fields.map((field, index) => (
              <div key={field.id} className="flex items-end gap-2">
                <Field className="flex-1" data-invalid={!!errors.consumption?.[index]?.itemId}>
                  <FieldLabel htmlFor={`consumption.${index}.itemId`}>Insumo</FieldLabel>
                  <Controller
                    control={control}
                    name={`consumption.${index}.itemId`}
                    render={({ field: itemField }) => (
                      <Select value={itemField.value} onValueChange={itemField.onChange}>
                        <SelectTrigger id={`consumption.${index}.itemId`} className="w-full">
                          <SelectValue placeholder="Selecciona un insumo..." />
                        </SelectTrigger>
                        <SelectContent>
                          {inventoryItems.map((item) => (
                            <SelectItem key={item.id} value={item.id}>
                              {item.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </Field>

                <Field className="w-28" data-invalid={!!errors.consumption?.[index]?.quantity}>
                  <FieldLabel htmlFor={`consumption.${index}.quantity`}>Cantidad</FieldLabel>
                  <Input
                    id={`consumption.${index}.quantity`}
                    type="number"
                    min={1}
                    {...register(`consumption.${index}.quantity` as const)}
                  />
                </Field>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => remove(index)}
                  aria-label="Quitar insumo"
                >
                  <Trash2 />
                </Button>
              </div>
            ))}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => append({ itemId: "", quantity: 1 })}
            >
              Agregar insumo
            </Button>
          </div>
        </FieldGroup>

        <div className="flex justify-end gap-2 border-t pt-4">
          <Button type="button" variant="outline" onClick={() => navigate(-1)}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Guardando..." : isEditMode ? "Guardar cambios" : "Crear tratamiento"}
          </Button>
        </div>
      </form>
    </div>
  )
}
