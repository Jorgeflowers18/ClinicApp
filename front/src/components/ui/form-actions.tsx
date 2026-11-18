import type { ComponentProps } from "react"
import { cn } from "@/lib/utils"

/** Presentation only: the caller owns every button, callback and submission state. */
export function FormActions({ context = "page", className, ...props }: ComponentProps<"div"> & { context?: "page" | "dialog" | "sheet" }) {
  return <div data-form-actions="" data-context={context} className={cn("clinic-form-actions", className)} {...props} />
}
