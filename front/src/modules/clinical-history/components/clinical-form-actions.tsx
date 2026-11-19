import type { ComponentProps, ReactNode } from "react"
import { cn } from "@/lib/utils"
import "./clinical-form-actions.css"

/** Document-flow actions for clinical pages. Modal footers keep their own layout. */
export function ClinicalFormActions({ leading, children, className, ...props }: ComponentProps<"div"> & { leading: ReactNode }) {
  return (
    <div className={cn("clinic-clinical-actions", className)} {...props}>
      <div className="clinic-clinical-actions-leading">{leading}</div>
      <div className="clinic-clinical-actions-buttons">{children}</div>
    </div>
  )
}
