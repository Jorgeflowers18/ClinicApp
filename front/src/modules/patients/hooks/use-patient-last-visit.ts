import { format } from "date-fns"
import { useAppointmentsByPatient } from "@/modules/appointments/api/appointments.queries"
import { useClinicalHistory } from "@/modules/clinical-history/api/clinical-history.queries"
import { useAuthStore } from "@/modules/auth/store/auth-store"

/** Solo lectura: no transforma ni escribe el registro clínico ni el campo heredado lastVisitAt. */
export function usePatientLastVisit(patientId: string | undefined) {
  const clinical = useAuthStore(state => state.user?.role === "admin" || state.user?.role === "medico")
  const appointments = useAppointmentsByPatient(patientId)
  const history = useClinicalHistory(clinical ? patientId : undefined)
  const dates = [
    ...(appointments.data ?? []).filter(appointment => appointment.status === "completada").map(appointment => format(new Date(appointment.start), "yyyy-MM-dd")),
    ...(clinical ? history.data?.encounters ?? [] : []).map(encounter => encounter.date),
  ].sort()
  return { date: dates.at(-1) ?? null, isLoading: appointments.isLoading || clinical && history.isLoading, isError: appointments.isError || clinical && history.isError }
}
