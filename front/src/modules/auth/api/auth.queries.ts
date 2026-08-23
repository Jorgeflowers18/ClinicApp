import { useMutation } from "@tanstack/react-query"

import { queryClient } from "@/shared/lib/query-client"

import { authApi } from "./auth.api"
import { useAuthStore } from "../store/auth-store"
import type { LoginFormValues } from "../types/auth.types"

export function useLogin() {
  const setSession = useAuthStore((state) => state.setSession)

  return useMutation({
    mutationFn: (values: LoginFormValues) => authApi.login(values),
    onSuccess: (data) => {
      setSession(data.accessToken, data.user)
    },
  })
}

export function useLogout() {
  const clearSession = useAuthStore((state) => state.clearSession)

  return useMutation({
    mutationFn: () => authApi.logout(),
    onSettled: () => {
      clearSession()
      queryClient.clear()
    },
  })
}
