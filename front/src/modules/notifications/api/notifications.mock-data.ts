import { addDays, setHours, setMinutes, startOfDay } from "date-fns"

import type { NotificationLog, NotificationTemplate } from "../types/notification.types"

export const mockNotificationTemplate: NotificationTemplate = {
  id: "tmpl_default",
  message:
    "Hola [nombre del cliente], te escribimos desde [nombre de la clínica] para recordarte tu cita del [fecha de la cita] a las [hora de la cita] con [profesional]. Si necesitas reprogramar, contáctanos con anticipación. ¡Te esperamos!",
  updatedAt: new Date().toISOString(),
}

function at(dayOffset: number, hour: number, minute = 0) {
  const day = startOfDay(addDays(new Date(), dayOffset))
  return setMinutes(setHours(day, hour), minute).toISOString()
}

export const mockNotifications: NotificationLog[] = [
  {
    id: "ntf_1",
    patientId: "pat_1",
    appointmentId: "apt_1",
    type: "recordatorio_cita",
    channel: "email",
    status: "enviada",
    sentAt: at(-1, 18, 0),
  },
  {
    id: "ntf_2",
    patientId: "pat_1",
    appointmentId: "apt_1",
    type: "confirmacion_cita",
    channel: "sms",
    status: "enviada",
    sentAt: at(0, 8, 0),
  },
  {
    id: "ntf_3",
    patientId: "pat_2",
    appointmentId: "apt_2",
    type: "recordatorio_cita",
    channel: "email",
    status: "enviada",
    sentAt: at(-1, 9, 0),
  },
  {
    id: "ntf_4",
    patientId: "pat_4",
    appointmentId: "apt_4",
    type: "recordatorio_cita",
    channel: "sms",
    status: "fallida",
    sentAt: at(1, 20, 0),
  },
  {
    id: "ntf_5",
    patientId: "pat_5",
    appointmentId: "apt_5",
    type: "recordatorio_cita",
    channel: "email",
    status: "enviada",
    sentAt: at(-2, 17, 0),
  },
  {
    id: "ntf_6",
    patientId: "pat_1",
    appointmentId: "apt_6",
    type: "cancelacion_cita",
    channel: "email",
    status: "enviada",
    sentAt: at(-2, 9, 45),
  },
  {
    id: "ntf_7",
    patientId: "pat_3",
    type: "recordatorio_cita",
    channel: "sms",
    status: "enviada",
    sentAt: at(-5, 12, 0),
  },
  {
    id: "ntf_8",
    patientId: "pat_2",
    type: "confirmacion_cita",
    channel: "email",
    status: "enviada",
    sentAt: at(-7, 15, 30),
  },
]
