import { CheckCheck, CircleAlert, Mail, Smartphone } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { notificationChannelLabels, type NotificationChannel, type NotificationStatus } from "../types/notification.types"

export function MessageStatus({ status }: { status: NotificationStatus }) {
  const sent = status === "enviada", Icon = sent ? CheckCheck : CircleAlert
  return <span className="messaging-status" data-status={status}><Badge><Icon aria-hidden="true" />{sent ? "Enviado" : "Fallido"}</Badge>{!sent && <small>Motivo no disponible</small>}</span>
}
export function MessageChannel({ channel }: { channel: NotificationChannel }) {
  const Icon = channel === "sms" ? Smartphone : Mail
  return <span className="messaging-channel"><Icon aria-hidden="true" />{notificationChannelLabels[channel]}</span>
}
