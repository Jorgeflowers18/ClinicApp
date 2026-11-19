import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { downloadCsv } from "@/shared/lib/csv"
import { formatCurrency } from "@/shared/lib/number"

import { useTreatmentsReport } from "../api/reports.queries"
import { formatPeriodLabel } from "../lib/period"
import type { ReportPeriod } from "../types/report.types"
import { ReportTableCard } from "./report-table-card"

interface TreatmentsReportTabProps {
  period: ReportPeriod
}

export function TreatmentsReportTab({ period }: TreatmentsReportTabProps) {
  const { data, isLoading: initialLoading, isPlaceholderData, isError } = useTreatmentsReport(period)
  const isLoading = initialLoading || isPlaceholderData
  const rows = data?.byTreatment ?? []

  return (
    <ReportTableCard
      title="Tratamientos"
      description="*Ingreso estimado: costo registrado de las asignaciones completadas en el periodo; en registros anteriores se utiliza el precio del catálogo. Es una estimación, no una confirmación de cobro o facturación."
      isError={isError}
      isLoading={isLoading}
      isEmpty={rows.length === 0}
      onExport={() =>
        downloadCsv(`tratamientos_${formatPeriodLabel(period)}`, rows, [
          { key: "name", header: "Tratamiento" },
          { key: "price", header: "Precio" },
          { key: "appointmentsInPeriod", header: "Citas en el periodo" },
          { key: "activeAssignments", header: "Asignaciones activas" },
          { key: "completedAssignments", header: "Asignaciones completadas" },
          { key: "sessionsDone", header: "Sesiones realizadas" },
          { key: "sessionsPlanned", header: "Sesiones planificadas" },
          { key: "estimatedRevenue", header: "Ingreso estimado" },
        ])
      }
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tratamiento</TableHead>
            <TableHead className="text-right">Precio</TableHead>
            <TableHead className="text-right">Citas</TableHead>
            <TableHead className="text-right">Activas</TableHead>
            <TableHead className="text-right">Completadas</TableHead>
            <TableHead className="text-right">Sesiones</TableHead>
            <TableHead className="text-right">Ingreso estimado*</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.treatmentId}>
              <TableCell className="font-medium">{row.name}</TableCell>
              <TableCell className="text-right">{formatCurrency(row.price)}</TableCell>
              <TableCell className="text-right">{row.appointmentsInPeriod}</TableCell>
              <TableCell className="text-right">{row.activeAssignments}</TableCell>
              <TableCell className="text-right">{row.completedAssignments}</TableCell>
              <TableCell className="text-right text-muted-foreground">
                <span className="report-sessions"><span aria-label={`${row.sessionsDone} sesiones realizadas de ${row.sessionsPlanned} planificadas`}>{row.sessionsDone} / {row.sessionsPlanned}</span>
                {row.sessionsPlanned > 0 && row.sessionsDone >= 0 && row.sessionsDone <= row.sessionsPlanned && <span className="report-session-track" aria-hidden="true"><span style={{ width: `${row.sessionsDone / row.sessionsPlanned * 100}%` }} /></span>}</span>
              </TableCell>
              <TableCell className="text-right font-medium">{formatCurrency(row.estimatedRevenue)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ReportTableCard>
  )
}
