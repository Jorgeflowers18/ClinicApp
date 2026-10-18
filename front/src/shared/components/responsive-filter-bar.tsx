import { useState, type ReactNode } from "react"
import { Filter, RotateCcw } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

interface ResponsiveFilterBarProps {
  search?: ReactNode
  desktopFilters?: ReactNode
  panelTitle: string
  activeFilterCount: number
  onClear: () => void
  children: ReactNode
}

export function ResponsiveFilterBar({
  search,
  desktopFilters,
  panelTitle,
  activeFilterCount,
  onClear,
  children,
}: ResponsiveFilterBarProps) {
  const [isOpen, setIsOpen] = useState(false)
  const filterTrigger = (className?: string) => (
    <Button
      type="button"
      variant="outline"
      className={cn("h-9 shrink-0 gap-1.5 px-2.5 @[17rem]:px-3", className)}
      aria-label={
        activeFilterCount > 0
          ? `Filtros, ${activeFilterCount} ${activeFilterCount === 1 ? "filtro activo" : "filtros activos"}`
          : "Filtros"
      }
      aria-expanded={isOpen}
      aria-haspopup="dialog"
      onClick={() => setIsOpen(true)}
    >
      <Filter aria-hidden="true" className="size-4" />
      <span className="hidden @[17rem]:inline">Filtros</span>
      {activeFilterCount > 0 && (
        <Badge variant="secondary" className="h-5 min-w-5 justify-center px-1 text-[11px]">
          {activeFilterCount}
        </Badge>
      )}
    </Button>
  )

  return (
    <div className="@container min-w-0">
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        {search && (
          <div className="flex min-w-0 flex-[1_1_15rem] items-center gap-2">
            <div className="min-w-0 flex-1 [&>div]:max-w-none">{search}</div>
            {filterTrigger("@lg:hidden")}
          </div>
        )}

        {desktopFilters && (
          <div className="hidden min-w-0 flex-[1_1_auto] flex-wrap items-center gap-2 @lg:flex">
            {desktopFilters}
            {activeFilterCount > 0 && (
              <Button type="button" variant="ghost" size="sm" onClick={onClear}>
                <RotateCcw aria-hidden="true" />
                Limpiar
              </Button>
            )}
          </div>
        )}

        {!search && (
          filterTrigger("@lg:hidden")
        )}
      </div>

      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{panelTitle}</SheetTitle>
          </SheetHeader>
          <div className="min-h-0 space-y-4 overflow-y-auto px-4">{children}</div>
          <SheetFooter className="flex-row">
            <Button type="button" variant="outline" className="flex-1" onClick={onClear}>
              Limpiar
            </Button>
            <Button type="button" className="flex-1" onClick={() => setIsOpen(false)}>
              Listo
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  )
}
