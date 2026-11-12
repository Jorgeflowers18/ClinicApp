import { useId } from "react"
import { MoonStar } from "lucide-react"

import { Switch } from "@/components/ui/switch"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

import styles from "./sidebar-theme-switch.module.css"

export function SidebarThemeSwitch({ checked, collapsed, tooltipEnabled, onToggle, className }: {
  checked: boolean
  collapsed: boolean
  tooltipEnabled: boolean
  onToggle: () => void
  className: string
}) {
  const id = useId()
  const control = <Switch id={id} checked={checked} onCheckedChange={onToggle} aria-label="Modo oscuro" className={styles.control} />

  return (
    <div className={cn(className, styles.row)} data-collapsed={collapsed || undefined}>
      <label htmlFor={id} className={cn(styles.label, collapsed && "sr-only")}>
        <MoonStar aria-hidden="true" className="size-4 shrink-0" />
        <span className="truncate">Modo oscuro</span>
      </label>
      {tooltipEnabled ? (
        <Tooltip>
          <TooltipTrigger render={control} />
          <TooltipContent side="right">Modo oscuro</TooltipContent>
        </Tooltip>
      ) : control}
    </div>
  )
}
