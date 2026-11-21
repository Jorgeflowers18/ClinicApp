import { useQuery } from "@tanstack/react-query"
import { useAuthStore } from "@/modules/auth/store/auth-store"
import { patientsApi } from "@/modules/patients/api/patients.api"
import { patientsKeys } from "@/modules/patients/api/patients.queries"
import { notificationsApi } from "../api/notifications.api"
import { notificationsKeys } from "../api/notifications.queries"
import { fetchAllPages } from "@/shared/lib/pagination"

/** Share the complete, per-user catalog already read by the header; never aggregate a single page. */
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
  })
  return { messages, patients }
}
