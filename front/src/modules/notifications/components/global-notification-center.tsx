import { useEffect, useRef, useState } from "react"
import { useLocation, Link } from "react-router-dom"
import { Bell, BellCheck, CalendarClock, Cake, Check, CheckCheck, MailWarning, MessagesSquare, Package, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverDescription, PopoverTitle, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { Role } from "@/shared/types/common"
import { useAlertReads } from "./use-alert-reads"
import { useGlobalAlerts, type GlobalAlert } from "./use-global-alerts"
import styles from "./global-notification-center.module.css"

const icons = { inventory: Package, appointment: CalendarClock, birthday: Cake, delivery: MailWarning }
const kindLabels = { inventory: "Inventario", appointment: "Citas", birthday: "Cumpleaños", delivery: "Mensajería" }

export function GlobalNotificationCenter({ userId, role }: { userId: string; role: Role }) {
  const { pathname, search } = useLocation(), path = pathname + search
  const [panel, setPanel] = useState({ open: false, path })
  const [filter, setFilter] = useState<"unread" | "all" | "important">("unread")
  const [kind, setKind] = useState<"all" | GlobalAlert["kind"]>("all")
  const [leaving, setLeaving] = useState<string[]>([])
  const timers = useRef(new Set<number>())
  useEffect(() => () => { timers.current.forEach(timer => window.clearTimeout(timer)) }, [])
  const data = useGlobalAlerts(userId, role), reads = useAlertReads(userId)
  const unread = data.alerts.filter(alert => !reads.ids.has(alert.id))
  const unknown = data.error || reads.loadError, pending = data.loading && !data.error
  const important = unread.some(alert => alert.important)
  const shown = data.alerts.filter(alert => (kind === "all" || alert.kind === kind) && (filter !== "unread" || !reads.ids.has(alert.id) || leaving.includes(alert.id)) && (filter !== "important" || alert.important))
  const label = pending ? "Notificaciones: consultando datos" : unknown ? "Notificaciones: consulta incompleta"
    : `Notificaciones: ${unread.length} sin leer${important ? ", hay notificaciones importantes" : ""}`
  function markRead(ids: string[]) {
    reads.markRead(ids)
    setLeaving(current => [...new Set([...current, ...ids])])
    const timer = window.setTimeout(() => { setLeaving(current => current.filter(id => !ids.includes(id))); timers.current.delete(timer) }, window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 180)
    timers.current.add(timer)
  }
  const close = () => setPanel({open:false,path})
  return <Popover open={panel.open && panel.path === path} onOpenChange={open => setPanel({open,path})}>
    <Tooltip><TooltipTrigger render={<PopoverTrigger render={<Button variant="ghost" size="icon" className={styles.bell} aria-label={label} />} />}>
      <Bell aria-hidden="true" />
      {pending || unknown ? <span className={styles.count} data-notification-count="" aria-hidden="true">{unknown ? "!" : "…"}</span> : unread.length > 0 && <span className={styles.count} data-notification-count="" aria-hidden="true">{unread.length > 99 ? "99+" : unread.length}</span>}
    </TooltipTrigger><TooltipContent side="bottom">Notificaciones</TooltipContent></Tooltip>
    <PopoverContent align="end" sideOffset={8} className={styles.panel}>
      <div className={styles.header}>
        <div className={styles.heading}><div><PopoverTitle>Notificaciones</PopoverTitle><PopoverDescription>Actividad y avisos importantes de la clínica</PopoverDescription></div>
          <Tooltip><TooltipTrigger render={<Button variant="ghost" size="icon" aria-label="Actualizar notificaciones" disabled={data.refreshing} onClick={data.refresh} />}><RefreshCw aria-hidden="true" className={data.refreshing ? styles.refreshing : undefined} /></TooltipTrigger><TooltipContent>Actualizar notificaciones</TooltipContent></Tooltip>
        </div>
        <div className={styles.summary}><p aria-live="polite">{pending ? "Consultando…" : unknown ? "Consulta incompleta" : unread.length + " sin leer"}</p><Button variant="ghost" size="sm" onClick={() => markRead(unread.map(alert => alert.id))} disabled={pending || unknown || unread.length === 0}><CheckCheck aria-hidden="true" />Marcar todas como leídas</Button></div>
      </div>
      <div className={styles.filters} role="group" aria-label="Filtrar notificaciones">
        {([["unread","No leídas"],["all","Todas"],["important","Importantes"]] as const).map(([value,name]) => <Button key={value} variant="ghost" aria-pressed={filter === value} onClick={() => setFilter(value)}>{name}</Button>)}
      </div>
      <div className={styles.typeFilter}><Label className="sr-only" htmlFor="global-alert-kind">Tipo de notificación</Label>
        <Select value={kind} items={{all:"Todos los tipos",...kindLabels}} onValueChange={value => setKind((value ?? "all") as typeof kind)}>
          <SelectTrigger id="global-alert-kind"><SelectValue /></SelectTrigger><SelectContent alignItemWithTrigger={false} align="end"><SelectItem value="all">Todos los tipos</SelectItem>{Object.entries(kindLabels).filter(([value]) => data.canManage || value === "appointment" || value === "birthday").map(([value,name]) => <SelectItem value={value} key={value}>{name}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className={styles.body}>
        {data.error && <p role="alert" className={styles.error}>No se pudieron consultar todas las notificaciones. Actualiza para reintentar.</p>}
        {reads.error && <div role="alert" className={styles.error}>{reads.error}{reads.loadError && <Button variant="outline" onClick={reads.retry}>Reintentar lectura</Button>}</div>}
        {pending ? <p role="status" className={styles.empty}>Consultando notificaciones…</p> : shown.length ? <ul className={styles.list}>{shown.map(alert => {
          const Icon = icons[alert.kind], read = reads.ids.has(alert.id)
          return <li key={alert.id} data-alert-id={alert.id} data-alert-kind={alert.kind} data-alert-read={read} data-ending={filter === "unread" && read && leaving.includes(alert.id) || undefined} className={styles.alert}>
            <span className={styles.icon}><Icon aria-hidden="true" /></span>
            <Link className={styles.copy} to={alert.to} onClick={close}><strong>{alert.title}</strong><span>{alert.detail}</span>{alert.meta && <small>{alert.meta}</small>}</Link>
            <div className={styles.itemActions}>{!read && <span className={styles.unreadDot} aria-hidden="true" />}
              {read ? <Check aria-label="Leída" role="img" className={styles.readIcon} /> : <Tooltip><TooltipTrigger render={<Button variant="ghost" size="icon" aria-label={`Marcar como leída: ${alert.title}`} disabled={reads.loadError} onClick={() => markRead([alert.id])} />}><Check aria-hidden="true" /></TooltipTrigger><TooltipContent>Marcar como leída</TooltipContent></Tooltip>}
            </div>
          </li>
        })}</ul> : !unknown && <div className={styles.empty}><BellCheck aria-hidden="true" />{filter === "unread" && kind === "all" ? <><strong>Estás al día</strong><p>No tienes notificaciones sin leer</p></> : <p>No hay notificaciones de este tipo</p>}</div>}
      </div>
      <div className={styles.footer}>{data.canManage && <Link to="/notificaciones" onClick={close}><MessagesSquare aria-hidden="true" />Ir a Mensajería</Link>}<p>La lectura se guarda en este navegador.</p></div>
    </PopoverContent>
  </Popover>
}
