import { useRef } from "react"
import { FormProvider, Controller, useForm, useWatch, type FieldErrors } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { FieldError } from "@/components/ui/field"
import { useProfessionals } from "@/modules/appointments/api/appointments.queries"
import { selectable } from "@/modules/appointments/types/appointment.types"
import { getErrorMessage } from "@/shared/lib/error-message"
import { useCreateSterilizationCycle } from "../api/inventory.queries"
import { useInventoryCatalog } from "../hooks/use-inventory-catalog"
import { useInventoryAccordion } from "../hooks/use-inventory-accordion"
import { useInventorySubmit } from "../hooks/use-inventory-submit"
import { sterilizationCycleSchema, sterilizationResultLabels, sterilizationResults, type SterilizationCycleFormValues } from "../types/inventory.types"
import { InventoryDialog } from "./inventory-dialog"
import { InventoryField, InventoryFormError } from "./inventory-form-fields"
import { InventorySections } from "./inventory-sections"

interface Props { open: boolean; onOpenChange: (open: boolean) => void }
export function SterilizationCycleFormDialog(props: Props) { return props.open ? <CycleEditor onClose={() => props.onOpenChange(false)} /> : null }
function CycleEditor({ onClose }: { onClose: () => void }) {
  const inventory = useInventoryCatalog(), professionals = useProfessionals(), create = useCreateSterilizationCycle()
  const instruments = (inventory.data ?? []).filter(item => item.kind === "instrumental")
  const form = useForm<SterilizationCycleFormValues>({ resolver: zodResolver(sterilizationCycleSchema), shouldUnregister: false, shouldFocusError: false, defaultValues: { itemIds: [], performedAt: new Date().toISOString().slice(0, 10), result: "aprobado", responsibleProfessionalId: "", notes: "" } })
  const selected = useWatch({ control: form.control, name: "itemIds" })
  const element = useRef<HTMLFormElement>(null), accordion = useInventoryAccordion(element)
  const reveal = (field: string) => accordion.request(field === "itemIds" ? "instruments" : field === "result" || field === "notes" ? "results" : "general", `[id="${CSS.escape(field)}"]`)
  const save = useInventorySubmit(form, values => create.mutateAsync(values), "Ciclo de esterilización registrado", reveal)
  const invalid = (errors: FieldErrors<SterilizationCycleFormValues>) => { const first = Object.keys(errors)[0]; if(first) reveal(first) }
  const { errors, isDirty, isSubmitting } = form.formState
  return <InventoryDialog size="cycle" title="Nuevo ciclo de esterilización" description="Registra el instrumental, el responsable y el resultado real del ciclo." dirty={isDirty} pending={isSubmitting} onClose={onClose}>
    {({ close, cancel }) => <FormProvider {...form}><form ref={element} className="inventory-editor" noValidate onSubmit={event => void form.handleSubmit(values => save(values, close), invalid)(event)}><InventoryFormError /><fieldset disabled={isSubmitting}><InventorySections controller={accordion} groups={[
      { id: "general", title: "Información del ciclo", invalid: Boolean(errors.performedAt || errors.responsibleProfessionalId), content: <><div className="inventory-form-grid"><InventoryField name="performedAt" label="Fecha" type="date" /><InventoryField name="responsibleProfessionalId" label="Responsable" options={selectable(professionals.data).map(professional => ({ value: professional.id, label: professional.name + " · " + professional.specialty }))} disabled={professionals.isPending || professionals.isError} /></div>{professionals.isError && <Alert variant="destructive"><AlertTitle>No se pudieron cargar los responsables</AlertTitle><AlertDescription>{getErrorMessage(professionals.error)}</AlertDescription><Button type="button" variant="outline" onClick={() => void professionals.refetch()}>Reintentar</Button></Alert>}</> },
      { id: "instruments", title: "Instrumental incluido", summary: `${selected.length} seleccionados`, invalid: Boolean(errors.itemIds), content: <><div id="itemIds" tabIndex={-1} aria-describedby={errors.itemIds ? "itemIds-error" : undefined}>{inventory.isPending ? <p className="inventory-hint">Cargando instrumental…</p> : inventory.isError ? <Alert variant="destructive"><AlertTitle>No se pudo cargar el instrumental</AlertTitle><AlertDescription>{getErrorMessage(inventory.error)}</AlertDescription><Button type="button" variant="outline" onClick={() => void inventory.refetch()}>Reintentar</Button></Alert> : instruments.length === 0 ? <p className="inventory-hint">No hay insumos marcados como instrumental esterilizable. Márcalos desde el formulario de insumo.</p> : <Controller control={form.control} name="itemIds" render={({ field }) => <div className="inventory-instrument-list">{instruments.map(item => <label key={item.id}><Checkbox checked={field.value.includes(item.id)} onCheckedChange={checked => field.onChange(checked ? [...field.value, item.id] : field.value.filter(id => id !== item.id))} /><span>{item.name}</span></label>)}</div>} />}</div><FieldError id="itemIds-error" errors={errors.itemIds ? [errors.itemIds] : undefined} /></> },
      { id: "results", title: "Resultado y observaciones", invalid: Boolean(errors.result || errors.notes), content: <><InventoryField name="result" label="Resultado" options={sterilizationResults.map(value => ({ value, label: sterilizationResultLabels[value] }))} /><InventoryField name="notes" label="Notas (opcional)" type="textarea" /></> },
    ]} /></fieldset><div className="inventory-form-actions"><Button type="button" variant="outline" disabled={isSubmitting} onClick={cancel}>Cancelar</Button><Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Guardando..." : "Registrar ciclo"}</Button></div></form></FormProvider>}
  </InventoryDialog>
}
