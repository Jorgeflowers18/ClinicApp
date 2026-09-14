import { toast } from "sonner"
import { Pencil } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { getErrorMessage } from "@/shared/lib/error-message"
import { formatDateTime, formatTime } from "@/shared/lib/date"
import { useAppointmentNotifications } from "@/modules/notifications/api/notifications.queries"

import { useUpdateAppointmentStatus } from "../api/appointments.queries"
import { appointmentStatusLabels, type Appointment, type AppointmentStatus } from "../types/appointment.types"

interface AppointmentDetailDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  appointment: Appointment | null
  patientName: string
  professionalName: string
  treatmentName?: string
  roomName?: string
  onEdit: () => void
}

const STATUS_VARIANT: Record<AppointmentStatus, "default" | "outline" | "destructive" | "secondary"> = {
  programada: "outline",
  confirmada: "default",
  completada: "secondary",
  cancelada: "destructive",
  no_asistio: "destructive",
}

export function AppointmentDetailDialog({
  open,
  onOpenChange,
  appointment,
  patientName,
  professionalName,
  treatmentName,
  roomName,
  onEdit,
}: AppointmentDetailDialogProps) {
  const updateStatus = useUpdateAppointmentStatus()
  const { data: notifications, isLoading: isLoadingNotifications } = useAppointmentNotifications(
    appointment?.id
  )

  if (!appointment) return null

  const sentNotifications = (notifications ?? []).filter((log) => log.status === "enviada")
  const wasNotified = sentNotifications.length > 0
  const lastNotifiedAt = wasNotified
    ? sentNotifications.reduce((latest, log) => (log.sentAt > latest ? log.sentAt : latest), sentNotifications[0].sentAt)
    : undefined

  function changeStatus(status: AppointmentStatus) {
    if (!appointment) return
    updateStatus.mutate(
      { id: appointment.id, status },
      {
        onSuccess: () => toast.success(`Cita marcada como ${appointmentStatusLabels[status].toLowerCase()}`),
        onError: (err) => toast.error(getErrorMessage(err)),
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {patientName}
            <Badge variant={STATUS_VARIANT[appointment.status]}>
              {appointmentStatusLabels[appointment.status]}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Profesional</span>
            <span className="font-medium">{professionalName}</span>
          </div>
          {treatmentName && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tratamiento</span>
              <span className="font-medium">{treatmentName}</span>
            </div>
          )}
          {roomName && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Consultorio</span>
              <span className="font-medium">{roomName}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Inicio</span>
            <span className="font-medium">
              {formatDateTime(appointment.start, {
                weekday: "short",
                day: "2-digit",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Fin</span>
            <span className="font-medium">{formatTime(appointment.end)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Cliente notificado</span>
            <div className="flex items-center gap-2">
              {!isLoadingNotifications && (
                <Badge variant={wasNotified ? "secondary" : "outline"}>
                  {wasNotified ? "Sí" : "No"}
                </Badge>
              )}
              {wasNotified && lastNotifiedAt && (
                <span className="text-xs text-muted-foreground">
                  {formatDateTime(lastNotifiedAt, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
            </div>
          </div>
          {appointment.notes && (
            <div className="border-t pt-2">
              <p className="text-muted-foreground">Notas</p>
              <p>{appointment.notes}</p>
            </div>
          )}
        </div>

        <DialogFooter className="flex-wrap gap-2 sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {appointment.status === "programada" && (
              <Button size="sm" variant="outline" onClick={() => changeStatus("confirmada")}>
                Confirmar
              </Button>
            )}
            {appointment.status !== "completada" &&
              appointment.status !== "cancelada" &&
              appointment.status !== "no_asistio" && (
                <Button size="sm" variant="outline" onClick={() => changeStatus("completada")}>
                  Completar
                </Button>
              )}
            {appointment.status !== "cancelada" &&
              appointment.status !== "completada" &&
              appointment.status !== "no_asistio" && (
                <>
                  <Button size="sm" variant="outline" onClick={() => changeStatus("no_asistio")}>
                    Marcar inasistencia
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => changeStatus("cancelada")}>
                    Cancelar cita
                  </Button>
                </>
              )}
          </div>
          <Button size="sm" onClick={onEdit}>
            <Pencil />
            Editar / reprogramar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
