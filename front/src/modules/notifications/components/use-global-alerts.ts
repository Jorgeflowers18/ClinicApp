import { useEffect, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { format, isValid, parseISO } from "date-fns"
import type { Role } from "@/shared/types/common"
import { inventoryUnit } from "@/modules/inventory/lib/inventory-display"
import { notificationsApi } from "../api/notifications.api"
import type { AlertsSnapshot } from "../api/notifications.contract"
import { notificationsKeys } from "../api/notifications.queries"
import { notificationTypeLabels } from "../types/notification.types"

// Presentation data only: API models and delivery status remain untouched.
export type GlobalAlert = {
  id: string; kind: "inventory" | "appointment" | "birthday" | "delivery"
  title: string; detail: string; meta?: string; to: string; important: boolean
}


/**
 * Las alertas del centro de notificaciones desde `GET /alerts`. Los ids no cambian entre consultas (así se
 * conservan las ya leídas en `use-alert-reads.ts`). El servidor ya
 * filtra: citas programadas o confirmadas de hoy, cumpleaños de hoy, stock crítico y envíos fallidos (7 días).
 */
export function alertsFromSnapshot(snapshot: AlertsSnapshot, now: Date): GlobalAlert[] {
  const day = format(now, "yyyy-MM-dd")
  const alerts: GlobalAlert[] = []
  for (const item of snapshot.criticalItems) alerts.push({
    id: `inventory:${item.itemId}:${day}:${item.stock}:${item.minStock}`, kind: "inventory", important: true,
    title: item.stock === 0 ? "Sin existencias de insumos" : "Stock bajo de insumos",
    detail: item.name,
    meta: `${item.stock} ${inventoryUnit(item.unit, item.stock)} disponibles · Mínimo: ${item.minStock} ${inventoryUnit(item.unit, item.minStock)}`,
    to: `/inventario/${encodeURIComponent(item.itemId)}`,
  })
  for (const log of snapshot.failedDeliveries) alerts.push({
    id: `delivery:${log.id}:${log.sentAt ?? ""}`, kind: "delivery", important: true,
    title: "Mensaje no enviado",
    detail: `${log.patientName || "Paciente no disponible"} · ${log.channel === "sms" ? "SMS" : "Correo"}`,
    meta: notificationTypeLabels[log.type as keyof typeof notificationTypeLabels],
    to: `/notificaciones?envio=${encodeURIComponent(log.id)}`,
  })
  for (const appointment of [...snapshot.appointmentsToday].sort((a, b) => a.start.localeCompare(b.start))) {
    const start = parseISO(appointment.start)
    if (!isValid(start)) continue
    alerts.push({
      id: `appointment:${appointment.id}:${appointment.start}:${appointment.status}`, kind: "appointment", important: false,
      title: `${start.getTime() > now.getTime() ? "Próxima cita" : "Cita de hoy"} · ${format(start, "HH:mm")}`,
      detail: appointment.patientName || "Paciente no disponible",
      meta: `${appointment.status === "confirmada" ? "Confirmada" : "Programada"}${start.getTime() > now.getTime() ? ` · En ${Math.ceil((start.getTime() - now.getTime()) / 60000)} min` : ""}`,
      to: "/citas",
    })
  }
  for (const birthday of snapshot.birthdaysToday) alerts.push({
    id: `birthday:${birthday.patientId}:${day}`, kind: "birthday", important: false,
    title: "Cumpleaños de paciente", detail: birthday.patientName || "Paciente no disponible", meta: "Cumple años hoy",
    to: `/pacientes/${encodeURIComponent(birthday.patientId)}`,
  })
  return alerts
}

function useNow() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const update = () => setNow(new Date())
    const timer = window.setInterval(update, 60_000)
    document.addEventListener("visibilitychange", update)
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", update) }
  }, [])
  return now
}

/** Una sola petición cada 5 minutos (`GET /alerts`). El médico recibe vacíos el inventario y los envíos fallidos. */
export function useGlobalAlerts(userId: string, role: Role) {
  const canManage = role === "admin" || role === "recepcion"
  const now = useNow()
  const snapshot = useQuery({
    queryKey: [...notificationsKeys.all, "alerts", userId],
    queryFn: ({ signal }) => notificationsApi.getAlerts(signal),
    staleTime: 60_000, refetchInterval: 300_000,
  })
  const alerts = useMemo(() => snapshot.data ? alertsFromSnapshot(snapshot.data, now) : [], [snapshot.data, now])
  return {
    alerts, canManage, loading: snapshot.isPending, error: snapshot.isError, refreshing: snapshot.isFetching,
    refresh: () => { void snapshot.refetch() },
  }
}
