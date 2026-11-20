import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FilterField } from "@/shared/components/filter-field"
export const ALL_INVENTORY = "__all_inventory__"
export function InventoryFilter({ label, value, onChange, allLabel, options }: { label: string; value: string; onChange: (value: string) => void; allLabel: string; options: { value: string; label: string }[] }) {
  return <FilterField label={label.replace(/^Filtrar.* por /, "").replace(/^./, first => first.toUpperCase())} className={"inventory-filter-field" + (label.includes("proveedor") ? " inventory-filter-supplier" : label.includes("tipo") ? " inventory-filter-small" : "")}><Select value={value} onValueChange={next => onChange(next ?? ALL_INVENTORY)} items={{ [ALL_INVENTORY]: allLabel, ...Object.fromEntries(options.map(option => [option.value, option.label])) }}>
    <SelectTrigger aria-label={label} className="inventory-filter"><SelectValue /></SelectTrigger><SelectContent className="inventory-select-options"><SelectItem value={ALL_INVENTORY}>{allLabel}</SelectItem>{options.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
  </Select></FilterField>
}
