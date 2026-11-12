import { useEffect } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { Button } from "@/components/ui/button"

interface PaginationBarProps {
  page: number
  pageSize: number
  totalItems: number
  totalPages: number
  onPageChange: (page: number) => void
}

export function PaginationBar({
  page,
  pageSize,
  totalItems,
  onPageChange,
}: PaginationBarProps) {
  const count = Math.max(0, totalItems)
  const size = Math.max(1, pageSize)
  const pages = Math.ceil(count / size)
  const currentPage = Math.max(1, Math.min(page, pages || 1))

  useEffect(() => {
    if (page !== currentPage) onPageChange(currentPage)
  }, [page, currentPage, onPageChange])

  if (count === 0) return null

  const start = (currentPage - 1) * size + 1
  const end = Math.min(currentPage * size, count)

  return (
    <div data-slot="pagination-bar" className="clinic-pagination flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center sm:gap-4">
      <p className="text-sm text-muted-foreground">
        Mostrando <span className="font-medium text-foreground">{start}-{end}</span> de{" "}
        <span className="font-medium text-foreground">{count}</span>
      </p>
      {pages > 1 && <nav aria-label="Paginación de registros" className="flex flex-wrap items-center gap-2">
        {currentPage > 1 && <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
        >
          <ChevronLeft />
          Anterior
        </Button>}
        <span className="text-sm text-muted-foreground">
          Página {currentPage} de {pages}
        </span>
        {currentPage < pages && <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage + 1)}
        >
          Siguiente
          <ChevronRight />
        </Button>}
      </nav>}
    </div>
  )
}
