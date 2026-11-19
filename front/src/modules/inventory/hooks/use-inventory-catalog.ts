import { useQuery } from "@tanstack/react-query"
import { inventoryApi } from "../api/inventory.api"
import { inventoryKeys } from "../api/inventory.queries"

/** Read the existing paginated endpoint completely before deriving filters or options. */
export function useInventoryCatalog() {
  return useQuery({
    queryKey: [...inventoryKeys.lists(), "complete-catalog"],
    queryFn: async () => {
      const first = await inventoryApi.list({ page: 1, pageSize: 100 })
      const items = [...first.items]
      for(let page = 2; page <= first.totalPages; page++) items.push(...(await inventoryApi.list({ page, pageSize: 100 })).items)
      return [...new Map(items.map(item => [item.id, item])).values()]
    },
    staleTime: 30_000,
  })
}
