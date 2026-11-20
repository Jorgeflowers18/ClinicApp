import { useQuery } from "@tanstack/react-query"
import { inventoryApi } from "@/modules/inventory/api/inventory.api"
import { inventoryKeys } from "@/modules/inventory/api/inventory.queries"
import type { PageQuery, Paginated } from "@/shared/types/common"
import { treatmentsApi } from "../api/treatments.api"
import { treatmentsKeys } from "../api/treatments.queries"

/** Existing paginated endpoints, collected completely before filtering or presenting options. */
async function allPages<T extends { id: string }>(list: (query: PageQuery) => Promise<Paginated<T>>) {
  const first = await list({ page: 1, pageSize: 100 })
  const items = [...first.items]
  for(let page = 2;page <= first.totalPages;page++) {
    items.push(...(await list({ page, pageSize: 100 })).items)
  }
  return [...new Map(items.map(item => [item.id, item])).values()]
}

export function useTreatmentCatalog() {
  return useQuery({
    queryKey: [...treatmentsKeys.lists(), "complete-catalog"],
    queryFn: () => allPages(treatmentsApi.list),
    staleTime: 30_000,
  })
}

export function useTreatmentInventory() {
  return useQuery({
    queryKey: [...inventoryKeys.lists(), "treatment-options"],
    queryFn: () => allPages(inventoryApi.list),
    staleTime: 30_000,
  })
}
