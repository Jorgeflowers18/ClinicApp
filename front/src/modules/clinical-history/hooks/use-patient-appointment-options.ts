import { useMemo } from "react"
import { format } from "date-fns"

import { useAppointmentsList, useProfessionals } from "@/modules/appointments/api/appointments.queries"
import type { Appointment, AppointmentStatus } from "@/modules/appointments/types/appointment.types"
import { formatDateTime, formatTime } from "@/shared/lib/date"

import type { DentalRecord } from "../types/clinical-history.types"

/** Valor del `Select` de citas que representa "sin cita vinculada" (el modelo guarda `null`). */
export const NO_APPOINTMENT = "sin-cita"

/** Estados de cita que se pueden vincular a una visita clínica. */
export const linkableAppointmentStatuses: readonly AppointmentStatus[] = ["programada", "confirmada", "completada"]

export interface AppointmentOption {
  appointment: Appointment
  /** Fecha local YYYY-MM-DD de la cita, para precargar la fecha de la visita. */
  date: string
  label: string
}

/**
 * Citas del paciente que se pueden vincular a una visita: las vigentes o completadas que no están
 * ya vinculadas a otra visita (`currentVisitId` conserva la cita de la visita que se está editando).
 */
export function usePatientAppointmentOptions(
  patientId: string,
  record: DentalRecord | undefined,
  currentVisitId?: string
) {
  const { data: appointments, isLoading } = useAppointmentsList()
  const { data: professionals } = useProfessionals()

  const options = useMemo<AppointmentOption[]>(() => {
    const linked = new Set(
      (record?.visits ?? [])
        .filter((visit) => visit.id !== currentVisitId && visit.appointmentId)
        .map((visit) => visit.appointmentId)
    )
    return (appointments ?? [])
      .filter((appointment) => appointment.patientId === patientId)
      .filter((appointment) => linkableAppointmentStatuses.includes(appointment.status) && !linked.has(appointment.id))
      .sort((a, b) => b.start.localeCompare(a.start))
      .map((appointment) => {
        const professional = professionals?.find((item) => item.id === appointment.professionalId)
        const day = formatDateTime(appointment.start, { day: "2-digit", month: "short", year: "numeric" })
        return {
          appointment,
          date: format(new Date(appointment.start), "yyyy-MM-dd"),
          label: `${day} · ${formatTime(appointment.start)}${professional ? ` · ${professional.name}` : ""}`,
        }
      })
  }, [appointments, professionals, record, patientId, currentVisitId])

  return { options, isLoading }
}
