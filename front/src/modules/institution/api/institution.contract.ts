import type { InstitutionProfile, PublicInstitution } from "../types/institution.types"

/**
 * Perfil de la clínica. `institution.http.ts` lo cumple con la API y `institution.mock.ts` con `localStorage`;
 * `institution.api.ts` elige con `env.usesApi("institution")`.
 */
export interface InstitutionApi {
  /** Nombre y marca para el inicio de sesión, sin sesión. */
  getPublic(signal?: AbortSignal): Promise<PublicInstitution>
  getProfile(signal?: AbortSignal): Promise<InstitutionProfile>
  /** Reemplaza el perfil completo, sedes incluidas (solo admin). Devuelve el perfil guardado, con los ids de las sedes. */
  saveProfile(profile: InstitutionProfile): Promise<InstitutionProfile>
  /**
   * Solo demostración: el perfil guardado se lee al instante y cada pestaña se entera de los cambios (evento
   * `storage`). Con la API no existe y la lectura pasa por React Query.
   */
  local?: LocalInstitutionStore
}

export interface LocalInstitutionStore {
  read(): InstitutionProfile
  /** El nombre que guardó el administrador, o `null` si nunca guardó el perfil. */
  readSavedName(): string | null
  subscribe(onChange: () => void): () => void
}
