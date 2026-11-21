import type { PageQuery, Paginated } from "@/shared/types/common"

/** Una función de listado paginado de cualquier recurso (`patientsApi.list`, `inventoryApi.list`…). */
export type PageFetcher<T> = (query: PageQuery, signal?: AbortSignal) => Promise<Paginated<T>>

/**
 * Lee **todas** las páginas de un listado (de a `pageSize`, máximo 100 en la API) y quita los repetidos por id,
 * conservando el orden. Se detiene si `signal` se cancela. Úsala solo para catálogos que deben estar completos
 * (selectores, filtros); para pantallas con muchos datos, pide la página que se muestra.
 */
export async function fetchAllPages<T extends { id: string }>(list: PageFetcher<T>, signal?: AbortSignal, pageSize = 100): Promise<T[]> {
  const items: T[] = []
  let totalPages = 1
  for (let page = 1; page <= totalPages; page++) {
    signal?.throwIfAborted()
    const result = await list({ page, pageSize }, signal)
    signal?.throwIfAborted()
    items.push(...result.items)
    totalPages = result.totalPages
  }
  return [...new Map(items.map((item) => [item.id, item])).values()]
}
