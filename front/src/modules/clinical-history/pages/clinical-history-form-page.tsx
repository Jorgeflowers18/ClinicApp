import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm } from "react-hook-form"
import { useNavigate, useParams, useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import { Paperclip, X } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/shared/components/page-header"
import { getErrorMessage } from "@/shared/lib/error-message"
import { usePatientsList } from "@/modules/patients/api/patients.queries"
import { useProfessionals } from "@/modules/appointments/api/appointments.queries"

import {
  useClinicalHistoryEntry,
  useCreateClinicalHistoryEntry,
  useUpdateClinicalHistoryEntry,
} from "../api/clinical-history.queries"
import { clinicalHistorySchema, type ClinicalHistoryFormValues } from "../types/clinical-history.types"

export function ClinicalHistoryFormPage() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const isEditMode = Boolean(id)
  const navigate = useNavigate()

  const { data: entry, isLoading: isLoadingEntry } = useClinicalHistoryEntry(id)
  const { data: patientsPage } = usePatientsList({ page: 1, pageSize: 100 })
  const { data: professionals } = useProfessionals()

  const createEntry = useCreateClinicalHistoryEntry()
  const updateEntry = useUpdateClinicalHistoryEntry(id ?? "")

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ClinicalHistoryFormValues>({
    resolver: zodResolver(clinicalHistorySchema),
    values: entry
      ? {
          patientId: entry.patientId,
          professionalId: entry.professionalId,
          date: entry.date,
          reason: entry.reason,
          diagnosis: entry.diagnosis,
          treatmentNotes: entry.treatmentNotes ?? "",
          attachments: entry.attachments,
        }
      : undefined,
    defaultValues: {
      patientId: searchParams.get("pacienteId") ?? "",
      professionalId: "",
      date: new Date().toISOString().slice(0, 10),
      reason: "",
      diagnosis: "",
      treatmentNotes: "",
      attachments: [],
    },
  })

  const attachments = watch("attachments")

  function addAttachments(files: FileList | null) {
    if (!files || files.length === 0) return
    const names = Array.from(files).map((file) => file.name)
    setValue("attachments", [...attachments, ...names], { shouldDirty: true })
  }

  function removeAttachment(name: string) {
    setValue(
      "attachments",
      attachments.filter((item) => item !== name),
      { shouldDirty: true }
    )
  }

  async function onSubmit(values: ClinicalHistoryFormValues) {
    try {
      if (isEditMode && id) {
        await updateEntry.mutateAsync(values)
        toast.success("Registro actualizado")
        navigate(`/historial-clinico/${id}`)
      } else {
        const created = await createEntry.mutateAsync(values)
        toast.success("Registro creado")
        navigate(`/historial-clinico/${created.id}`)
      }
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  if (isEditMode && isLoadingEntry) {
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
        title={isEditMode ? "Editar registro clínico" : "Nuevo registro clínico"}
        description="Dato clínico sensible. Solo visible para personal médico y administración."
      />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 rounded-xl border bg-background p-6">
        <FieldGroup>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field data-invalid={!!errors.patientId}>
              <FieldLabel htmlFor="patientId">Paciente</FieldLabel>
              <Controller
                control={control}
                name="patientId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="patientId" className="w-full">
                      <SelectValue placeholder="Selecciona un paciente..." />
                    </SelectTrigger>
                    <SelectContent>
                      {patientsPage?.items.map((patient) => (
                        <SelectItem key={patient.id} value={patient.id}>
                          {patient.firstName} {patient.lastName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <FieldError errors={errors.patientId ? [errors.patientId] : undefined} />
            </Field>

            <Field data-invalid={!!errors.professionalId}>
              <FieldLabel htmlFor="professionalId">Profesional</FieldLabel>
              <Controller
                control={control}
                name="professionalId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="professionalId" className="w-full">
                      <SelectValue placeholder="Selecciona un profesional..." />
                    </SelectTrigger>
                    <SelectContent>
                      {professionals?.map((professional) => (
                        <SelectItem key={professional.id} value={professional.id}>
                          {professional.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <FieldError errors={errors.professionalId ? [errors.professionalId] : undefined} />
            </Field>
          </div>

          <Field data-invalid={!!errors.date}>
            <FieldLabel htmlFor="date">Fecha de consulta</FieldLabel>
            <Input id="date" type="date" aria-invalid={!!errors.date} {...register("date")} />
            <FieldError errors={errors.date ? [errors.date] : undefined} />
          </Field>

          <Field data-invalid={!!errors.reason}>
            <FieldLabel htmlFor="reason">Motivo de consulta</FieldLabel>
            <Textarea id="reason" rows={2} aria-invalid={!!errors.reason} {...register("reason")} />
            <FieldError errors={errors.reason ? [errors.reason] : undefined} />
          </Field>

          <Field data-invalid={!!errors.diagnosis}>
            <FieldLabel htmlFor="diagnosis">Diagnóstico</FieldLabel>
            <Textarea id="diagnosis" rows={2} aria-invalid={!!errors.diagnosis} {...register("diagnosis")} />
            <FieldError errors={errors.diagnosis ? [errors.diagnosis] : undefined} />
          </Field>

          <Field>
            <FieldLabel htmlFor="treatmentNotes">Notas de tratamiento</FieldLabel>
            <Textarea id="treatmentNotes" rows={3} {...register("treatmentNotes")} />
          </Field>

          <Field>
            <FieldLabel htmlFor="attachments">Documentos adjuntos</FieldLabel>
            <label
              htmlFor="attachments"
              className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed p-4 text-sm text-muted-foreground hover:bg-muted/50"
            >
              <Paperclip className="size-4" />
              Adjuntar archivos (radiografías, resultados, consentimientos)
            </label>
            <input
              id="attachments"
              type="file"
              multiple
              className="sr-only"
              onChange={(event) => addAttachments(event.target.files)}
            />
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {attachments.map((name) => (
                  <Badge key={name} variant="secondary" className="gap-1">
                    {name}
                    <button
                      type="button"
                      onClick={() => removeAttachment(name)}
                      aria-label={`Quitar ${name}`}
                    >
                      <X className="size-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </Field>
        </FieldGroup>

        <div className="flex justify-end gap-2 border-t pt-4">
          <Button type="button" variant="outline" onClick={() => navigate(-1)}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Guardando..." : isEditMode ? "Guardar cambios" : "Crear registro"}
          </Button>
        </div>
      </form>
    </div>
  )
}
