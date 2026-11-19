import { useState, type ReactNode } from "react"
import { Filter } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { ResetFiltersButton } from "./reset-filters-button"
import styles from "./responsive-filter-bar.module.css"

interface ResponsiveFilterBarProps {
  search?: ReactNode
  desktopFilters?: ReactNode
  panelTitle: string
  activeFilterCount: number
  onClear: () => void
  children: ReactNode
  wide?: boolean
  compact?: boolean
}

export function ResponsiveFilterBar({ search, desktopFilters, panelTitle, activeFilterCount, onClear, children, wide = false, compact = false }: ResponsiveFilterBarProps) {
  const [isOpen, setIsOpen] = useState(false)
  return <div className={styles.root} data-filter-toolbar data-wide={wide} data-compact={compact}>
    <div className={styles.line}>
      {search && <div className={styles.search}>{search}</div>}
      {desktopFilters && <div className={styles.desktop}>{desktopFilters}</div>}
      <Button type="button" variant="outline" className={styles.mobileTrigger}
        aria-label={activeFilterCount > 0 ? "Filtros, " + activeFilterCount + (activeFilterCount === 1 ? " filtro activo" : " filtros activos") : "Filtros"}
        aria-expanded={isOpen} aria-haspopup="dialog" onClick={() => setIsOpen(true)}>
        <Filter aria-hidden="true" /><span>Filtros</span>
        <Badge variant="secondary" aria-hidden={activeFilterCount === 0} className={activeFilterCount === 0 ? "invisible min-w-5 justify-center" : "min-w-5 justify-center"}>{activeFilterCount}</Badge>
      </Button>
      <ResetFiltersButton disabled={activeFilterCount === 0} onReset={onClear} />
    </div>
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetContent side="bottom" className={styles.panel} data-filter-panel>
        <SheetHeader><SheetTitle>{panelTitle}</SheetTitle></SheetHeader>
        <div className={styles.body}>{children}</div>
        <div className={styles.footer}><ResetFiltersButton disabled={activeFilterCount === 0} onReset={onClear} /><Button type="button" onClick={() => setIsOpen(false)}>Listo</Button></div>
      </SheetContent>
    </Sheet>
  </div>
}
