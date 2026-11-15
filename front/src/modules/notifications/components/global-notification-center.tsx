import { useState } from "react"
import { useLocation, Link } from "react-router-dom"
import { Bell, CalendarDays, Cake, Check, CheckCheck, CircleAlert, MailWarning, Package, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverDescription, PopoverTitle, PopoverTrigger } from "@/components/ui/popover"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { Role } from "@/shared/types/common"
import { useAlertReads } from "./use-alert-reads"
import { useGlobalAlerts, type GlobalAlert } from "./use-global-alerts"
import styles from "./global-notification-center.module.css"

const icons = { inventory: Package, appointment: CalendarDays, birthday: Cake, delivery: MailWarning }
const kindLabels = { inventory: "Inventario", appointment: "Citas", birthday: "Cumpleaños", delivery: "Fallos de envío" }

export function GlobalNotificationCenter({ userId, role }: { userId: string; role: Role }) {
  const { pathname } = useLocation()
  const [panel, setPanel] = useState({ open: false, path: pathname })
  const [filter, setFilter] = useState<"unread" | "all" | "important">("unread")
  const [kind, setKind] = useState<"all" | GlobalAlert["kind"]>("all")
  const data = useGlobalAlerts(userId, role)
  const reads = useAlertReads(userId)
  const unread = data.alerts.filter((alert) => !reads.ids.has(alert.id))
  const unknown = data.error || reads.loadError
  const pending = data.loading && !data.error
  const important = unread.some((alert) => alert.important)
  const shown = data.alerts.filter((alert) => (kind === "all" || alert.kind === kind)
    && (filter !== "unread" || !reads.ids.has(alert.id)) && (filter !== "important" || alert.important))
  const label = pending ? "Alertas globales: consultando datos" : unknown ? "Alertas globales: consulta incompleta"
    : `Alertas globales: ${unread.length} sin leer${important ? ", hay alertas importantes" : ""}`

  return <Popover open={panel.open && panel.path === pathname} onOpenChange={(open) => setPanel({ open, path: pathname })}>
    <Tooltip>
      <TooltipTrigger render={<PopoverTrigger render={<Button variant="ghost" size="icon" className={styles.bell} aria-label={label} />} />}>
        <Bell aria-hidden="true" />
        {pending || unknown ? <span className={styles.count} aria-hidden="true">{unknown ? "!" : "…"}</span>
          : unread.length > 0 && <span className={styles.count} aria-hidden="true">{unread.length > 99 ? "99+" : unread.length}</span>}
        {!unknown && !pending && important && <span className={styles.importantDot} aria-hidden="true" />}
      </TooltipTrigger>
      <TooltipContent side="bottom">Alertas globales</TooltipContent>
    </Tooltip>
    <PopoverContent align="end" sideOffset={8} className={styles.panel}>
      <div className={styles.header}>
        <div><PopoverTitle>Alertas globales</PopoverTitle><PopoverDescription>Actividad y avisos de la clínica.</PopoverDescription></div>
        <Button variant="ghost" size="icon" aria-label="Actualizar alertas" disabled={data.refreshing} onClick={data.refresh}><RefreshCw className={data.refreshing ? styles.refreshing : undefined} /></Button>
      </div>
      <div className={styles.filters} aria-label="Filtrar alertas">
        {([ ["unread", "No leídas"], ["all", "Todas"], ["important", "Importantes"] ] as const).map(([value, name]) =>
          <Button key={value} variant="ghost" aria-pressed={filter === value} onClick={() => setFilter(value)}>{name}</Button>)}
      </div>
      <div className={styles.typeFilter}>
        <label htmlFor="global-alert-kind">Tipo de alerta</label>
        <select id="global-alert-kind" value={kind} onChange={(event) => setKind(event.target.value as typeof kind)}>
          <option value="all">Todos los tipos</option>
          {Object.entries(kindLabels).filter(([value]) => data.canManage || value === "appointment" || value === "birthday")
            .map(([value, name]) => <option value={value} key={value}>{name}</option>)}
        </select>
      </div>
      <div className={styles.body}>
        {data.error && <p role="alert" className={styles.error}>No se pudieron consultar todas las alertas. Actualiza para reintentar.</p>}
        {reads.error && <div role="alert" className={styles.error}>{reads.error}{reads.loadError && <Button variant="outline" onClick={reads.retry}>Reintentar lectura</Button>}</div>}
        {pending ? <p role="status" className={styles.empty}>Consultando alertas…</p>
          : shown.length ? <ul className={styles.list}>{shown.map((alert) => {
            const Icon = icons[alert.kind], read = reads.ids.has(alert.id)
            return <li key={alert.id} data-alert-kind={alert.kind} data-alert-read={read} className={styles.alert}>
              <Icon aria-hidden="true" className={alert.important ? styles.warningIcon : undefined} />
              <div className={styles.copy}>
                <Link to={alert.to} onClick={() => setPanel({ open: false, path: pathname })}>{alert.title}</Link>
                <p>{alert.detail}</p><span>{kindLabels[alert.kind]}{alert.important ? " · Importante" : ""}</span>
              </div>
              {read ? <Check aria-label="Leída" role="img" className={styles.readIcon} />
                : <Button variant="ghost" size="icon" aria-label={`Marcar como leída: ${alert.title}`} disabled={reads.loadError} onClick={() => reads.markRead([alert.id])}><Check /></Button>}
            </li>
          })}</ul> : !unknown && <div className={styles.empty}><CircleAlert aria-hidden="true" /><p>{filter === "unread" ? "No hay alertas sin leer" : "No hay alertas para este filtro"}</p></div>}
      </div>
      <div className={styles.footer}>
        <Button variant="ghost" onClick={() => reads.markRead(unread.map((alert) => alert.id))} disabled={pending || unknown || unread.length === 0}><CheckCheck />Marcar todas como leídas</Button>
        {data.canManage && <Link to="/notificaciones" onClick={() => setPanel({ open: false, path: pathname })}>Historial de envíos</Link>}
        <p>La lectura se guarda en este navegador.</p>
      </div>
    </PopoverContent>
  </Popover>
}
