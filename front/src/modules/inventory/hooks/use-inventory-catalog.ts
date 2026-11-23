import { useQuery } from "@tanstack/react-query"
import { fetchAllPages } from "@/shared/lib/pagination"
import { inventoryApi } from "../api/inventory.api"
import { inventoryKeys } from "../api/inventory.queries"

/** Read the existing paginated endpoint completely before deriving filters or options. */
export function useInventoryCatalog() {
  return useQuery({
    queryKey: [...inventoryKeys.lists(), "complete-catalog"],
    // Sin `signal`: es un catálogo completo y compartido. Cancelarlo al desmontar (el doble montaje de
    // StrictMode en desarrollo) solo obliga a leer de nuevo todas sus páginas.
    queryFn: () => fetchAllPages(inventoryApi.list),
    staleTime: 30_000,
  })
}
