import { useMutation, useQuery } from "@tanstack/react-query"

import { queryClient } from "@/shared/lib/query-client"
import { appointmentsKeys } from "@/modules/appointments/api/appointments.queries"

import { usersApi } from "./users.api"
import { useAuthStore } from "../store/auth-store"
import type { ManagedUser, UserFormValues } from "../types/user-admin.types"

export const usersKeys = {
  all: ["users"] as const,
}

export function useUsers(options: { enabled?: boolean } = {}) {
  return useQuery({ queryKey: usersKeys.all, queryFn: ({ signal }) => usersApi.list(signal), enabled: options.enabled })
}

// El vínculo con un profesional también se ve en el catálogo de profesionales (`userId`).
function refresh(user: ManagedUser) {
  queryClient.invalidateQueries({ queryKey: usersKeys.all })
  queryClient.invalidateQueries({ queryKey: appointmentsKeys.professionals })
  // Si el admin editó su propia cuenta, el encabezado muestra el nombre nuevo.
  useAuthStore.setState((state) => state.user?.id === user.id
    ? { user: { ...state.user, name: user.name, email: user.email, professionalId: user.professionalId } }
    : state)
}

export function useCreateUser() {
  return useMutation({
    mutationFn: (values: UserFormValues) => usersApi.create(values),
    onSuccess: ({ user }) => refresh(user),
  })
}

export function useUpdateUser() {
  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: UserFormValues }) => usersApi.update(id, values),
    onSuccess: refresh,
  })
}

export function useCreatePasswordLink() {
  return useMutation({ mutationFn: (id: string) => usersApi.createPasswordLink(id) })
}
