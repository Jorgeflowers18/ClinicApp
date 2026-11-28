import { useSearchParams } from "react-router-dom"
import { resolveSectionValue, type SelectableSection } from "@/shared/lib/section-selection"

/** In-page selection with shareable URLs; preserves other filters and history. */
export function useSectionQueryState(items: readonly SelectableSection[], defaultValue: string, parameter = "seccion") {
  const [params, setParams] = useSearchParams()
  const selected = resolveSectionValue(items, params.get(parameter), defaultValue)
  function select(value: string) {
    if (value === selected || !items.some(item => item.value === value && item.permitted !== false && !item.disabled)) return
    setParams(current => {
      const next = new URLSearchParams(current)
      next.set(parameter, value)
      return next
    }, { replace: true, preventScrollReset: true })
  }
  return [selected, select] as const
}
