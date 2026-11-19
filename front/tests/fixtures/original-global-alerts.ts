// Original notification generator retained to verify stable alert identities and rules.
import { format, isSameDay, isValid, parseISO } from "date-fns"
import type { Appointment } from "@/modules/appointments/types/appointment.types"
import type { InventoryItem } from "@/modules/inventory/types/inventory.types"
import type { Patient } from "@/modules/patients/types/patient.types"
import type { NotificationLog } from "@/modules/notifications/types/notification.types"

export type GlobalAlert = {
  id: string; kind: "inventory" | "appointment" | "birthday" | "delivery"
  title: string; detail: string; to: string; important: boolean
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
