import { RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import styles from "./filter-controls.module.css"

/** Presentation only; each module owns its defaults, search and pagination. */
export function ResetFiltersButton({ onReset, disabled, className }: { onReset: () => void; disabled: boolean; className?: string }) {
  return <Tooltip><TooltipTrigger render={<span className={styles.resetAnchor} tabIndex={disabled ? 0 : undefined} />}>
    <Button type="button" variant="outline" size="icon" aria-label="Restablecer filtros" data-reset-filters disabled={disabled} onClick={onReset} className={cn(styles.reset, className)}><RotateCcw aria-hidden="true" /></Button>
  </TooltipTrigger><TooltipContent>Restablecer filtros</TooltipContent></Tooltip>
}
