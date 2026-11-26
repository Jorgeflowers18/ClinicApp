import type { RefObject } from "react"
import { useModalAccordion } from "@/shared/hooks/use-modal-accordion"
const options = { item: (id: string) => `[data-treatment-section="${CSS.escape(id)}"]`, panel: ".treatment-section-panel", trigger: ".treatment-section-trigger" }
export function useTreatmentAccordion(form: RefObject<HTMLFormElement | null>) {
  return useModalAccordion(form, "general", options)
}
