import { useEffect, useRef, useState } from "react"
import { Accordion } from "@base-ui/react/accordion"
import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useFieldArray, useForm, type FieldErrors, type Path } from "react-hook-form"
import { ChevronDown, CircleAlert, Package, Plus, Stethoscope, Trash2, X } from "lucide-react"
import { toast } from "sonner"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NumericInput } from "@/components/ui/numeric-input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { ConfirmDialog } from "@/shared/components/confirm-dialog"
import { getErrorMessage } from "@/shared/lib/error-message"
import { queryClient } from "@/shared/lib/query-client"
import { ApiError } from "@/shared/types/common"
import { financeKeys } from "@/modules/finance/api/finance.queries"
import { useCreateTreatment, useTreatment, useUpdateTreatment } from "../api/treatments.queries"
import { useTreatmentAccordion } from "../hooks/use-treatment-accordion"
import { useTreatmentInventory } from "../hooks/use-treatment-options"
import { treatmentSchema, type Treatment, type TreatmentFormValues } from "../types/treatment.types"
import "../treatments.css"

interface TreatmentFormDialogProps {
  treatmentId?: string
  returnFocus?: () => HTMLElement | null
  onClose: () => void
}

export function TreatmentFormDialog({ treatmentId, returnFocus, onClose }: TreatmentFormDialogProps) {
  const treatment = useTreatment(treatmentId)
  const [open, setOpen] = useState(true)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [discarding, setDiscarding] = useState(false)
  const heading = useRef<HTMLHeadingElement>(null)
  const finishing = useRef(false)
  function finishClose() { finishing.current = true; setDiscarding(false); setOpen(false) }
  function requestClose() {
    if(saving || discarding) return
    if(dirty) setDiscarding(true)
    else finishClose()
  }
  return <Dialog open={open} disablePointerDismissal={saving} onOpenChange={(next, details) => {
    if(!next) { details.cancel(); requestClose() }
  }} onOpenChangeComplete={next => { if(!next && finishing.current) onClose() }}>
    <DialogContent variant="wide" className="treatment-dialog" showCloseButton={false} initialFocus={heading}
      finalFocus={() => { const target = returnFocus?.(); return target?.isConnected ? target : true }}>
      <DialogHeader className="treatment-dialog-heading"><div>
        <DialogTitle ref={heading} tabIndex={-1}>{treatmentId ? "Editar tratamiento" : "Nuevo tratamiento"}</DialogTitle>
        <DialogDescription>{treatmentId ? "Actualiza la información del tratamiento." : "Registra un nuevo tratamiento o servicio del catálogo."}</DialogDescription>
      </div><DialogClose render={<Button type="button" variant="ghost" size="icon" disabled={saving} aria-label="Cerrar formulario de tratamiento" />}><X aria-hidden="true" /></DialogClose></DialogHeader>
      <div className="treatment-editor-scroll">
        {treatmentId && treatment.isPending ? <div className="space-y-4 p-4" aria-label="Cargando tratamiento"><Skeleton className="h-10 w-full" /><Skeleton className="h-48 w-full" /></div>
          : treatmentId && !treatment.data ? <Alert variant="destructive" className="m-4 w-auto"><CircleAlert /><AlertTitle>No se pudo cargar el tratamiento</AlertTitle><AlertDescription>{getErrorMessage(treatment.error)}</AlertDescription><Button variant="outline" onClick={() => void treatment.refetch()}>Reintentar</Button></Alert>
            : <TreatmentEditor key={treatmentId ?? "new"} treatment={treatment.data} onDirtyChange={setDirty} onSavingChange={setSaving} onCancel={requestClose} onSaved={finishClose} />}
      </div>
      <ConfirmDialog open={discarding} onOpenChange={setDiscarding} title="¿Descartar los cambios?"
        description="Tienes cambios sin guardar. ¿Deseas salir sin guardarlos?" cancelLabel="Continuar editando"
        confirmLabel="Descartar cambios" destructive onConfirm={finishClose} />
    </DialogContent>
  </Dialog>
}

