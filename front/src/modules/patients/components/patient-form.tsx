import { zodResolver } from "@hookform/resolvers/zod"
import { Controller,useWatch } from "react-hook-form"
import { useValidatedForm as useForm } from "@/shared/hooks/use-validated-form"
import { PatientDuplicateHint } from "./patient-duplicate-hint"
import { useEffect, useRef } from "react"
import { Accordion } from "@base-ui/react/accordion"
import { CalendarDays, ClipboardCheck, Phone, ShieldCheck, UserRound } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { FormActions } from "@/components/ui/form-actions"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { getErrorMessage } from "@/shared/lib/error-message"
import { formatDateOnly } from "@/shared/lib/date"
import { ApiError } from "@/shared/types/common"
import { useCreatePatient, usePatient, useUpdatePatient } from "../api/patients.queries"
import { genderOptions, maritalStatusOptions, toPatientFormValues, treatmentStatusOptions, type Patient, type PatientFormValues } from "../types/patient.types"
import { documentTypes, patientAge, patientEditorSchema } from "../lib/patient-validation"
import { usePatientLastVisit } from "../hooks/use-patient-last-visit"
import { usePatientAccordion } from "../hooks/use-patient-accordion"
import { PatientFormSection } from "./patient-ui"

const sections = {
  personal: ["firstName", "lastName", "documentType", "documentId", "birthDate", "gender", "maritalStatus", "occupation", "company", "nationality", "treatmentStatus"],
  contact: ["phone", "email", "address", "city"],
  emergency: ["emergencyContactName", "emergencyContactPhone", "emergencyContactRelationship", "insuranceProvider", "insurancePolicy"],
  preferences: ["consentSigned", "notificationsEnabled", "notes"],
} satisfies Record<string, (keyof PatientFormValues)[]>

interface PatientFormProps {
  patientId?: string
  presentation?: "page" | "dialog"
  initialSection?: string | null
  onSaved: (patient: Patient) => void
  onCancel: () => void
  onDirtyChange?: (dirty: boolean) => void
  onSubmittingChange?: (busy: boolean) => void
}

