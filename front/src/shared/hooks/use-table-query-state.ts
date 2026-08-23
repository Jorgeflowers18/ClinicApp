import { useState } from "react"

import { useDebounce } from "@/shared/hooks/use-debounce"

/** Estado combinado de búsqueda + paginación para listados con tabla. */
export function useTableQueryState(initialPageSize = 10) {
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [pageSize] = useState(initialPageSize)
  const debouncedSearch = useDebounce(search, 300)

  function updateSearch(value: string) {
    setSearch(value)
    setPage(1)
  }

  return {
    search,
    setSearch: updateSearch,
    debouncedSearch,
    page,
    setPage,
    pageSize,
  }
}
