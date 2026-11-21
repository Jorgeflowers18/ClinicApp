import { useQuery } from "@tanstack/react-query"
import { fetchAllPages } from "@/shared/lib/pagination"
import { inventoryApi } from "../api/inventory.api"
import { inventoryKeys } from "../api/inventory.queries"

/** Read the existing paginated endpoint completely before deriving filters or options. */
export function useInventoryCatalog() {
  return useQuery({
    queryKey: [...inventoryKeys.lists(), "complete-catalog"],
    queryFn: ({ signal }) => fetchAllPages(inventoryApi.list, signal),
    staleTime: 30_000,
  })
}
