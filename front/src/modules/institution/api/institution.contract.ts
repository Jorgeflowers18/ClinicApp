import type { InstitutionProfile, PublicInstitution } from "../types/institution.types"

/**
 * Perfil de la clínica. `institution.http.ts` lo cumple con la API.
 */
export interface InstitutionApi {
  /** Nombre y marca para el inicio de sesión, sin sesión. */
  getPublic(signal?: AbortSignal): Promise<PublicInstitution>
  getProfile(signal?: AbortSignal): Promise<InstitutionProfile>
  /** Reemplaza el perfil completo, sedes incluidas (solo admin). Devuelve el perfil guardado, con los ids de las sedes. */
  saveProfile(profile: InstitutionProfile): Promise<InstitutionProfile>
}

