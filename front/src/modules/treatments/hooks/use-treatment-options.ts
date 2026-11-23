import { useQuery } from "@tanstack/react-query"
import { fetchAllPages } from "@/shared/lib/pagination"
import { treatmentsApi } from "../api/treatments.api"
import { treatmentsKeys } from "../api/treatments.queries"

/** Existing paginated endpoints, collected completely before filtering or presenting options. */
export function useTreatmentCatalog() {
  return useQuery({
    queryKey: [...treatmentsKeys.lists(), "complete-catalog"],
    // Sin `signal`: es un catálogo completo y compartido. Cancelarlo al desmontar (el doble montaje de
    // StrictMode en desarrollo) solo obliga a leer de nuevo todas sus páginas.
    queryFn: () => fetchAllPages(treatmentsApi.list),
    staleTime: 30_000,
  })
}
