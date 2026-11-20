import { Children, Fragment, isValidElement, type ReactNode } from "react"
import { SearchInput } from "@/shared/components/search-input"
import { ResponsiveFilterBar } from "@/shared/components/responsive-filter-bar"
import { ResetFiltersButton } from "@/shared/components/reset-filters-button"

export function InventoryToolbar({ search, onSearch, label, placeholder, filters, filterCount, onClear, action }: {
  search: string; onSearch: (value: string) => void; label: string; placeholder: string; filters?: ReactNode; filterCount: number; onClear: () => void; action?: ReactNode
}) {
  const input = <SearchInput value={search} onChange={onSearch} ariaLabel={label} placeholder={placeholder} />
  const countControls = (nodes: ReactNode): number => Children.toArray(nodes).reduce<number>((count, node) => count + (isValidElement<{ children?: ReactNode }>(node) && node.type === Fragment ? countControls(node.props.children) : 1), 0)
  const controls = countControls(filters)
  return <div className="inventory-toolbar">
    {filters ? <ResponsiveFilterBar wide={controls > 3} compact={controls === 1} search={input} desktopFilters={filters} panelTitle={label.replace("Buscar", "Filtros de")} activeFilterCount={filterCount} onClear={onClear}><div className="inventory-filter-mobile">{filters}</div></ResponsiveFilterBar>
      : <div className="inventory-search">{input}<ResetFiltersButton disabled={filterCount === 0} onReset={onClear} /></div>}
    {action && <div className="inventory-toolbar-actions">{action}</div>}
  </div>
}
