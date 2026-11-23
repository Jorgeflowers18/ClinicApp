import { useState } from "react"
import { useLocation, useSearchParams } from "react-router-dom"
import { CheckCheck, FileText, Filter, History, MailWarning, MessagesSquare, ChartNoAxesColumnIncreasing } from "lucide-react"
import { ResetFiltersButton } from "@/shared/components/reset-filters-button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AdaptiveTabs } from "@/components/ui/adaptive-tabs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { TabsContent } from "@/components/ui/tabs"
import { DataTable, type DataTableColumn } from "@/shared/components/data-table"
import { PageHeader } from "@/shared/components/page-header"
import { PaginationBar } from "@/shared/components/pagination-bar"
import { SearchInput } from "@/shared/components/search-input"
import { useTableQueryState } from "@/shared/hooks/use-table-query-state"
import { formatDateTime } from "@/shared/lib/date"
import { formatPercent } from "@/shared/lib/number"
import { getErrorMessage } from "@/shared/lib/error-message"
import { KpiCard } from "@/modules/reports/components/kpi-card"
import { getProfileInitials } from "@/modules/auth/components/profile-initials"
import type { NotificationLogQuery } from "../api/notifications.api"
import { useNotificationsList, useNotificationsSummary } from "../api/notifications.queries"
import { MessageChannel, MessageStatus } from "../components/message-status"
import { NotificationTemplateEditor } from "../components/notification-template-editor"
import { notificationChannelLabels, notificationTypeLabels, type NotificationChannel, type NotificationLog, type NotificationStatus, type NotificationType } from "../types/notification.types"
import "../messaging.css"

