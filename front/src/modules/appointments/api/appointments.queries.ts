import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query"

import { queryClient } from "@/shared/lib/query-client"
import { notificationsKeys } from "@/modules/notifications/api/notifications.queries"

import { appointmentsApi } from "./appointments.api"
import type { DateRange } from "./appointments.contract"
import type { Appointment, AppointmentFormValues, ScheduleBlockFormValues } from "../types/appointment.types"

export const appointmentsKeys = {
  all: ["appointments"] as const,
  lists: () => [...appointmentsKeys.all, "list"] as const,
  /** Las citas de un rango de días (lo que muestra el calendario). */
  range: (range: DateRange) => [...appointmentsKeys.lists(), "range", range] as const,
  /** Bajo `lists()`: se invalida junto con la agenda al crear, editar o cambiar el estado de una cita. */
  byPatient: (patientId: string) => [...appointmentsKeys.lists(), "patient", patientId] as const,
  detail: (id: string) => [...appointmentsKeys.all, "detail", id] as const,
  professionals: ["professionals"] as const,
  rooms: ["rooms"] as const,
  scheduleBlocks: ["schedule-blocks"] as const,
  scheduleBlocksRange: (range: DateRange) => [...appointmentsKeys.scheduleBlocks, range] as const,
}

/**
 * Citas que empiezan en `range` (días de la clínica). Sin rango pide **todas**: solo para la demostración y
 * los usos que el plan 8 reemplaza. `keepPreviousData` evita que el calendario parpadee al navegar.
 */
export function useAppointmentsList(range?: DateRange) {
  return useQuery({
    queryKey: range ? appointmentsKeys.range(range) : appointmentsKeys.lists(),
    queryFn: ({ signal }) => appointmentsApi.list(range, signal),
    placeholderData: keepPreviousData,
  })
}

/** Citas de un paciente (de la más reciente a la más antigua). */
export function useAppointmentsByPatient(patientId: string | undefined) {
  return useQuery({
    queryKey: appointmentsKeys.byPatient(patientId ?? ""),
    queryFn: ({ signal }) => appointmentsApi.listByPatient(patientId as string, signal),
    enabled: Boolean(patientId),
  })
}

/** Todos los profesionales, también los inactivos (para mostrar nombres). Los selectores usan `selectable`. */
export function useProfessionals() {
  return useQuery({
    queryKey: appointmentsKeys.professionals,
    queryFn: ({ signal }) => appointmentsApi.listProfessionals(signal),
    staleTime: 5 * 60_000,
  })
}

/** Todos los consultorios, también los inactivos. */
export function useRooms() {
  return useQuery({
    queryKey: appointmentsKeys.rooms,
    queryFn: ({ signal }) => appointmentsApi.listRooms(signal),
    staleTime: 5 * 60_000,
  })
}

export function useScheduleBlocksList(range?: DateRange) {
  return useQuery({
    queryKey: range ? appointmentsKeys.scheduleBlocksRange(range) : appointmentsKeys.scheduleBlocks,
    queryFn: ({ signal }) => appointmentsApi.listScheduleBlocks(range, signal),
    placeholderData: keepPreviousData,
  })
}

/**
 * Al crear o cancelar una cita, quien guarda registra su notificación (el servidor, en la misma transacción;
 * la demostración, en su mock). Aquí solo se refresca el historial de notificaciones.
 */
function refreshNotifications(appointment: Appointment) {
  queryClient.invalidateQueries({ queryKey: notificationsKeys.lists() })
  queryClient.invalidateQueries({ queryKey: notificationsKeys.byAppointment(appointment.id) })
}

export function useCreateAppointment() {
  return useMutation({
    mutationFn: (values: AppointmentFormValues) => appointmentsApi.create(values),
    onSuccess: (appointment) => {
      queryClient.invalidateQueries({ queryKey: appointmentsKeys.lists() })
      refreshNotifications(appointment)
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
    onSuccess: (appointment) => {
      queryClient.invalidateQueries({ queryKey: appointmentsKeys.lists() })
      if (appointment.status === "cancelada") refreshNotifications(appointment)
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
