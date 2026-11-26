import { useMutation } from "@tanstack/react-query"
import { toast } from "sonner"

import { getErrorMessage } from "@/shared/lib/error-message"

import { authApi } from "./auth.api"
import { useAuthStore } from "../store/auth-store"
import type { AccessRequestFormValues } from "../types/access-form.types"
import type { LoginFormValues } from "../types/auth.types"
import { ApiError } from "@/shared/types/common"
import { identityService } from "@/modules/saas/services"
import { useDemoContext } from "@/modules/saas/state"

export function useLogin(demo = false) {
  const setSession = useAuthStore((state) => state.setSession)

  return useMutation({
    mutationFn: async (values: LoginFormValues) => {
      if(demo){if(values.password!=="Demo12345!")throw new ApiError("En la demostración utiliza la clave pública Demo12345!.",401);const user=identityService.demoLogin(values.email);useDemoContext.getState().enter(user.id);return null}
      const email=identityService.emailForAlias(values.email)
      if(!email)throw new ApiError("No se pudo iniciar sesión con este identificador. También puedes utilizar tu correo.",401)
      return authApi.login({...values,email})
    },
    onSuccess: (data) => {
      if(data)setSession(data.accessToken, data.user)
    },
  })
}

export function useLogout() {
  const clearSession = useAuthStore((state) => state.clearSession)

  return useMutation({
    // Con la API borra la cookie de renovación. Si falla, la sesión local se cierra igual.
    mutationFn: async () => {if(useDemoContext.getState().userId){useDemoContext.getState().exit();return}await authApi.logout()},
    onSettled: () => {
      try {
        clearSession()
      } catch (error) {
        toast.error(getErrorMessage(error))
      }
    },
  })
}

export function usePasswordRecovery(demo = false) {
  return useMutation({ mutationFn: async (identifier: string) => {if(demo)return;const email=identityService.emailForAlias(identifier);if(email)await authApi.requestPasswordRecovery(email)} })
}

export function usePasswordReset() {
  return useMutation({
    mutationFn: ({ token, password }: { token: string; password: string }) => authApi.resetPassword(token, password),
  })
}

export function useAccessRequest(demo = false) {
  return useMutation({ mutationFn: async (values: AccessRequestFormValues) => {
    const {requestedUsername,firstName:proposedFirstName,lastName:proposedLastName,...contract}=values
    if(!demo)await authApi.requestAccess(contract)
    if(demo||requestedUsername){const [firstName,...last]=values.fullName.split(" ");identityService.request({firstName:proposedFirstName??firstName,lastName:proposedLastName??last.join(" "),username:requestedUsername??"",email:values.email,institution:values.institution})}
  } })
}
