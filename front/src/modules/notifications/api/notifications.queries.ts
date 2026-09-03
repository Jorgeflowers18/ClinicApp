import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query"

import { queryClient } from "@/shared/lib/query-client"

import { notificationsApi, type NotificationLogQuery } from "./notifications.api"
import type { NotificationTemplateFormValues } from "../types/notification.types"

export const notificationsKeys = {
  all: ["notifications"] as const,
  lists: () => [...notificationsKeys.all, "list"] as const,
  list: (query: NotificationLogQuery) => [...notificationsKeys.lists(), query] as const,
  byAppointment: (appointmentId: string) => [...notificationsKeys.all, "appointment", appointmentId] as const,
  template: () => [...notificationsKeys.all, "template"] as const,
}

export function useNotificationsList(query: NotificationLogQuery) {
  return useQuery({
    queryKey: notificationsKeys.list(query),
    queryFn: () => notificationsApi.list(query),
    placeholderData: keepPreviousData,
  })
}

export function useAppointmentNotifications(appointmentId: string | undefined) {
  return useQuery({
    queryKey: notificationsKeys.byAppointment(appointmentId ?? ""),
    queryFn: () => notificationsApi.listByAppointment(appointmentId as string),
    enabled: Boolean(appointmentId),
  })
}

export function useNotificationTemplate() {
  return useQuery({
    queryKey: notificationsKeys.template(),
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
