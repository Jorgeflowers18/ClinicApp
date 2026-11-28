export interface SelectableSection {
  value: string
  disabled?: boolean
  permitted?: boolean
}

/** Permissions are supplied by the module's existing policy, never inferred here. */
export function resolveSectionValue(items: readonly SelectableSection[], requested?: string | null, defaultValue?: string) {
  const available = items.filter(item => item.permitted !== false && !item.disabled)
  return available.find(item => item.value === requested)?.value
    ?? available.find(item => item.value === defaultValue)?.value
    ?? available[0]?.value
    ?? ""
}
