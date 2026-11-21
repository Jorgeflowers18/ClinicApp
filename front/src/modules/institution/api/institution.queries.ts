import { useSyncExternalStore } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"

import { useAuthStore } from "@/modules/auth/store/auth-store"
import { queryClient } from "@/shared/lib/query-client"

import { institutionApi } from "./institution.api"
import { initialInstitutionProfile, type InstitutionProfile, type PublicInstitution } from "../types/institution.types"

export const institutionKeys = {
  all: ["institution"] as const,
  profile: ["institution", "profile"] as const,
  public: ["institution", "public"] as const,
}

/** El perfil cambia poco: no hace falta pedirlo en cada pantalla. */
const STALE_TIME = 5 * 60_000

/** Solo en demostración: lectura síncrona de `localStorage`, con aviso entre pestañas. */
const local = institutionApi.local

const publicPart = ({ name, subtitle, logoText, logoImage }: InstitutionProfile): PublicInstitution => ({ name, subtitle, logoText, logoImage })

function profileQuery() {
  return {
    queryKey: institutionKeys.profile,
    queryFn: ({ signal }: { signal: AbortSignal }) => institutionApi.getProfile(signal),
    staleTime: STALE_TIME,
  }
}

/** El perfil completo pide sesión (los tres roles); antes de iniciarla no se pide. */
function useProfileQuery() {
  const signedIn = useAuthStore((state) => state.status === "authenticated")
  return useQuery({
    ...profileQuery(),
    enabled: signedIn,
    // Mientras llega, la marca que ya se leyó en el inicio de sesión evita que la barra lateral parpadee.
    placeholderData: () => {
      const brand = queryClient.getQueryData<PublicInstitution>(institutionKeys.public)
      return brand ? { ...initialInstitutionProfile, ...brand } : undefined
    },
  })
}

const useLocalProfile = () => useSyncExternalStore(local!.subscribe, local!.read, () => initialInstitutionProfile)
const useApiProfile = () => useProfileQuery().data ?? initialInstitutionProfile

/** El perfil guardado, para mostrarlo (barra lateral, mensajería). Mientras llega, los valores por defecto. */
export const useInstitutionProfile: () => InstitutionProfile = local ? useLocalProfile : useApiProfile

const useLocalPublic = () => publicPart(useLocalProfile())
function useApiPublic(): PublicInstitution {
  const { data } = useQuery({
    queryKey: institutionKeys.public,
    queryFn: ({ signal }) => institutionApi.getPublic(signal),
    staleTime: STALE_TIME,
  })
  return data ?? publicPart(initialInstitutionProfile)
}

/** Nombre y marca para las pantallas sin sesión (inicio de sesión, recuperar contraseña…). */
export const usePublicInstitution: () => PublicInstitution = local ? useLocalPublic : useApiPublic

const useLocalSavedName = () => useSyncExternalStore(local!.subscribe, local!.readSavedName, () => null)
const useApiSavedName = () => useProfileQuery().data?.name.trim() || null

/**
 * Nombre institucional guardado (o null si no se configuró). Se actualiza al guardar el perfil; los cambios
 * sin guardar no lo afectan. Con la API, el perfil siempre existe (`InstitutionSeeder`).
 */
export const useSavedInstitutionName: () => string | null = local ? useLocalSavedName : useApiSavedName

/** Lo mismo, fuera de React (por ejemplo, al preparar un mensaje). */
export async function fetchSavedInstitutionName(): Promise<string | null> {
  if (local) return local.readSavedName()
  return (await queryClient.fetchQuery(profileQuery())).name.trim() || null
}

/** Para la pantalla de edición: el perfil confirmado, o `undefined` mientras llega de la API. */
export function useEditableInstitutionProfile(): { profile: InstitutionProfile | undefined; error: unknown } {
  const query = useProfileQuery()
  if (local) return { profile: local.read(), error: null }
  return { profile: query.isPlaceholderData ? undefined : query.data, error: query.error }
}

/** El último perfil confirmado (lo que muestra "Cancelar"). */
export function readConfirmedInstitutionProfile(): InstitutionProfile | undefined {
  return local ? local.read() : queryClient.getQueryData<InstitutionProfile>(institutionKeys.profile)
}

export function useSaveInstitutionProfile() {
  return useMutation({
    mutationFn: (profile: InstitutionProfile) => institutionApi.saveProfile(profile),
    onSuccess: (saved) => {
      queryClient.setQueryData(institutionKeys.profile, saved)
      queryClient.setQueryData(institutionKeys.public, publicPart(saved))
    },
  })
}
