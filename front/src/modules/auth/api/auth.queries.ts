import { useMutation } from "@tanstack/react-query"

import { queryClient } from "@/shared/lib/query-client"

import { authApi } from "./auth.api"
import { useAuthStore } from "../store/auth-store"
import { toast } from "sonner"
import { getErrorMessage } from "@/shared/lib/error-message"
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
      try {
        clearSession()
        queryClient.clear()
      } catch (error) {
        toast.error(getErrorMessage(error))
      }
    },
  })
}