function TreatmentEditor({ treatment, onDirtyChange, onSavingChange, onCancel, onSaved }: {
  treatment?: Treatment
  onDirtyChange: (value: boolean) => void
  onSavingChange: (value: boolean) => void
  onCancel: () => void
  onSaved: () => void
}) {
  const inventory = useTreatmentInventory()
  const inventoryItems = inventory.data ?? []
  const createTreatment = useCreateTreatment()
  const updateTreatment = useUpdateTreatment(treatment?.id ?? "")
  const formElement = useRef<HTMLFormElement>(null)
  const locked = useRef(false)
  const form = useForm<TreatmentFormValues>({
    resolver: zodResolver(treatmentSchema), shouldUnregister: false, shouldFocusError: false,
    defaultValues: treatment ? {
      name: treatment.name, category: treatment.category, description: treatment.description ?? "",
      durationMinutes: treatment.durationMinutes, price: treatment.price, active: treatment.active, consumption: treatment.consumption,
    } : { name: "", category: "", description: "", durationMinutes: 30, price: 0, active: true, consumption: [] },
  })
  const { register, control, handleSubmit, formState: { errors, isDirty, isSubmitting } } = form
  const { fields, append, remove } = useFieldArray({ control, name: "consumption" })
  const accordion = useTreatmentAccordion(formElement)

  useEffect(() => onDirtyChange(isDirty), [isDirty, onDirtyChange])
  useEffect(() => {
    if(!isDirty) return
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [isDirty])

  function revealField(field: string) {
    accordion.request(field.startsWith("consumption") ? "consumption" : "general", `[id="${CSS.escape(field)}"]`)
  }
  function invalid(invalidFields: FieldErrors<TreatmentFormValues>) {
    const first = Object.keys(invalidFields)[0]
    if(first === "consumption") {
      const index = invalidFields.consumption?.findIndex?.(item => Boolean(item)) ?? 0
      const row = invalidFields.consumption?.[Math.max(index, 0)]
      revealField(`consumption.${Math.max(index, 0)}.${row?.itemId ? "itemId" : "quantity"}`)
    } else if(first) revealField(first)
  }
  async function submit(values: TreatmentFormValues) {
    if(locked.current) return
    locked.current = true
    onSavingChange(true)
    try {
      if(treatment) {
        await updateTreatment.mutateAsync(values)
        if(values.price !== treatment.price) void queryClient.invalidateQueries({ queryKey: financeKeys.all })
      }
      else await createTreatment.mutateAsync(values)
      toast.success(treatment ? "Tratamiento actualizado" : "Tratamiento creado")
      form.reset(values)
      onSaved()
    } catch(error) {
      if(error instanceof ApiError && error.fieldErrors?.length) {
        error.fieldErrors.forEach(({ field, message }) => form.setError(field as Path<TreatmentFormValues>, { type: "server", message }))
        revealField(error.fieldErrors[0].field)
      }
      toast.error(getErrorMessage(error))
    } finally { locked.current = false; onSavingChange(false) }
  }

  const groups = [
    { id: "general", title: "Información general", icon: Stethoscope, invalid: Object.keys(errors).some(key => key !== "consumption"), summary: treatment ? "Datos del catálogo" : "Datos del tratamiento" },
    { id: "consumption", title: "Consumo de insumos", icon: Package, invalid: Boolean(errors.consumption), summary: fields.length ? `${fields.length} ${fields.length === 1 ? "insumo" : "insumos"}` : "Sin insumos" },
  ]

  return <form ref={formElement} className="treatment-editor" noValidate aria-label={treatment ? "Editar tratamiento" : "Nuevo tratamiento"} onSubmit={event => void handleSubmit(submit, invalid)(event)}>
    <fieldset disabled={isSubmitting} className="treatment-form-fields">
      <Accordion.Root className="treatment-sections" value={accordion.open ? [accordion.open] : []} multiple={false} keepMounted onValueChange={accordion.onValueChange}>
        {groups.map(group => <Accordion.Item key={group.id} value={group.id} className="treatment-section" data-treatment-section={group.id}>
          <Accordion.Header><Accordion.Trigger className="treatment-section-trigger">
            <group.icon aria-hidden="true" /><span>{group.title}</span><small data-invalid={group.invalid || undefined}>{group.invalid ? <><CircleAlert aria-hidden="true" />Revisar</> : group.summary}</small><ChevronDown aria-hidden="true" className="treatment-section-chevron" />
          </Accordion.Trigger></Accordion.Header>
          <Accordion.Panel keepMounted className="treatment-section-panel" render={(props, state) => <div {...props} inert={!state.open} aria-hidden={!state.open || undefined} />}>
            <div className="treatment-section-content">
              {group.id === "general" ? <>
                <Field data-invalid={!!errors.name}><FieldLabel htmlFor="name">Nombre</FieldLabel><Input id="name" aria-describedby={errors.name ? "treatment-name-error" : undefined} aria-invalid={!!errors.name} {...register("name")} /><FieldError id="treatment-name-error" errors={errors.name ? [errors.name] : undefined} /></Field>
                <div className="treatment-general-grid">
                  <Field data-invalid={!!errors.category}><FieldLabel htmlFor="category">Categoría</FieldLabel><Input id="category" aria-describedby={errors.category ? "treatment-category-error" : undefined} aria-invalid={!!errors.category} {...register("category")} /><FieldError id="treatment-category-error" errors={errors.category ? [errors.category] : undefined} /></Field>
                  <Field data-invalid={!!errors.durationMinutes}><FieldLabel htmlFor="durationMinutes">Duración (minutos)</FieldLabel><NumericInput suffix="min" id="durationMinutes" aria-describedby={errors.durationMinutes ? "treatment-durationMinutes-error" : undefined}  min={5} aria-invalid={!!errors.durationMinutes} {...register("durationMinutes")} /><FieldError id="treatment-durationMinutes-error" errors={errors.durationMinutes ? [errors.durationMinutes] : undefined} /></Field>
                  <Field data-invalid={!!errors.price}><FieldLabel htmlFor="price">Precio (USD)</FieldLabel><NumericInput prefix="$" id="price" aria-describedby={errors.price ? "treatment-price-error" : undefined}  min={0} step="0.01" aria-invalid={!!errors.price} {...register("price")} /><FieldError id="treatment-price-error" errors={errors.price ? [errors.price] : undefined} /></Field>
                </div>
                <Field data-invalid={!!errors.description}><FieldLabel htmlFor="description">Descripción</FieldLabel><Textarea aria-invalid={!!errors.description} id="description" aria-describedby={errors.description ? "treatment-description-error" : undefined} rows={3} {...register("description")} /><FieldError id="treatment-description-error" errors={errors.description ? [errors.description] : undefined} /></Field>
                <Field orientation="horizontal" className="treatment-active-field"><FieldLabel htmlFor="active" className="flex-1">Tratamiento activo<FieldDescription id="treatment-active-description">Los tratamientos inactivos no aparecen al agendar citas.</FieldDescription></FieldLabel><Controller control={control} name="active" render={({ field }) => <Switch id="active" aria-describedby="treatment-active-description" checked={field.value} onCheckedChange={field.onChange} />} /></Field>
              </> : <>
                <div className="treatment-consumption-heading"><div><h3>Consumo de insumos por sesión</h3><p>Se descuentan del inventario al registrar el tratamiento en una atención.</p></div><Button type="button" variant="outline" size="sm" disabled={inventory.isPending || inventory.isError} onClick={() => append({ itemId: "", quantity: 1 })}><Plus />Agregar insumo</Button></div>
                {inventory.isError && <Alert variant="destructive"><AlertTitle>No se pudieron cargar los insumos</AlertTitle><AlertDescription>{getErrorMessage(inventory.error)}</AlertDescription><Button type="button" variant="outline" onClick={() => void inventory.refetch()}>Reintentar</Button></Alert>}
                {fields.length === 0 && <p className="treatment-empty">Este tratamiento no consume insumos de inventario.</p>}
                {fields.map((entry, index) => <div key={entry.id} className="treatment-consumption-row">
                  <Field data-invalid={!!errors.consumption?.[index]?.itemId}><FieldLabel htmlFor={`consumption.${index}.itemId`}>Insumo</FieldLabel>
                    <Controller control={control} name={`consumption.${index}.itemId`} render={({ field }) => {
                      const missing = field.value && !inventoryItems.some(item => item.id === field.value)
                      const items = { ...Object.fromEntries(inventoryItems.map(item => [item.id, item.name])), ...(missing ? { [field.value]: inventory.isPending ? "Cargando insumo…" : "Insumo no disponible" } : {}) }
                      return <Select items={items} value={field.value || null} onValueChange={field.onChange} disabled={inventory.isPending || inventory.isError}>
                        <SelectTrigger id={`consumption.${index}.itemId`} aria-describedby={errors.consumption?.[index]?.itemId ? `treatment-consumption-${index}-itemId-error` : undefined} aria-invalid={!!errors.consumption?.[index]?.itemId} className="w-full"><SelectValue placeholder="Selecciona un insumo..." /></SelectTrigger>
                        <SelectContent className="treatment-inventory-options">{inventoryItems.map(item => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent>
                      </Select>
                    }} /><FieldError id={`treatment-consumption-${index}-itemId-error`} errors={errors.consumption?.[index]?.itemId ? [errors.consumption[index]?.itemId] : undefined} />
                  </Field>
                  <Field data-invalid={!!errors.consumption?.[index]?.quantity}><FieldLabel htmlFor={`consumption.${index}.quantity`}>Cantidad</FieldLabel><Input id={`consumption.${index}.quantity`} aria-describedby={errors.consumption?.[index]?.quantity ? `treatment-consumption-${index}-quantity-error` : undefined} type="number" min={1} aria-invalid={!!errors.consumption?.[index]?.quantity} {...register(`consumption.${index}.quantity`)} /><FieldError id={`treatment-consumption-${index}-quantity-error`} errors={errors.consumption?.[index]?.quantity ? [errors.consumption[index]?.quantity] : undefined} /></Field>
                  <Button type="button" variant="ghost" size="icon" className="treatment-remove-supply" aria-label={`Quitar insumo ${index + 1}`} onClick={() => remove(index)}><Trash2 /></Button>
                </div>)}
              </>}
            </div>
          </Accordion.Panel>
        </Accordion.Item>)}
      </Accordion.Root>
    </fieldset>
    <div className="treatment-form-actions"><Button type="button" variant="outline" disabled={isSubmitting} onClick={onCancel}>Cancelar</Button><Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Guardando..." : treatment ? "Guardar cambios" : "Crear tratamiento"}</Button></div>
  </form>
}
