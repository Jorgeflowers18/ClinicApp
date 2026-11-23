import { useQuery } from "@tanstack/react-query"
import { useAuthStore } from "@/modules/auth/store/auth-store"
import { notificationsApi } from "../api/notifications.api"
import { notificationsKeys } from "../api/notifications.queries"
import { fetchAllPages } from "@/shared/lib/pagination"

/**
 * El historial completo, para los indicadores y los filtros de la página. Cada notificación trae `patientName`,
 * así que no se leen los pacientes. Pendiente (plan 12): paginar y filtrar en el servidor, con los indicadores.
 */
export function useMessagingCatalog() {
  const user = useAuthStore(state => state.user)
  const enabled = Boolean(user && ["admin", "recepcion"].includes(user.role))
  const messages = useQuery({
    queryKey: [...notificationsKeys.lists(), "global-alerts", user?.id],
    queryFn: ({ signal }) => fetchAllPages(notificationsApi.list, signal),
    enabled, staleTime: 60_000, refetchInterval: 300_000,
  })
  return { messages }
}
