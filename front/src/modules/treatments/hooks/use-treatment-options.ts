import { useQuery } from "@tanstack/react-query"
import { inventoryApi } from "@/modules/inventory/api/inventory.api"
import { inventoryKeys } from "@/modules/inventory/api/inventory.queries"
import { fetchAllPages } from "@/shared/lib/pagination"
import { treatmentsApi } from "../api/treatments.api"
import { treatmentsKeys } from "../api/treatments.queries"

/** Existing paginated endpoints, collected completely before filtering or presenting options. */
export function useTreatmentCatalog() {
  return useQuery({
    queryKey: [...treatmentsKeys.lists(), "complete-catalog"],
    queryFn: ({ signal }) => fetchAllPages(treatmentsApi.list, signal),
    staleTime: 30_000,
  })
}

export function useTreatmentInventory() {
  return useQuery({
    queryKey: [...inventoryKeys.lists(), "treatment-options"],
    queryFn: ({ signal }) => fetchAllPages(inventoryApi.list, signal),
    staleTime: 30_000,
  })
}
