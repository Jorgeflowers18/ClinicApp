import type { LucideIcon } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

interface KpiCardProps {
  label: string
  value: string | number
  hint?: string
  icon?: LucideIcon
  isLoading?: boolean
}

export function KpiCard({ label, value, hint, icon: Icon, isLoading }: KpiCardProps) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-4">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          {isLoading ? (
            <Skeleton className="mt-1 h-8 w-16" />
          ) : (
            <p className="text-2xl font-semibold">{value}</p>
          )}
          {hint && !isLoading && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
        {Icon && (
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="size-5" />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
