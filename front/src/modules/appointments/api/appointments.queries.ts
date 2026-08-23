import { useMutation, useQuery } from "@tanstack/react-query"

import { queryClient } from "@/shared/lib/query-client"

import { appointmentsApi } from "./appointments.api"
import type { Appointment, AppointmentFormValues } from "../types/appointment.types"

export const appointmentsKeys = {
  all: ["appointments"] as const,
  lists: () => [...appointmentsKeys.all, "list"] as const,
  detail: (id: string) => [...appointmentsKeys.all, "detail", id] as const,
  professionals: ["professionals"] as const,
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

export function useCreateAppointment() {
  return useMutation({
    mutationFn: (values: AppointmentFormValues) => appointmentsApi.create(values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: appointmentsKeys.lists() })
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: appointmentsKeys.lists() })
    },
  })
}