const statuses = { enviada: "Enviado", fallida: "Fallido" }
export function NotificationsReportPage() {
  const location = useLocation(), [params, setParams] = useSearchParams()
  const [selection, setSelection] = useState({ key: location.key, tab: "history" })
  const [templateVisited, setTemplateVisited] = useState(false)
  const activeTab = selection.key === location.key ? selection.tab : "history"
  const table = useTableQueryState()
  const [channel, setChannel] = useState("all"), [status, setStatus] = useState("all"), [type, setType] = useState("all")
  const [dateFrom, setDateFrom] = useState(""), [dateTo, setDateTo] = useState(""), [filterOpen, setFilterOpen] = useState(false)
  const selectedId = params.get("envio") ?? ""
  // El servidor filtra (nombre o cédula, canal, estado, tipo y días de la clínica) y pagina; el enlace de una
  // alerta (?envio=) trae solo esa notificación.
  const query: NotificationLogQuery = selectedId ? { page: 1, pageSize: table.pageSize, id: selectedId } : {
    page: table.page, pageSize: table.pageSize, search: table.debouncedSearch.trim() || undefined,
    channel: channel === "all" ? undefined : channel as NotificationChannel,
    status: status === "all" ? undefined : status as NotificationStatus,
    type: type === "all" ? undefined : type as NotificationType,
    dateFrom: dateFrom || undefined, dateTo: dateTo || undefined,
  }
  const messages = useNotificationsList(query), summary = useNotificationsSummary()
  const total = summary.data?.total ?? 0, sent = summary.data?.sent ?? 0, failed = summary.data?.failed ?? 0
  const activeFilters = selectedId ? ["Mensaje seleccionado"] : [table.search.trim() ? "Búsqueda: " + table.search.trim() : "", channel !== "all" ? "Canal: " + notificationChannelLabels[channel as keyof typeof notificationChannelLabels] : "", status !== "all" ? "Estado: " + statuses[status as keyof typeof statuses] : "", type !== "all" ? "Tipo: " + notificationTypeLabels[type as keyof typeof notificationTypeLabels] : "", dateFrom ? "Desde: " + dateFrom : "", dateTo ? "Hasta: " + dateTo : ""].filter(Boolean)
  function clearFilters() {
    table.setSearch(""); table.setPage(1); setChannel("all"); setStatus("all"); setType("all"); setDateFrom(""); setDateTo(""); setFilterOpen(false)
    if (selectedId) { const next = new URLSearchParams(params); next.delete("envio"); setParams(next, { replace: true }) }
  }
  function change(set: (value: string) => void) { return (value: string | null) => { set(value ?? "all"); table.setPage(1) } }
  const columns: DataTableColumn<NotificationLog>[] = [
    { key: "patient", header: "Paciente", cell: row => { const name = row.patientName || "Paciente no disponible", initials = getProfileInitials(row.patientName ?? "") || "?"; return <div className="messaging-patient"><Avatar aria-hidden="true"><AvatarFallback>{initials}</AvatarFallback></Avatar><div><p>{name}</p></div></div> } },
    { key: "type", header: "Tipo", cell: row => notificationTypeLabels[row.type] },
    { key: "channel", header: "Canal", cell: row => <MessageChannel channel={row.channel} /> },
    { key: "sentAt", header: "Fecha de envío", cell: row => <time dateTime={row.sentAt} title={formatDateTime(row.sentAt)}>{formatDateTime(row.sentAt, { year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" })}</time> },
    { key: "status", header: "Estado", cell: row => <MessageStatus status={row.status} /> },
  ]
  return <div className="messaging-module space-y-4">
    <PageHeader title="Mensajería" description="Gestiona los mensajes, recordatorios y comunicaciones con tus pacientes" />
    {summary.isError ? <Alert variant="destructive"><AlertDescription>No se pudieron consultar los indicadores de mensajes.</AlertDescription></Alert> : <div className="messaging-metrics">
      <KpiCard label="Mensajes registrados" value={total} icon={MessagesSquare} iconTone="neutral" isLoading={summary.isPending} />
      <KpiCard label="Mensajes enviados" value={sent} icon={CheckCheck} iconTone="success" isLoading={summary.isPending} />
      <KpiCard label="Mensajes fallidos" value={failed} icon={MailWarning} iconTone={failed > 0 ? "destructive" : "neutral"} isLoading={summary.isPending} />
      <KpiCard label="Tasa de envío exitoso" value={total ? formatPercent(sent / total) : "—"} icon={ChartNoAxesColumnIncreasing} isLoading={summary.isPending} />
    </div>}
    <p className="messaging-hint">Todos los registros disponibles. Enviado no significa entregado o leído.</p>
    <AdaptiveTabs value={activeTab} onValueChange={tab => { setSelection({key: location.key, tab}); if(tab === "template") setTemplateVisited(true) }} variant="line" items={[
      { value: "history", label: <><History aria-hidden="true" />Historial de envíos</>, accessibleLabel: "Historial de envíos" },
      { value: "template", label: <><FileText aria-hidden="true" />Plantillas de mensajes</>, accessibleLabel: "Plantillas de mensajes" },
    ]}>
      <TabsContent value="history" keepMounted className="pt-4 space-y-3">
        {!selectedId && <div className="messaging-toolbar"><SearchInput value={table.search} onChange={table.setSearch} ariaLabel="Buscar mensajes por paciente o identificación" placeholder="Buscar por nombre o identificación…" />
          <Popover open={filterOpen} onOpenChange={setFilterOpen}><PopoverTrigger render={<Button variant="outline" />}><Filter aria-hidden="true" />Filtros{activeFilters.length > 0 && <Badge variant="secondary">{activeFilters.length}</Badge>}</PopoverTrigger>
            <PopoverContent align="end" className="messaging-filter-popup"><PopoverTitle>Filtros de mensajes</PopoverTitle>
              <div className="messaging-filter-grid">{[
                {label:"Canal",value:channel,set:setChannel,options:notificationChannelLabels},
                {label:"Estado",value:status,set:setStatus,options:statuses},
                {label:"Tipo de mensaje",value:type,set:setType,options:notificationTypeLabels},
              ].map(field => <div key={field.label}><Label htmlFor={"message-filter-" + field.label}>{field.label}</Label><Select value={field.value} items={{all:"Todos",...field.options}} onValueChange={change(field.set)}><SelectTrigger id={"message-filter-" + field.label}><SelectValue /></SelectTrigger><SelectContent alignItemWithTrigger={false} align="start"><SelectItem value="all">Todos</SelectItem>{Object.entries(field.options).map(([value,label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>)}
                <div><Label htmlFor="message-date-from">Desde</Label><Input id="message-date-from" type="date" value={dateFrom} max={dateTo || undefined} onChange={event => { setDateFrom(event.target.value); table.setPage(1) }} /></div>
                <div><Label htmlFor="message-date-to">Hasta</Label><Input id="message-date-to" type="date" value={dateTo} min={dateFrom || undefined} onChange={event => { setDateTo(event.target.value); table.setPage(1) }} /></div>
              </div><Button variant="outline" className="justify-self-end" onClick={() => setFilterOpen(false)}>Listo</Button>
            </PopoverContent>
          </Popover>
          <ResetFiltersButton disabled={activeFilters.length === 0} onReset={clearFilters} />
        </div>}
        {activeFilters.length > 0 && <div className="messaging-active-filters" aria-label="Filtros activos">{activeFilters.map(label => <Badge variant="outline" key={label}>{label}</Badge>)}{selectedId && <ResetFiltersButton disabled={false} onReset={clearFilters} />}</div>}
        <DataTable className="messaging-history-table" columns={columns} data={messages.data?.items ?? []} getRowId={row => row.id} mobileTitleKey="patient"
          isLoading={messages.isPending} isError={messages.isError} errorMessage={getErrorMessage(messages.error)} emptyTitle={activeFilters.length ? "Sin mensajes coincidentes" : "Sin mensajes registrados"} emptyDescription={activeFilters.length ? "No hay mensajes con estos criterios." : "Todavía no hay envíos registrados a pacientes."} />
        {!messages.isError && messages.data && <PaginationBar page={messages.data.page} pageSize={messages.data.pageSize} totalItems={messages.data.totalItems} totalPages={messages.data.totalPages} onPageChange={table.setPage} />}
      </TabsContent>
      <TabsContent value="template" keepMounted className="pt-4">{templateVisited && <NotificationTemplateEditor />}</TabsContent>
    </AdaptiveTabs>
  </div>
}
