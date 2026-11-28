import { useRef, useState } from "react"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { CheckCircle2, Pencil, Power, Stethoscope } from "lucide-react"
import { useValidatedForm } from "@/shared/hooks/use-validated-form"
import { applyServerFieldErrors } from "@/shared/lib/field-issues"
import { getErrorMessage } from "@/shared/lib/error-message"
import { Button } from "@/components/ui/button"
import { AdministrativeStatusBadge } from "@/shared/components/administrative-status-badge"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DataTable } from "@/shared/components/data-table"
import { ConfirmDialog } from "@/shared/components/confirm-dialog"
import { useSaasData, useDemoContext } from "../state"
import { useSpecialtyCatalog, professionalSpecialtyIds } from "../lib/specialty-catalog"
import { useProfessionals } from "@/modules/appointments/api/appointments.queries"
import { useStaffInstitution } from "../lib/institution-scope"
import { demoId } from "../adapters/demo-repository"
import { demoStaffAdapter } from "../services"
import type { Specialty } from "../types"
import styles from "./administrative-ui.module.css"

const schema = z.object({ name: z.string().trim().min(1, "Ingresa el nombre de la especialidad").max(80, "Hasta 80 caracteres."), description: z.string().max(300, "Hasta 300 caracteres."), professionalTypeIds: z.array(z.string()) })
export function SpecialtyManagement({ onEdit }: { onEdit: (specialty: Specialty) => void }) {
  const data = useSaasData(), { organizationId } = useStaffInstitution()
  const catalog = useSpecialtyCatalog(), demo = useDemoContext(state => state.userId), professionals = useProfessionals({ enabled: !demo })
  const [failure, setFailure] = useState(""), [busyId, setBusyId] = useState<string | null>(null)
  const [deactivating, setDeactivating] = useState<Specialty | null>(null), lock = useRef(false)
  async function toggle(item: Specialty) {
    if (lock.current) return
    lock.current = true; setBusyId(item.id); setFailure("")
    try {
      await demoStaffAdapter.saveSpecialty({ ...item, active: !item.active })
      setDeactivating(null)
    } catch (error) { setFailure(getErrorMessage(error)) }
    finally { lock.current = false; setBusyId(null) }
  }
  return <div className="saas-stack">
    {failure && <p role="alert" className="text-destructive">{failure}</p>}
    <DataTable className={`staff-specialties-table ${styles.table}`} data={catalog} getRowId={item => item.id} mobileTitleKey="name" columns={[
      { key: "name", header: "Especialidad", cell: item => item.name },
      { key: "description", header: "Descripción", cell: item => item.description || "—" },
      { key: "types", header: "Tipos profesionales", cell: item => (data.professionalTypes ?? []).filter(type => item.professionalTypeIds?.includes(type.id)).map(type => type.name).join(" · ") || "Sin clasificar" },
      { key: "professionals", header: "Profesionales", cell: item => demo ? new Set(data.users.filter(user => user.professionalId && user.organizationIds.includes(organizationId) && user.specialtyIds.includes(item.id)).map(user => user.professionalId)).size : (professionals.data ?? []).filter(person => professionalSpecialtyIds(person, catalog, (data.serverStaffSettings?.[organizationId]?.[person.userId ?? ""] ?? data.serverStaffSettings?.[organizationId]?.["professional:" + person.id])?.specialtyIds).includes(item.id)).length },
      { key: "active", header: "Estado", cell: item => <AdministrativeStatusBadge kind="specialty" state={item.active ? "active" : "inactive"} /> },
      { key: "actions", header: "Acciones", cell: item => <div className="staff-specialty-actions">
        <Button size="sm" variant="outline" disabled={busyId !== null} onClick={() => onEdit(item)}><Pencil />Editar</Button>
        <Button size="sm" variant="outline" className="staff-state-action" data-active={item.active} disabled={busyId !== null} aria-busy={busyId === item.id} onClick={() => item.active ? (setFailure(""), setDeactivating(item)) : void toggle(item)}>
          {item.active ? <Power /> : <CheckCircle2 />}{busyId === item.id ? "Guardando…" : item.active ? "Desactivar" : "Activar"}
        </Button>
      </div> },
    ]} />
    {deactivating && <ConfirmDialog open onOpenChange={open => !open && !busyId && setDeactivating(null)} title="Desactivar especialidad"
      description={'«' + deactivating.name + '» dejará de estar disponible para nuevas asignaciones. Los profesionales que ya la tienen asignada conservarán su información histórica.' + (failure ? " " + failure : "")}
      confirmLabel="Desactivar" isLoading={busyId !== null} onConfirm={() => void toggle(deactivating)} />}
  </div>
}
export function SpecialtyEditor({ specialty, organizationId, onClose }: { specialty: Specialty | null; organizationId: string; onClose: () => void }) {
  const data = useSaasData()
  const root = useRef<HTMLDivElement>(null), [failure, setFailure] = useState("")
  const form = useValidatedForm({ resolver: zodResolver(schema), defaultValues: { name: specialty?.name ?? "", description: specialty?.description ?? "", professionalTypeIds: specialty?.professionalTypeIds ?? [] } }, root), errors = form.formState.errors
  function close() { if (!form.formState.isSubmitting && (!form.formState.isDirty || confirm("¿Descartar los cambios de la especialidad?"))) onClose() }
  return <Dialog open onOpenChange={open => !open && close()}><DialogContent variant="medium" className={`saas-scope ${styles.catalogDialog} ${styles.typeDialog}`}>
    <DialogHeader><DialogTitle className="saas-section-label"><Stethoscope aria-hidden="true" />{specialty ? "Editar especialidad" : "Nueva especialidad"}</DialogTitle><DialogDescription>Catálogo de especialidades de la institución.</DialogDescription></DialogHeader>
    <DialogBody ref={root} className={styles.catalogBody}><form id="specialty-form" className="saas-stack" noValidate onSubmit={form.handleSubmit(async value => {
      setFailure("")
      try {
        await demoStaffAdapter.saveSpecialty({ ...value, id: specialty?.id ?? demoId(), organizationId, active: specialty?.active ?? true })
        onClose()
      } catch (error) { if (!applyServerFieldErrors(form, error).length) setFailure(getErrorMessage(error)) }
    })}>
      <Field data-invalid={Boolean(errors.name)}><FieldLabel htmlFor="specialty-name">Nombre *</FieldLabel><Input id="specialty-name" {...form.register("name")} aria-invalid={Boolean(errors.name)} /><FieldError>{errors.name?.message}</FieldError></Field>
      <Field data-invalid={Boolean(errors.description)}><FieldLabel htmlFor="specialty-description">Descripción</FieldLabel><Textarea id="specialty-description" className={styles.description} {...form.register("description")} aria-invalid={Boolean(errors.description)} /><FieldError>{errors.description?.message}</FieldError></Field>
      <Field><FieldLabel>Tipos profesionales compatibles</FieldLabel><div className="saas-checks">{(data.professionalTypes ?? []).filter(type => type.organizationId === organizationId && (type.active || form.watch("professionalTypeIds").includes(type.id))).map(type => <label key={type.id} className="saas-check"><Checkbox checked={form.watch("professionalTypeIds").includes(type.id)} disabled={!type.active} onCheckedChange={checked => form.setValue("professionalTypeIds", checked ? [...form.getValues("professionalTypeIds"), type.id] : form.getValues("professionalTypeIds").filter(id => id !== type.id), { shouldDirty: true })} />{type.name}</label>)}</div><p className="saas-hint">Sin clasificación, la especialidad seguirá disponible sin asumir una profesión. Clasifícala para filtrar nuevas asignaciones.</p></Field>
      {failure && <p role="alert" className="text-destructive">{failure}</p>}
    </form></DialogBody>
    <DialogFooter><Button variant="outline" disabled={form.formState.isSubmitting} onClick={close}>Cancelar</Button><Button type="submit" form="specialty-form" disabled={form.formState.isSubmitting}>Guardar especialidad</Button></DialogFooter>
  </DialogContent></Dialog>
}
