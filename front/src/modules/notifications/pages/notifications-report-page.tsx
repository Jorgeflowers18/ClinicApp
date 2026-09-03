import { useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { DataTable, type DataTableColumn } from "@/shared/components/data-table"
import { PageHeader } from "@/shared/components/page-header"
import { PaginationBar } from "@/shared/components/pagination-bar"
import { SearchInput } from "@/shared/components/search-input"
import { useTableQueryState } from "@/shared/hooks/use-table-query-state"
import { formatDateTime } from "@/shared/lib/date"
import { getErrorMessage } from "@/shared/lib/error-message"
import { usePatientsList } from "@/modules/patients/api/patients.queries"

import { NotificationTemplateEditor } from "../components/notification-template-editor"
import { useNotificationsList } from "../api/notifications.queries"
import {
  notificationChannelLabels,
  notificationStatusLabels,
  notificationTypeLabels,
  type NotificationLog,
} from "../types/notification.types"

export function NotificationsReportPage() {
  const { search, setSearch, debouncedSearch, page, setPage, pageSize } = useTableQueryState()
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")

  const { data, isLoading, isError, error } = useNotificationsList({
    page,
    pageSize,
    search: debouncedSearch,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  })
  const { data: patientsPage } = usePatientsList({ page: 1, pageSize: 100 })

  function patientOf(patientId: string) {
    return patientsPage?.items.find((item) => item.id === patientId)
  }

  const columns: DataTableColumn<NotificationLog>[] = [
    {
      key: "patient",
      header: "Paciente",
      cell: (row) => {
        const patient = patientOf(row.patientId)
        return (
          <div>
            <p className="font-medium text-foreground">
              {patient ? `${patient.firstName} ${patient.lastName}` : "Paciente"}
            </p>
            <p className="text-xs text-muted-foreground">{patient?.documentId ?? "—"}</p>
          </div>
        )
      },
    },
    { key: "type", header: "Tipo", cell: (row) => notificationTypeLabels[row.type] },
    { key: "channel", header: "Canal", cell: (row) => notificationChannelLabels[row.channel] },
    {
      key: "sentAt",
      header: "Fecha de envío",
      cell: (row) =>
        formatDateTime(row.sentAt, {
          year: "numeric",
          month: "short",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        }),
    },
    {
      key: "status",
      header: "Estado",
      cell: (row) => (
        <Badge variant={row.status === "enviada" ? "secondary" : "destructive"}>
          {notificationStatusLabels[row.status]}
        </Badge>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <PageHeader
        title="Notificaciones"
        description="Configura el mensaje predeterminado y consulta el historial de envíos a pacientes."
      />

      <NotificationTemplateEditor />

      <Separator />

      <div>
        <h2 className="text-lg font-semibold text-foreground">Historial de notificaciones</h2>
        <p className="text-sm text-muted-foreground">
          Notificaciones enviadas a los pacientes (recordatorios, confirmaciones y cancelaciones de citas).
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Buscar por nombre o identificación..."
        />

        <div className="flex items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor="dateFrom">Desde</Label>
            <Input
              id="dateFrom"
              type="date"
              value={dateFrom}
              onChange={(event) => {
                setDateFrom(event.target.value)
                setPage(1)
              }}
              className="w-auto"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="dateTo">Hasta</Label>
            <Input
              id="dateTo"
              type="date"
              value={dateTo}
              onChange={(event) => {
                setDateTo(event.target.value)
                setPage(1)
              }}
              className="w-auto"
            />
          </div>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        getRowId={(row) => row.id}
        isLoading={isLoading}
        isError={isError}
        errorMessage={getErrorMessage(error)}
        emptyTitle="Sin notificaciones"
        emptyDescription="No se encontraron notificaciones con estos criterios."
      />

      {data && (
        <PaginationBar
          page={data.page}
          pageSize={data.pageSize}
          totalItems={data.totalItems}
          totalPages={data.totalPages}
          onPageChange={setPage}
        />
      )}
    </div>
  )
}
