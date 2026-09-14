import { useMutation, useQuery } from "@tanstack/react-query"

import { queryClient } from "@/shared/lib/query-client"
import { notificationsApi } from "@/modules/notifications/api/notifications.api"
import { notificationsKeys } from "@/modules/notifications/api/notifications.queries"

import { appointmentsApi } from "./appointments.api"
import type { Appointment, AppointmentFormValues, ScheduleBlockFormValues } from "../types/appointment.types"

export const appointmentsKeys = {
  all: ["appointments"] as const,
  lists: () => [...appointmentsKeys.all, "list"] as const,
  detail: (id: string) => [...appointmentsKeys.all, "detail", id] as const,
  professionals: ["professionals"] as const,
  rooms: ["rooms"] as const,
  scheduleBlocks: ["schedule-blocks"] as const,
}

export function useAppointmentsList() {
  return useQuery({
    queryKey: appointmentsKeys.lists(),
    queryFn: () => appointmentsApi.list(),
  })
}

export function useProfessionals() {
  return useQuery({
    queryKey: appointmentsKeys.professionals,
    queryFn: () => appointmentsApi.listProfessionals(),
    staleTime: 5 * 60_000,
  })
}

export function useRooms() {
  return useQuery({
    queryKey: appointmentsKeys.rooms,
    queryFn: () => appointmentsApi.listRooms(),
    staleTime: 5 * 60_000,
  })
}

export function useScheduleBlocksList() {
  return useQuery({
    queryKey: appointmentsKeys.scheduleBlocks,
    queryFn: () => appointmentsApi.listScheduleBlocks(),
  })
}

async function notifyAppointmentEvent(appointment: Appointment, type: "confirmacion_cita" | "cancelacion_cita") {
  await notificationsApi.logAppointmentEvent({
    patientId: appointment.patientId,
    appointmentId: appointment.id,
    type,
  })
  queryClient.invalidateQueries({ queryKey: notificationsKeys.lists() })
  queryClient.invalidateQueries({ queryKey: notificationsKeys.byAppointment(appointment.id) })
}

export function useCreateAppointment() {
  return useMutation({
    mutationFn: (values: AppointmentFormValues) => appointmentsApi.create(values),
    onSuccess: async (appointment) => {
      queryClient.invalidateQueries({ queryKey: appointmentsKeys.lists() })
      await notifyAppointmentEvent(appointment, "confirmacion_cita")
    },
  })
}

export function useUpdateAppointment(id: string) {
  return useMutation({
    mutationFn: (values: AppointmentFormValues) => appointmentsApi.update(id, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: appointmentsKeys.lists() })
    },
  })
}

export function useUpdateAppointmentStatus() {
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: Appointment["status"] }) =>
      appointmentsApi.updateStatus(id, status),
    onSuccess: async (appointment) => {
      queryClient.invalidateQueries({ queryKey: appointmentsKeys.lists() })
      if (appointment.status === "cancelada") {
        await notifyAppointmentEvent(appointment, "cancelacion_cita")
      }
    },
  })
}

export function useCreateScheduleBlock() {
  return useMutation({
    mutationFn: (values: ScheduleBlockFormValues) => appointmentsApi.createScheduleBlock(values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: appointmentsKeys.scheduleBlocks })
    },
  })
}

export function useDeleteScheduleBlock() {
  return useMutation({
    mutationFn: (id: string) => appointmentsApi.removeScheduleBlock(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: appointmentsKeys.scheduleBlocks })
    },
  })
}
