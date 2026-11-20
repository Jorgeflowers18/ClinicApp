import { createContext, useContext, type AriaAttributes } from "react"

export interface FieldAccessibility {
  invalid: boolean
  errors: string[]
  descriptions: string[]
  register: (kind: "errors" | "descriptions", id: string, present: boolean) => void
}
export const FieldAccessibilityContext = createContext<FieldAccessibility | null>(null)

/** Keep explicit per-control validity; a group error must not mark a valid sibling. */
export function useFieldAccessibility(props: AriaAttributes) {
  const field = useContext(FieldAccessibilityContext)
  const invalid = props["aria-invalid"] ?? (field?.invalid || undefined)
  const describedBy = [...new Set([
    ...props["aria-describedby"]?.split(/\s+/).filter(Boolean) ?? [],
    ...field?.descriptions ?? [],
    ...(invalid && invalid !== "false" ? field?.errors ?? [] : []),
  ])].join(" ") || undefined
  return { "aria-invalid": invalid, "aria-describedby": describedBy }
}
