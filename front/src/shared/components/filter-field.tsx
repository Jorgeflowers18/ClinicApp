import { useId, type ReactNode } from "react"
import { cn } from "@/lib/utils"
import styles from "./filter-controls.module.css"

export function FilterField({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  const id = useId()
  return <div className={cn(styles.field, className)} data-filter-field role="group" aria-labelledby={id}>
    <span id={id} className={styles.label}>{label}</span>{children}
  </div>
}
