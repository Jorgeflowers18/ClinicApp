import type { Paginated, PageQuery } from "@/shared/types/common"

/** Simula la latencia de red para que los estados de carga sean visibles en desarrollo. */
export function mockDelay(ms = 400) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function paginate<T>(items: T[], query: PageQuery = {}): Paginated<T> {
  const page = query.page && query.page > 0 ? query.page : 1
  const pageSize = query.pageSize && query.pageSize > 0 ? query.pageSize : 10
  const start = (page - 1) * pageSize
  const pageItems = items.slice(start, start + pageSize)

  return {
    items: pageItems,
    page,
    pageSize,
    totalItems: items.length,
    totalPages: Math.max(1, Math.ceil(items.length / pageSize)),
  }
}

export function nextId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`
}
