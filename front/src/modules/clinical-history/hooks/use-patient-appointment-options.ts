import { useMemo } from "react"
import { format } from "date-fns"

import { useAppointmentsByPatient, useProfessionals } from "@/modules/appointments/api/appointments.queries"
import type { Appointment, AppointmentStatus } from "@/modules/appointments/types/appointment.types"
import { formatDateTime, formatTime } from "@/shared/lib/date"

import type { ClinicalEncounter } from "../types/clinical-history.types"

/** Valor del `Select` de citas que representa "sin cita vinculada" (el modelo guarda `null`). */
export const NO_APPOINTMENT = "sin-cita"

/** Estados de cita que se pueden vincular a una atención. */
export const linkableAppointmentStatuses: readonly AppointmentStatus[] = ["programada", "confirmada", "completada"]

export interface AppointmentOption {
  appointment: Appointment
  /** Fecha local YYYY-MM-DD de la cita, para precargar la fecha de la atención. */
  date: string
  label: string
}

/**
 * Citas del paciente que se pueden vincular a una atención nueva: las vigentes o completadas que
 * no están ya vinculadas a otra atención (una cita por atención).
 */
export function usePatientAppointmentOptions(patientId: string, encounters: readonly ClinicalEncounter[] | undefined) {
  const { data: appointments, isLoading } = useAppointmentsByPatient(patientId)
  const { data: professionals } = useProfessionals()

  const options = useMemo<AppointmentOption[]>(() => {
    const linked = new Set((encounters ?? []).map((encounter) => encounter.appointmentId).filter(Boolean))
    return (appointments ?? [])
      .filter((appointment) => linkableAppointmentStatuses.includes(appointment.status) && !linked.has(appointment.id))
      .map((appointment) => {
        const professional = professionals?.find((item) => item.id === appointment.professionalId)
        const day = formatDateTime(appointment.start, { day: "2-digit", month: "short", year: "numeric" })
        return {
          appointment,
          date: format(new Date(appointment.start), "yyyy-MM-dd"),
          label: `${day} · ${formatTime(appointment.start)}${professional ? ` · ${professional.name}` : ""}`,
        }
      })
  }, [appointments, professionals, encounters])

  return { options, isLoading }
}
