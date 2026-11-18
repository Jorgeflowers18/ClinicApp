import type { LucideIcon } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"

interface KpiCardProps {
  label: string
  value: string | number
  hint?: string
  icon?: LucideIcon
  isLoading?: boolean
  className?: string
  iconClassName?: string
  iconTone?: "neutral" | "info" | "success" | "warning" | "destructive"
  layout?: "default" | "split"
}

export function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  isLoading,
  className,
  iconClassName,
  iconTone = "info",
  layout = "default",
}: KpiCardProps) {
  const labelContent = <p className="clinic-kpi-label text-muted-foreground">{label}</p>
  const valueContent = isLoading ? (
    <Skeleton className="mt-1 h-8 w-16" />
  ) : (
    <p className="clinic-kpi-value" data-textual={typeof value === "string" && !/^[\d\s.,%$€+-]+$/.test(value) ? "true" : undefined}>{value}</p>
  )
  const hintContent = hint && !isLoading ? <p className="clinic-kpi-hint text-muted-foreground">{hint}</p> : null
  const iconContent = Icon ? (
    <div className={cn("clinic-summary-icon flex items-center justify-center rounded-lg", iconClassName)}>
      <Icon aria-hidden="true" className="size-5" />
    </div>
  ) : null

  return (
    <Card className={cn("clinic-kpi-card", className)} data-icon-tone={iconTone} data-layout={layout === "split" ? layout : undefined}>
      <CardContent className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 px-4 py-3.5">
        {layout === "split" ? (
          <>
            <div className="clinic-kpi-heading">{labelContent}{iconContent}</div>
            <div className="clinic-kpi-reading">{valueContent}{hintContent}</div>
          </>
        ) : (
          <>
            <div className="clinic-kpi-copy">{labelContent}{valueContent}{hintContent}</div>
            {iconContent}
          </>
        )}
      </CardContent>
    </Card>
  )
}
