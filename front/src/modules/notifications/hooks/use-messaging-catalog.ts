import { useQuery } from "@tanstack/react-query"
import { useAuthStore } from "@/modules/auth/store/auth-store"
import { patientsApi } from "@/modules/patients/api/patients.api"
import { patientsKeys } from "@/modules/patients/api/patients.queries"
import { notificationsApi } from "../api/notifications.api"
import { notificationsKeys } from "../api/notifications.queries"
import { env } from "@/shared/lib/env"
import { fetchAllPages } from "@/shared/lib/pagination"

/**
 * El historial completo, para los indicadores y los filtros de la página. Con la API, cada notificación trae
 * `patientName` y no se leen los pacientes (pendiente: paginar y filtrar en el servidor, con los indicadores).
 */
export function useMessagingCatalog() {
  const user = useAuthStore(state => state.user)
  const enabled = Boolean(user && ["admin", "recepcion"].includes(user.role))
  const options = { enabled, staleTime: 60_000, refetchInterval: 300_000 }
  const messages = useQuery({
    queryKey: [...notificationsKeys.lists(), "global-alerts", user?.id],
    queryFn: ({ signal }) => fetchAllPages(notificationsApi.list, signal), ...options,
  })
  const patients = useQuery({
    queryKey: [...patientsKeys.lists(), "global-alerts", user?.id],
    queryFn: ({ signal }) => fetchAllPages(patientsApi.list, signal), ...options,
    enabled: enabled && !env.usesApi("notifications"),
  })
  return { messages, patients }
}