export function PatientForm({ patientId: id, presentation = "page", initialSection: requestedSection, onSaved, onCancel, onDirtyChange, onSubmittingChange }: PatientFormProps) {
  const patientQuery = usePatient(id)
  const createPatient = useCreatePatient()
  const updatePatient = useUpdatePatient(id ?? "")
  const lastVisit = usePatientLastVisit(id)
  const initialised = useRef<string | null>(null)
  const form = useRef<HTMLFormElement>(null)
  const focusedSection = useRef<string | null>(null)
  const submitLock = useRef(false)
  const { openSectionId, requestSection, onValueChange } = usePatientAccordion(form)
  const { register, control, handleSubmit, reset, setError, trigger, formState: { errors, isSubmitting, isDirty } } = useForm({
    resolver: zodResolver(patientEditorSchema),
    shouldFocusError: false,
    shouldUnregister: false,
    defaultValues: {
      firstName: "", lastName: "", documentType: "cedula", documentId: "", birthDate: "", gender: "femenino",
      maritalStatus: "", occupation: "", company: "", nationality: "", phone: "", email: "", address: "", city: "", notes: "",
      notificationsEnabled: true, emergencyContactName: "", emergencyContactRelationship: "", emergencyContactPhone: "",
      insuranceProvider: "", insurancePolicy: "", consentSigned: false, treatmentStatus: "activo", lastVisitAt: "",
    },
  })
  const values = useWatch({ control })
  const saving = isSubmitting || updatePatient.isPending || createPatient.isPending
  const age = patientAge(values.birthDate ?? "")
  useEffect(() => { onDirtyChange?.(isDirty) }, [isDirty, onDirtyChange])
  useEffect(() => {
    if (!patientQuery.data || initialised.current === id) return
    reset({ ...toPatientFormValues(patientQuery.data), documentType: patientQuery.data.documentType ?? "otro" })
    initialised.current = id ?? null
  }, [patientQuery.data, id, reset])
  useEffect(() => {
    if (!id || !patientQuery.data || !requestedSection || !(requestedSection in sections) || focusedSection.current === requestedSection) return
    const frame = requestAnimationFrame(() => {
      const target = form.current?.querySelector<HTMLElement>(`#patient-section-${requestedSection}`)
      if (!target) return
      requestSection(target.id, "[data-patient-section-trigger]")
      focusedSection.current = requestedSection
    })
    return () => cancelAnimationFrame(frame)
  }, [id, patientQuery.data, requestedSection, requestSection])

  function revealErrors(names: string[]) {
    const firstField = names.find(name => Object.values(sections).some(fields => (fields as string[]).includes(name)))
    const target = Object.entries(sections).find(([, fields]) => (fields as string[]).includes(firstField ?? ""))
    if (!target || !firstField) return
    requestSection(`patient-section-${target[0]}`, `[id="${firstField}"]`)
  }
  async function onSubmit(data: PatientFormValues) {
    if (submitLock.current) return
    submitLock.current = true
    onSubmittingChange?.(true)
    try {
      if (id) { const updated = await updatePatient.mutateAsync(data); toast.success("Paciente actualizado"); onSaved(updated) }
      else { const created = await createPatient.mutateAsync(data); toast.success("Paciente creado"); onSaved(created) }
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors) {
        const names: string[] = []
        for (const issue of error.fieldErrors) if (issue.field in values) { setError(issue.field as keyof PatientFormValues, { message: issue.message }); names.push(issue.field) }
        revealErrors(names)
      }
      toast.error(getErrorMessage(error))
    } finally { submitLock.current = false; onSubmittingChange?.(false) }
  }
  function text(name: keyof PatientFormValues, label: string, type = "text", required = false) {
    const issue = errors[name]
    return <Field key={name} data-patient-field={name} data-invalid={!!issue} data-patient-short={name === "birthDate" || name === "nationality" || undefined}>
      <FieldLabel htmlFor={name}>{label}{required && <span aria-hidden="true" className="text-destructive">*</span>}</FieldLabel>
      <Input id={name} type={type} {...register(name, name === "documentId" ? { onBlur: () => { void trigger("documentId") } } : undefined)} aria-required={required} aria-invalid={!!issue} aria-describedby={issue ? `${name}-error` : undefined} max={type === "date" ? new Date().toLocaleDateString("en-CA") : undefined} />
      <FieldError id={`${name}-error`} errors={issue ? [issue] : undefined} />
    </Field>
  }
  function select(name: "documentType" | "gender" | "maritalStatus" | "treatmentStatus", label: string, options: readonly { value: string; label: string }[]) {
    const issue = errors[name]
    const items = { __none__: "Sin registrar", ...Object.fromEntries(options.map(option => [option.value, option.label])) }
    return <Field key={name} data-patient-field={name} data-invalid={!!issue} data-patient-short={name !== "documentType" || undefined}><FieldLabel htmlFor={name}>{label}</FieldLabel>
      <Controller control={control} name={name} render={({ field }) => <Select items={items} value={field.value || "__none__"} onValueChange={value => field.onChange(value === "__none__" ? "" : value)}>
        <SelectTrigger id={name} className="w-full" aria-invalid={!!issue}><SelectValue /></SelectTrigger><SelectContent>
          {name === "maritalStatus" && <SelectItem value="__none__">Sin registrar</SelectItem>}
          {options.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
        </SelectContent>
      </Select>} />
      <FieldError errors={issue ? [issue] : undefined} />
    </Field>
  }
  const validation = patientEditorSchema.safeParse(values)
  const personalComplete = [values.firstName, values.lastName, values.documentId, values.birthDate, values.gender].every(Boolean)
    && (validation.success || !validation.error.issues.some(issue => sections.personal.includes(issue.path[0] as typeof sections.personal[number])))
  const hasInformation = (fields: (keyof PatientFormValues)[]) => fields.some(field => !!values[field]) ? "Con información" : "Opcional"
  const hasErrors = (fields: (keyof PatientFormValues)[]) => fields.some(field => !!errors[field])
  if (id && patientQuery.isLoading) return <div className="patient-form-loading"><Skeleton className="h-10 w-full" /><Skeleton className="h-96 w-full" /></div>
  if (id && (patientQuery.isError || !patientQuery.data)) return <div role="alert" className="patient-source-error"><p>No se pudo cargar el paciente. No se ha abierto un formulario vacío.</p><Button variant="outline" onClick={() => patientQuery.refetch()}>Reintentar</Button></div>

  return <form ref={form} noValidate aria-busy={saving} onSubmit={event => { void handleSubmit(onSubmit, invalid => revealErrors(Object.keys(invalid)))(event) }} className={`patient-editor-form ${presentation === "dialog" ? "patient-dialog-form" : ""}`}>
      <Accordion.Root className="patient-form-sections" multiple={false} keepMounted value={openSectionId ? [openSectionId] : []} onValueChange={onValueChange}>
      <PatientFormSection id="patient-section-personal" title="Datos personales" icon={UserRound} status={personalComplete ? "Completa" : "Obligatoria"} hasErrors={hasErrors(sections.personal)}>
        {text("firstName", "Nombres", "text", true)}{text("lastName", "Apellidos", "text", true)}
        {select("documentType", "Tipo de documento", documentTypes)}{text("documentId", "Número de documento", "text", true)}
        <PatientDuplicateHint documentId={values.documentId??""} documentType={values.documentType??"otro"} patientId={id}/>
        {text("birthDate", "Fecha de nacimiento", "date", true)}
        <div className="patient-readonly" data-patient-field="age" data-patient-short><span>Edad</span><output aria-live="polite">{age === null ? "Se calcula con la fecha de nacimiento" : `${age} ${age === 1 ? "año" : "años"}`}</output></div>
        {select("gender", "Género", genderOptions)}{select("treatmentStatus", "Estado y seguimiento", treatmentStatusOptions)}
        {select("maritalStatus", "Estado civil", maritalStatusOptions)}{text("nationality", "Nacionalidad")}
        {text("occupation", "Ocupación")}{text("company", "Empresa / institución")}
        {id && !patientQuery.data?.documentType && <p className="patient-field-help">El registro anterior no especifica el tipo de documento. Su número se conserva; selecciona Cédula si deseas comprobarlo.</p>}
      </PatientFormSection>
      <PatientFormSection id="patient-section-contact" title="Información de contacto" icon={Phone} status={hasInformation(sections.contact)} hasErrors={hasErrors(sections.contact)}>
        {text("phone", "Teléfono", "tel")}{text("email", "Correo electrónico", "email")}{text("address", "Dirección")}{text("city", "Ciudad / provincia")}
        <p className="patient-field-help">Estos datos son opcionales. Si los ingresas, revisa su formato.</p>
      </PatientFormSection>
      <PatientFormSection id="patient-section-emergency" title="Emergencia y seguro" icon={ShieldCheck} status={hasInformation(sections.emergency)} hasErrors={hasErrors(sections.emergency)}>
        {text("emergencyContactName", "Contacto de emergencia")}{text("emergencyContactPhone", "Teléfono del contacto", "tel")}
        {text("emergencyContactRelationship", "Parentesco")}{text("insuranceProvider", "Seguro / convenio")}{text("insurancePolicy", "Número de póliza")}
      </PatientFormSection>
      <PatientFormSection id="patient-section-preferences" title="Consentimientos y preferencias" icon={ClipboardCheck} status="Preferencias" hasErrors={hasErrors(sections.preferences)}>
        {([{ name: "consentSigned", label: "Consentimiento informado firmado", description: "Conserva el registro de consentimiento informado existente. El consentimiento de datos personales se administra por separado en la historia clínica." },
          { name: "notificationsEnabled", label: "Notificaciones habilitadas", description: "Permite los recordatorios y avisos de citas para este paciente." }] as const).map(item => <Field key={item.name} orientation="horizontal" className="patient-preference">
          <FieldLabel htmlFor={item.name} className="flex-1">{item.label}<FieldDescription>{item.description}</FieldDescription></FieldLabel>
          <Controller control={control} name={item.name} render={({ field }) => <Switch id={item.name} checked={field.value} onCheckedChange={field.onChange} />} />
        </Field>)}
        <Field className="patient-notes"><FieldLabel htmlFor="notes">Observaciones del registro</FieldLabel><Textarea id="notes" rows={3} {...register("notes")} /><FieldDescription>Estas observaciones no reemplazan las anotaciones de la historia clínica.</FieldDescription></Field>
      </PatientFormSection>
      <p className="patient-visit-info"><CalendarDays aria-hidden="true" />Última visita: {id ? lastVisit.isLoading ? "Cargando…" : lastVisit.isError ? "No disponible" : lastVisit.date ? formatDateOnly(lastVisit.date) : "Sin atenciones completadas" : "Se obtiene de las atenciones completadas."}</p>
      </Accordion.Root>
      <FormActions context={presentation} className="patient-form-footer"><Button type="button" variant="outline" disabled={saving} onClick={onCancel}>Cancelar</Button><Button type="submit" disabled={saving}>{saving ? "Guardando…" : id ? "Guardar cambios" : "Crear paciente"}</Button></FormActions>
    </form>
}
