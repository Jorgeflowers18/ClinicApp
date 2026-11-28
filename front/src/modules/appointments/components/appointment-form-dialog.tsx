import { useEffect } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { addMinutes, format } from "date-fns"
import { Controller,useWatch } from "react-hook-form"
import { useValidatedForm as useForm } from "@/shared/hooks/use-validated-form"
import { useDemoContext,useSaasData } from "@/modules/saas/state"
import { professionalAvailability, effectiveProfessionalState } from "@/modules/saas/lib/professional-policy"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { DialogFooter } from "@/components/ui/dialog"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { getErrorMessage } from "@/shared/lib/error-message"
import { applyServerFieldErrors } from "@/shared/lib/field-issues"
import { PatientCombobox } from "@/modules/patients/components/patient-combobox"
import { useActiveTreatments } from "@/modules/treatments/api/treatments.queries"

import {
  useCreateAppointment,
  useProfessionals,
  useRooms,
  useUpdateAppointment,
} from "../api/appointments.queries"
import { appointmentSchema, selectable, type AppointmentFormValues } from "../types/appointment.types"
import type { Appointment } from "../types/appointment.types"
import { ScheduleFormDialog } from "./schedule-form-dialog"

interface AppointmentFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  appointment?: Appointment
  initialSlot?: { date: string; startTime: string; endTime: string }
  initialPatientId?: string
}

