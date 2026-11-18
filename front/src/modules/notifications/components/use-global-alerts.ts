import { useEffect, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { format, isSameDay, isValid, parseISO } from "date-fns"
import { appointmentsApi } from "@/modules/appointments/api/appointments.api"
import { appointmentsKeys } from "@/modules/appointments/api/appointments.queries"
import type { Appointment } from "@/modules/appointments/types/appointment.types"
import { inventoryApi } from "@/modules/inventory/api/inventory.api"
import { inventoryKeys } from "@/modules/inventory/api/inventory.queries"
import type { InventoryItem } from "@/modules/inventory/types/inventory.types"
import { patientsApi } from "@/modules/patients/api/patients.api"
import { patientsKeys } from "@/modules/patients/api/patients.queries"
import type { Patient } from "@/modules/patients/types/patient.types"
import type { PageQuery, Paginated, Role } from "@/shared/types/common"
import { notificationsApi } from "../api/notifications.api"
import { notificationsKeys } from "../api/notifications.queries"
import type { NotificationLog } from "../types/notification.types"

// Presentation data only: API models and delivery status remain untouched.
export type GlobalAlert = {
  id: string; kind: "inventory" | "appointment" | "birthday" | "delivery"
  title: string; detail: string; to: string; important: boolean
}

export async function collectAlertPages<T extends { id: string }>(fetchPage: (query: PageQuery) => Promise<Paginated<T>>, signal: AbortSignal): Promise<T[]> {
  const items: T[] = []
  let totalPages = 1
  for (let page = 1; page <= totalPages; page++) {
    signal.throwIfAborted()
    const result = await fetchPage({ page, pageSize: 100 })
    signal.throwIfAborted()
    items.push(...result.items)
    totalPages = result.totalPages
  }
  return [...new Map(items.map((item) => [item.id, item])).values()]
}

export function buildGlobalAlerts({ patients, appointments, inventory, deliveries, now }: {
  patients: Patient[]; appointments: Appointment[]; inventory: InventoryItem[]; deliveries: NotificationLog[]; now: Date
}): GlobalAlert[] {
  const day = format(now, "yyyy-MM-dd")
  const names = new Map(patients.map((patient) => [patient.id, `${patient.firstName} ${patient.lastName}`.trim()]))
  const alerts: GlobalAlert[] = []
  for (const item of inventory) if (item.stock <= item.minStock) alerts.push({
    id: `inventory:${item.id}:${day}:${item.stock}:${item.minStock}`, kind: "inventory", important: true,
    title: `${item.stock === 0 ? "Sin existencias" : "Stock bajo"}: ${item.name}`,
    detail: `${item.stock} ${item.unit} disponibles · Mínimo ${item.minStock}`,
    to: `/inventario/${encodeURIComponent(item.id)}`,
  })
  for (const log of deliveries) if (log.status === "fallida") alerts.push({
    id: `delivery:${log.id}:${log.sentAt}`, kind: "delivery", important: true,
    title: "Envío de notificación fallido",
    detail: `${names.get(log.patientId) || "Paciente no disponible"} · ${log.channel === "sms" ? "SMS" : "Correo"}`,
    to: "/notificaciones",
  })
  for (const appointment of [...appointments].sort((a, b) => a.start.localeCompare(b.start))) {
    const start = parseISO(appointment.start)
    if (!isValid(start) || !isSameDay(start, now) || !["programada", "confirmada"].includes(appointment.status)) continue
    alerts.push({
      id: `appointment:${appointment.id}:${appointment.start}:${appointment.status}`, kind: "appointment", important: false,
      title: `Cita de hoy · ${format(start, "HH:mm")}`,
      detail: `${names.get(appointment.patientId) || "Paciente no disponible"} · ${appointment.status === "confirmada" ? "Confirmada" : "Programada"}`,
      to: "/citas",
    })
  }
  for (const patient of patients) {
    const birth = parseISO(patient.birthDate)
    if (isValid(birth) && format(birth, "MM-dd") === format(now, "MM-dd")) alerts.push({
      id: `birthday:${patient.id}:${day}`, kind: "birthday", important: false,
      title: `Cumpleaños de ${names.get(patient.id)}`, detail: "Cumple años hoy",
      to: `/pacientes/${encodeURIComponent(patient.id)}`,
    })
  }
  return alerts
}

export function useGlobalAlerts(userId: string, role: Role) {
  const canManage = role === "admin" || role === "recepcion"
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const update = () => setNow(new Date())
    const timer = window.setInterval(update, 60_000)
    document.addEventListener("visibilitychange", update)
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", update) }
  }, [])
  const options = { staleTime: 60_000, refetchInterval: 300_000 }
  const patients = useQuery({
    queryKey: [...patientsKeys.lists(), "global-alerts", userId],
    queryFn: ({ signal }) => collectAlertPages(patientsApi.list, signal), ...options,
  })
  const appointments = useQuery({ queryKey: appointmentsKeys.lists(), queryFn: appointmentsApi.list, ...options })
  const inventory = useQuery({
    queryKey: [...inventoryKeys.lists(), "global-alerts", userId], enabled: canManage,
    queryFn: ({ signal }) => collectAlertPages(inventoryApi.list, signal), ...options,
  })
  const deliveries = useQuery({
    queryKey: [...notificationsKeys.lists(), "global-alerts", userId], enabled: canManage,
    queryFn: ({ signal }) => collectAlertPages(notificationsApi.list, signal), ...options,
  })
  const alerts = useMemo(() => buildGlobalAlerts({ patients: patients.data ?? [], appointments: appointments.data ?? [],
    inventory: canManage ? inventory.data ?? [] : [], deliveries: canManage ? deliveries.data ?? [] : [], now,
  }), [patients.data, appointments.data, inventory.data, deliveries.data, canManage, now])
  const sources = canManage ? [patients, appointments, inventory, deliveries] : [patients, appointments]
  return {
    alerts, canManage, loading: sources.some((source) => source.isPending), error: sources.some((source) => source.isError),
    refreshing: sources.some((source) => source.isFetching),
    refresh: () => { for (const source of sources) void source.refetch() },
  }
}
