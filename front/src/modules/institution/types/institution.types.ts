export type InstitutionBranch = {
  id: string
  name: string
  address: string
  phone: string
  hours: string
  isMain: boolean
}

export type InstitutionProfile = {
  name: string
  subtitle: string
  legalName: string
  ruc: string
  phone: string
  email: string
  address: string
  website: string
  /** Legacy persisted value; visible initials are generated from name. */
  logoText: string
  logoImage: string | null
  notes: string
  hours: string
  branches: InstitutionBranch[]
}

export const INSTITUTION_PROFILE_STORAGE_KEY = "clinicapp.institution-profile"
export const INSTITUTION_PROFILE_CHANGED = "clinicapp:institution-profile-changed"

export const initialInstitutionProfile: InstitutionProfile = {
  name: "ClinicApp Odontología",
  subtitle: "",
  legalName: "Grupo Odontológico ClinicApp S.A.",
  ruc: "1798765432001",
  phone: "+593 98 123 4567",
  email: "contacto@clinicapp.com",
  address: "Av. Amazonas N45-120, Quito",
  website: "https://clinicapp.com",
  logoText: "CA",
  logoImage: null,
  notes:
    "Clínica multidisciplinaria especializada en diagnóstico, ortodoncia, rehabilitación y atención preventiva.",
  hours: "Lunes a viernes: 08:00 - 18:00\nSábados: 08:00 - 13:00",
  branches: [],
}

export function readInstitutionProfile(): InstitutionProfile {
  if (typeof window === "undefined") {
    return initialInstitutionProfile
  }

  try {
    const raw = window.localStorage.getItem(INSTITUTION_PROFILE_STORAGE_KEY)
    if (!raw) {
      return initialInstitutionProfile
    }

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

export function writeInstitutionProfile(profile: InstitutionProfile) {
  if (typeof window === "undefined") {
    return
  }

  window.localStorage.setItem(INSTITUTION_PROFILE_STORAGE_KEY, JSON.stringify(profile))
  // Publish only confirmed writes; failed storage must never change the Sidebar.
  window.dispatchEvent(new Event(INSTITUTION_PROFILE_CHANGED))
}
