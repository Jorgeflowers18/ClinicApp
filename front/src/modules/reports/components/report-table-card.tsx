import type { ReactNode } from "react"
import { Download } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { ReportError } from "./report-error"

interface ReportTableCardProps {
  title: string
  description?: string
  isLoading?: boolean
  isError?: boolean
  isEmpty?: boolean
  emptyMessage?: string
  onExport?: () => void
  children: ReactNode
}

export function ReportTableCard({
  title,
  description,
  isLoading,
  isError,
  isEmpty,
  emptyMessage = "Sin datos en el periodo seleccionado.",
  onExport,
  children,
}: ReportTableCardProps) {
  return (
    <Card className="report-table-card">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
        {onExport && (
          <CardAction>
            <Button variant="outline" size="sm" onClick={onExport} disabled={isLoading || isEmpty || isError}>
              <Download />
              Exportar CSV
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        {isError ? <ReportError /> : isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : isEmpty ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{emptyMessage}</p>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  )
}
