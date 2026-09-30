import { Navigate, useLocation, useParams, useSearchParams } from "react-router-dom"

/**
 * Rutas de la primera versión del módulo, conservadas para enlaces y marcadores guardados.
 * `/historial-clinico/paciente/:patientId/odontologia` → historia del paciente (conserva `?visita=` y `?cita=`).
 */
export function LegacyDentalHistoryRedirect() {
  const { patientId } = useParams<{ patientId: string }>()
  const { search } = useLocation()
  return <Navigate to={`/historial-clinico/paciente/${patientId}${search}`} replace />
}

/** `/historial-clinico/nuevo?pacienteId=` → historia del paciente, donde se inicia la visita. */
export function LegacyNewEntryRedirect() {
  const [searchParams] = useSearchParams()
  const patientId = searchParams.get("pacienteId")
  return <Navigate to={patientId ? `/historial-clinico/paciente/${patientId}` : "/historial-clinico"} replace />
}

/** `/historial-clinico/:id` y `/historial-clinico/:id/editar` (registros clásicos) → lista de visitas. */
export function LegacyEntryRedirect() {
  return <Navigate to="/historial-clinico" replace />
}
