import { useMutation, useQuery } from "@tanstack/react-query"

import { useAuthStore } from "@/modules/auth/store/auth-store"
import { queryClient } from "@/shared/lib/query-client"
import { useDemoContext, useSaasData } from "@/modules/saas/state"
import { ApiError } from "@/shared/types/common"
import { hasRemovedKnownBranch } from "../lib/branch-hours"

import { institutionApi } from "./institution.api"
import { initialInstitutionProfile, type InstitutionProfile, type PublicInstitution } from "../types/institution.types"

export const institutionKeys = {
  all: ["institution"] as const,
  profile: ["institution", "profile"] as const,
  public: ["institution", "public"] as const,
  profileFor: (scope: string) => ["institution", "profile", scope] as const,
  publicFor: (scope: string) => ["institution", "public", scope] as const,
}

/** El perfil cambia poco: no hace falta pedirlo en cada pantalla. */
const STALE_TIME = 5 * 60_000

const publicPart = ({ name, subtitle, logoText, logoImage }: InstitutionProfile): PublicInstitution => ({ name, subtitle, logoText, logoImage })

function currentScope() {
  const context = useDemoContext.getState()
  return context.userId ? context.organizationId : "frontend-institution-current"
}
function profileQuery(scope = currentScope()) {
  return {
    queryKey: institutionKeys.profileFor(scope),
    queryFn: ({ signal }: { signal: AbortSignal }) => institutionApi.getProfile(signal),
    staleTime: STALE_TIME,
  }
}

/** El perfil completo pide sesión (los tres roles); antes de iniciarla no se pide. */
function useProfileQuery() {
  const signedIn = useAuthStore((state) => state.status === "authenticated")
  const context = useDemoContext()
  const demo = useSaasData()
  const scope = context.userId ? context.organizationId : "frontend-institution-current"
  return useQuery({
    ...profileQuery(scope),
    enabled: signedIn || Boolean(context.userId),
    // Subscribe to local changes without waiting for a network refetch.
    initialData: context.userId ? demo.organizations.find(item => item.id === scope)?.profile : undefined,
    // Mientras llega, la marca que ya se leyó en el inicio de sesión evita que la barra lateral parpadee.
    placeholderData: () => {
      const brand = queryClient.getQueryData<PublicInstitution>(institutionKeys.publicFor(scope))
      return brand ? { ...initialInstitutionProfile, ...brand } : undefined
    },
  })
}

/** El perfil guardado, para mostrarlo (barra lateral, mensajería). Mientras llega, los valores por defecto. */
export function useInstitutionProfile(): InstitutionProfile {
  return useProfileQuery().data ?? initialInstitutionProfile
}

/** Nombre y marca para las pantallas sin sesión (inicio de sesión, recuperar contraseña…). */
export function usePublicInstitution(): PublicInstitution {
  const context = useDemoContext()
  const scope = context.userId ? context.organizationId : "frontend-institution-current"
  const { data } = useQuery({
    queryKey: institutionKeys.publicFor(scope),
    queryFn: ({ signal }) => institutionApi.getPublic(signal),
    staleTime: STALE_TIME,
  })
  return data ?? publicPart(initialInstitutionProfile)
}

/** Nombre institucional guardado. El perfil siempre existe en la API (`InstitutionSeeder`). */
export function useSavedInstitutionName(): string | null {
  return useProfileQuery().data?.name.trim() || null
}

/** Lo mismo, fuera de React (por ejemplo, al preparar un mensaje). */
export async function fetchSavedInstitutionName(): Promise<string | null> {
  return (await queryClient.fetchQuery(profileQuery())).name.trim() || null
}

/** Para la pantalla de edición: el perfil confirmado, o `undefined` mientras llega. */
export function useEditableInstitutionProfile(): { profile: InstitutionProfile | undefined; error: unknown } {
  const query = useProfileQuery()
  return { profile: query.isPlaceholderData ? undefined : query.data, error: query.error }
}

/** El último perfil confirmado (lo que muestra "Cancelar"). */
export function readConfirmedInstitutionProfile(): InstitutionProfile | undefined {
  return queryClient.getQueryData<InstitutionProfile>(institutionKeys.profileFor(currentScope()))
}

export function useSaveInstitutionProfile() {
  const context = useDemoContext()
  const scope = context.userId ? context.organizationId : "frontend-institution-current"
  return useMutation({
    mutationFn: (profile: InstitutionProfile) => {
      const confirmed = queryClient.getQueryData<InstitutionProfile>(institutionKeys.profileFor(scope))
      if (!context.userId && confirmed && hasRemovedKnownBranch(confirmed.branches, profile.branches)) throw new ApiError("Se conservan las sedes conocidas del servidor. Recarga el perfil para sincronizarlo; la eliminación requiere validación del backend.", 409)
      return institutionApi.saveProfile(profile)
    },
    onSuccess: (saved) => {
      queryClient.setQueryData(institutionKeys.profileFor(scope), saved)
      queryClient.setQueryData(institutionKeys.publicFor(scope), publicPart(saved))
    },
  })
}
