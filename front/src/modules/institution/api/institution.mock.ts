import type { InstitutionApi, LocalInstitutionStore } from "./institution.contract"
import { initialInstitutionProfile, type InstitutionProfile } from "../types/institution.types"

// Demostración: el perfil vive en `localStorage` de este navegador.

export const INSTITUTION_PROFILE_STORAGE_KEY = "clinicapp.institution-profile"
const INSTITUTION_PROFILE_CHANGED = "clinicapp:institution-profile-changed"

function readInstitutionProfile(): InstitutionProfile {
  if (typeof window === "undefined") return initialInstitutionProfile
  try {
    const raw = window.localStorage.getItem(INSTITUTION_PROFILE_STORAGE_KEY)
    if (!raw) return initialInstitutionProfile
    const parsed = JSON.parse(raw) as Partial<InstitutionProfile>
    return {
      ...initialInstitutionProfile,
      ...parsed,
      subtitle: typeof parsed.subtitle === "string" ? parsed.subtitle : initialInstitutionProfile.subtitle,
      branches: parsed.branches?.length ? parsed.branches : initialInstitutionProfile.branches,
    }
  } catch {
    return initialInstitutionProfile
  }
}

/** Nombre guardado (no el borrador ni el valor por defecto): la mensajería solo usa un nombre que el administrador confirmó. */
function readSavedInstitutionName(): string | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(INSTITUTION_PROFILE_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<InstitutionProfile>
    return typeof parsed.name === "string" && parsed.name.trim() ? parsed.name.trim() : null
  } catch {
    return null
  }
}

/** Como el servidor: una sede nueva (id vacío) recibe su id al guardar. */
function withBranchIds(profile: InstitutionProfile): InstitutionProfile {
  let idNumber = Date.now()
  const taken = new Set(profile.branches.map((branch) => branch.id))
  return {
    ...profile,
    branches: profile.branches.map((branch) => {
      if (branch.id) return branch
      while (taken.has(`branch-${idNumber}`)) idNumber += 1
      taken.add(`branch-${idNumber}`)
      return { ...branch, id: `branch-${idNumber}` }
    }),
  }
}

let lastRaw: string | null | undefined
let lastProfile = initialInstitutionProfile

const local: LocalInstitutionStore = {
  read() {
    let raw: string | null = null
    try { raw = window.localStorage.getItem(INSTITUTION_PROFILE_STORAGE_KEY) } catch { /* Se usa el valor por defecto del lector. */ }
    if (raw !== lastRaw) {
      lastRaw = raw
      lastProfile = readInstitutionProfile()
    }
    return lastProfile
  },
  readSavedName: readSavedInstitutionName,
  subscribe(onChange) {
    const onStorage = (event: StorageEvent) => {
      if (event.storageArea === window.localStorage && (event.key === INSTITUTION_PROFILE_STORAGE_KEY || event.key === null)) onChange()
    }
    window.addEventListener(INSTITUTION_PROFILE_CHANGED, onChange)
    window.addEventListener("storage", onStorage)
    return () => {
      window.removeEventListener(INSTITUTION_PROFILE_CHANGED, onChange)
      window.removeEventListener("storage", onStorage)
    }
  },
}

export const mockInstitutionApi: InstitutionApi = {
  async getPublic() {
    const { name, subtitle, logoText, logoImage } = readInstitutionProfile()
    return { name, subtitle, logoText, logoImage }
  },
  async getProfile() {
    return readInstitutionProfile()
  },
  async saveProfile(profile) {
    const saved = withBranchIds(profile)
    window.localStorage.setItem(INSTITUTION_PROFILE_STORAGE_KEY, JSON.stringify(saved))
    // Solo se avisa de lo que se guardó: si el almacenamiento falla, la barra lateral no cambia.
    window.dispatchEvent(new Event(INSTITUTION_PROFILE_CHANGED))
    return saved
  },
  local,
}
