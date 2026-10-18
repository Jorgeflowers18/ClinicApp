import { useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { DataTable, type DataTableColumn } from "@/shared/components/data-table"
import { PageHeader } from "@/shared/components/page-header"
import { PaginationBar } from "@/shared/components/pagination-bar"
import { ResponsiveFilterBar } from "@/shared/components/responsive-filter-bar"
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

  function clearFilters() {
    setDateFrom("")
    setDateTo("")
    setPage(1)
  }

  const dateFilters = (prefix: string) => (
    <>
      <div className="space-y-1">
        <Label htmlFor={`${prefix}DateFrom`}>Desde</Label>
        <Input
          id={`${prefix}DateFrom`}
          type="date"
          value={dateFrom}
          onChange={(event) => {
            setDateFrom(event.target.value)
            setPage(1)
          }}
          className="w-full sm:w-auto"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${prefix}DateTo`}>Hasta</Label>
        <Input
          id={`${prefix}DateTo`}
          type="date"
          value={dateTo}
          onChange={(event) => {
            setDateTo(event.target.value)
            setPage(1)
          }}
          className="w-full sm:w-auto"
        />
      </div>
    </>
  )

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

      <ResponsiveFilterBar
        search={
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Buscar por nombre o identificación..."
          />
        }
        desktopFilters={<div className="flex flex-wrap items-end gap-3">{dateFilters("desktop")}</div>}
        panelTitle="Filtros de notificaciones"
        activeFilterCount={Number(Boolean(dateFrom)) + Number(Boolean(dateTo))}
        onClear={clearFilters}
      >
        <div className="grid gap-4 sm:grid-cols-2">{dateFilters("mobile")}</div>
      </ResponsiveFilterBar>

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
