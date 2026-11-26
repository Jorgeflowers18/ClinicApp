import type { RefObject } from "react"
import { useModalAccordion } from "@/shared/hooks/use-modal-accordion"
const options = { item: (id: string) => `[data-inventory-section="${CSS.escape(id)}"]`, panel: ".inventory-section-panel", trigger: ".inventory-section-trigger" }
export function useInventoryAccordion(form: RefObject<HTMLFormElement | null>) {
  return useModalAccordion(form, "general", options)
}
