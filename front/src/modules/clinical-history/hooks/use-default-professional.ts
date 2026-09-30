import { useAuthStore } from "@/modules/auth/store/auth-store"
import { useProfessionals } from "@/modules/appointments/api/appointments.queries"

import { matchProfessionalByName } from "../lib/visit"

/**
 * Profesional sugerido para una visita nueva: el que coincide por nombre con el usuario logueado.
 * TODO: usar `user.professionalId` cuando `GET /auth/me` lo exponga; hoy el usuario y el
 * profesional no están vinculados en el modelo.
 */
export function useDefaultProfessionalId() {
  const user = useAuthStore((state) => state.user)
  const { data: professionals } = useProfessionals()
  const list = professionals ?? []
  return (
    matchProfessionalByName(user?.name, list)?.id ??
    matchProfessionalByName(user?.profile?.fullName, list)?.id ??
    ""
  )
}
