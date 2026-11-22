import { useAuthStore } from "@/modules/auth/store/auth-store"
import { useProfessionals } from "@/modules/appointments/api/appointments.queries"

import { matchProfessionalByName } from "../lib/record"

/**
 * Profesional sugerido para una atención nueva: el vinculado a la cuenta (`user.professionalId`, de la API)
 * y, si no hay, el que coincide por nombre con el usuario logueado.
 */
export function useDefaultProfessionalId() {
  const user = useAuthStore((state) => state.user)
  const { data: professionals } = useProfessionals()
  const list = professionals ?? []
  return (
    user?.professionalId ??
    matchProfessionalByName(user?.name, list)?.id ??
    matchProfessionalByName(user?.profile?.fullName, list)?.id ??
    ""
  )
}
