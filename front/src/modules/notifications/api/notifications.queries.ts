import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query"

import { queryClient } from "@/shared/lib/query-client"

import { notificationsApi } from "./notifications.api"
import type { NotificationLogQuery } from "./notifications.contract"
import type { NotificationTemplateFormValues } from "../types/notification.types"

export const notificationsKeys = {
  all: ["notifications"] as const,
  lists: () => [...notificationsKeys.all, "list"] as const,
  list: (query: NotificationLogQuery) => [...notificationsKeys.lists(), query] as const,
  summary: () => [...notificationsKeys.all, "summary"] as const,
  byAppointment: (appointmentId: string) => [...notificationsKeys.all, "appointment", appointmentId] as const,
  template: () => [...notificationsKeys.all, "template"] as const,
}

export function useNotificationsList(query: NotificationLogQuery) {
  return useQuery({
    queryKey: notificationsKeys.list(query),
    queryFn: ({ signal }) => notificationsApi.list(query, signal),
    placeholderData: keepPreviousData,
  })
}

export function useNotificationsSummary() {
  return useQuery({
    queryKey: notificationsKeys.summary(),
    queryFn: ({ signal }) => notificationsApi.getSummary(signal),
  })
}

export function useAppointmentNotifications(appointmentId: string | undefined) {
  return useQuery({
    queryKey: notificationsKeys.byAppointment(appointmentId ?? ""),
    queryFn: ({ signal }) => notificationsApi.listByAppointment(appointmentId as string, signal),
    enabled: Boolean(appointmentId),
  })
}

export function useNotificationTemplate() {
  return useQuery({
    queryKey: notificationsKeys.template(),
    // Sin `signal`: es una sola lectura chica; cancelarla en el doble montaje de StrictMode solo la repite.
    queryFn: () => notificationsApi.getTemplate(),
  })
}

export function useUpdateNotificationTemplate() {
  return useMutation({
    mutationFn: (values: NotificationTemplateFormValues) => notificationsApi.updateTemplate(values),
    onSuccess: (template) => {
      queryClient.setQueryData(notificationsKeys.template(), template)
    },
  })
}
