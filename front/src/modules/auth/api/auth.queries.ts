import { useMutation } from "@tanstack/react-query"
import { toast } from "sonner"

import { getErrorMessage } from "@/shared/lib/error-message"

import { authApi } from "./auth.api"
import { useAuthStore } from "../store/auth-store"
import type { AccessRequestFormValues } from "../types/access-form.types"
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
    // Con la API borra la cookie de renovación. Si falla, la sesión local se cierra igual.
    mutationFn: () => authApi.logout(),
    onSettled: () => {
      try {
        clearSession()
      } catch (error) {
        toast.error(getErrorMessage(error))
      }
    },
  })
}

export function usePasswordRecovery() {
  return useMutation({ mutationFn: (email: string) => authApi.requestPasswordRecovery(email) })
}

export function usePasswordReset() {
  return useMutation({
    mutationFn: ({ token, password }: { token: string; password: string }) => authApi.resetPassword(token, password),
  })
}

export function useAccessRequest() {
  return useMutation({ mutationFn: (values: AccessRequestFormValues) => authApi.requestAccess(values) })
}
