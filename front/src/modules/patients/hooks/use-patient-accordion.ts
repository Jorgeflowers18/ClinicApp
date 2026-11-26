import type { RefObject } from "react"
import { useModalAccordion } from "@/shared/hooks/use-modal-accordion"
const options = { item: (id: string) => `[id="${CSS.escape(id)}"]`, panel: ".patient-section-panel", trigger: "[data-patient-section-trigger]" }
export function usePatientAccordion(form: RefObject<HTMLFormElement | null>) {
  const controller = useModalAccordion(form, "patient-section-personal", options)
  return { openSectionId: controller.open, requestSection: controller.request, onValueChange: controller.onValueChange }
}