export function AppointmentFormDialog({
  open,
  onOpenChange,
  appointment,
  initialSlot,
  initialPatientId,
}: AppointmentFormDialogProps) {
  const isEditMode = Boolean(appointment)
  const demo=useDemoContext(),saas=useSaasData()
  const { data: professionals } = useProfessionals()
  const { data: rooms } = useRooms()
  const { data: treatments } = useActiveTreatments()

  const createAppointment = useCreateAppointment()
  const updateAppointment = useUpdateAppointment(appointment?.id ?? "")

  const {
    register,
    control,
    handleSubmit,
    reset,
    getValues,
    setValue,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<AppointmentFormValues>({
    resolver: zodResolver(appointmentSchema),
    defaultValues: {
      patientId: "",
      professionalId: "",
      treatmentId: "",
      roomId: "",
      date: "",
      startTime: "",
      endTime: "",
      notes: "",
    },
  })

  useEffect(() => {
    if (!open) return

    if (appointment) {
      const start = new Date(appointment.start)
      const end = new Date(appointment.end)
      reset({
        patientId: appointment.patientId,
        professionalId: appointment.professionalId,
        treatmentId: appointment.treatmentId ?? "",
        roomId: appointment.roomId ?? "",
        date: toDateInputValue(start),
        startTime: toTimeInputValue(start),
        endTime: toTimeInputValue(end),
        notes: appointment.notes ?? "",
      })
    } else {
      reset({
        patientId: initialPatientId ?? "",
        professionalId: "",
        treatmentId: "",
        roomId: "",
        date: initialSlot?.date ?? "",
        startTime: initialSlot?.startTime ?? "",
        endTime: initialSlot?.endTime ?? "",
        notes: "",
      })
    }
  }, [open, appointment, initialSlot, initialPatientId, reset])
  const [selectedDate,selectedStart,selectedEnd,selectedProfessional]=useWatch({control,name:["date","startTime","endTime","professionalId"]})
  const availability=(id:string)=>{
    const member=saas.users.find(user=>user.professionalId===id)
    if(demo.userId&&selectedDate&&member)return professionalAvailability(member,demo.siteId,selectedDate,selectedStart||"09:00",selectedEnd||"09:30")
    const professional=professionals?.find(item=>item.id===id)
    const settings=saas.serverStaffSettings?.["frontend-institution-current"]
    const known=settings?.[professional?.userId??""]??settings?.["professional:"+id]
    if(!selectedDate||!known)return null
    const state=effectiveProfessionalState({professionalState:known.professionalState??"ACTIVE",absences:known.absences??[]},selectedDate)
    return state!=="ACTIVE"?"El profesional no está disponible en esa fecha según su estado o ausencia registrada.":null
  }
  const eligible=(professionals??[]).filter(item=>!availability(item.id)||item.id===selectedProfessional)

  function handleTreatmentChange(treatmentId: string | null, onChange: (value: string) => void) {
    onChange(treatmentId ?? "")

    const treatment = treatments?.find((item) => item.id === treatmentId)
    const startTime = getValues("startTime")
    if (!treatment || !startTime) return

    const anchor = new Date(`2000-01-01T${startTime}`)
    const endTime = format(addMinutes(anchor, treatment.durationMinutes), "HH:mm")
    setValue("endTime", endTime, { shouldValidate: true, shouldDirty: true })
  }

  async function onSubmit(values: AppointmentFormValues) {
    try {
      const issue=availability(values.professionalId)
      if(issue){setError("professionalId",{message:issue});return}
      if (isEditMode && appointment) {
        await updateAppointment.mutateAsync(values)
        toast.success("Cita actualizada")
      } else {
        await createAppointment.mutateAsync(values)
        toast.success("Cita creada")
      }
      onOpenChange(false)
    } catch (error) {
      // Un choque de horario (409) llega con errors.startTime: queda en el campo, además del aviso.
      // Si el servidor señala un campo, el mensaje queda solo en el campo; si no, en un aviso.
      if (!applyServerFieldErrors({ getValues, setError }, error).length) toast.error(getErrorMessage(error))
    }
  }

  return (
    <ScheduleFormDialog open={open} onOpenChange={onOpenChange} dirty={isDirty}
      busy={isSubmitting || createAppointment.isPending || updateAppointment.isPending}
      title={isEditMode ? "Editar cita" : "Nueva cita"}
      description={isEditMode
              ? "Modifica los datos de la cita. Se valida disponibilidad del profesional y del consultorio."
              : "Agenda una nueva cita. Se valida disponibilidad del profesional y del consultorio."}>
      {requestClose => <form onSubmit={handleSubmit(onSubmit)} className="clinic-schedule-form">
          <FieldGroup className="clinic-schedule-fields">
            <Field data-invalid={!!errors.patientId}>
              <FieldLabel htmlFor="patientId">Paciente</FieldLabel>
              <Controller
                control={control}
                name="patientId"
                render={({ field }) => (
                  <PatientCombobox id="patientId" value={field.value} onChange={field.onChange} invalid={!!errors.patientId}
                    placeholder="Busca por nombre, documento o N.° de historia…" />
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
                  <Select items={Object.fromEntries(selectable(eligible, field.value).map(item => [item.id, item.name]))} value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="professionalId" className="w-full">
                      <SelectValue placeholder="Selecciona un profesional..." />
                    </SelectTrigger>
                    <SelectContent className="clinic-schedule-options">
                      {selectable(eligible, field.value).map((professional) => (
                        <SelectItem key={professional.id} value={professional.id}>
                          {professional.name} · {professional.specialty}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <FieldError errors={errors.professionalId ? [errors.professionalId] : undefined} />
              {selectedProfessional&&availability(selectedProfessional)&&<p className="text-xs text-destructive">{availability(selectedProfessional)}</p>}
            </Field>

            <Field>
              <FieldLabel htmlFor="treatmentId">Tratamiento (opcional)</FieldLabel>
              <Controller
                control={control}
                name="treatmentId"
                render={({ field }) => (
                  <Select
                    items={Object.fromEntries((treatments ?? []).map(item => [item.id, item.name]))}
                    value={field.value}
                    onValueChange={(value) => handleTreatmentChange(value, field.onChange)}
                  >
                    <SelectTrigger id="treatmentId" className="w-full">
                      <SelectValue placeholder="Selecciona un tratamiento..." />
                    </SelectTrigger>
                    <SelectContent className="clinic-schedule-options">
                      {treatments?.map((treatment) => (
                        <SelectItem key={treatment.id} value={treatment.id}>
                          {treatment.name} · {treatment.durationMinutes} min
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="roomId">Consultorio (opcional)</FieldLabel>
              <Controller
                control={control}
                name="roomId"
                render={({ field }) => (
                  <Select items={Object.fromEntries(selectable(rooms, field.value).map(item => [item.id, item.name]))} value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="roomId" className="w-full">
                      <SelectValue placeholder="Selecciona un consultorio..." />
                    </SelectTrigger>
                    <SelectContent className="clinic-schedule-options">
                      {selectable(rooms, field.value).map((room) => (
                        <SelectItem key={room.id} value={room.id}>
                          {room.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>

            <div className="clinic-schedule-times clinic-schedule-wide">
              <Field data-invalid={!!errors.date}>
                <FieldLabel htmlFor="date">Fecha</FieldLabel>
                <Input id="date" type="date" aria-invalid={!!errors.date} {...register("date")} />
                <FieldError errors={errors.date ? [errors.date] : undefined} />
              </Field>

              <Field data-invalid={!!errors.startTime}>
                <FieldLabel htmlFor="startTime">Inicio</FieldLabel>
                <Input id="startTime" type="time" aria-invalid={!!errors.startTime} {...register("startTime")} />
                <FieldError errors={errors.startTime ? [errors.startTime] : undefined} />
              </Field>

              <Field data-invalid={!!errors.endTime}>
                <FieldLabel htmlFor="endTime">Fin</FieldLabel>
                <Input id="endTime" type="time" aria-invalid={!!errors.endTime} {...register("endTime")} />
                <FieldError errors={errors.endTime ? [errors.endTime] : undefined} />
              </Field>
            </div>

            <Field className="clinic-schedule-wide">
              <FieldLabel htmlFor="notes">Notas</FieldLabel>
              <Textarea id="notes" rows={2} {...register("notes")} />
            </Field>
          </FieldGroup>

          <DialogFooter>
            <Button type="button" variant="outline" disabled={isSubmitting} onClick={requestClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Guardando..." : isEditMode ? "Guardar cambios" : "Agendar cita"}
            </Button>
          </DialogFooter>
        </form>}
    </ScheduleFormDialog>
  )
}

function toDateInputValue(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function toTimeInputValue(date: Date) {
  const hours = String(date.getHours()).padStart(2, "0")
  const minutes = String(date.getMinutes()).padStart(2, "0")
  return `${hours}:${minutes}`
}
