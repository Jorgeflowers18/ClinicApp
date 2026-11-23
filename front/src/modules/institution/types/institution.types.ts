export type InstitutionBranch = {
  /** UUID del servidor. Una sede nueva se envía con `""`: el servidor le da el id. */
  id: string
  name: string
  /** Lo que se muestra: el nombre, o "Sede N" si no tiene. Lo calcula la API. */
  label?: string
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
  /** Última vez que se guardó (solo con la API). */
  updatedAt?: string
}

/** Lo que ve la pantalla de inicio de sesión, sin sesión (`GET /institution/public`). */
export type PublicInstitution = Pick<InstitutionProfile, "name" | "subtitle" | "logoText" | "logoImage">

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

/** El nombre visible de una sede. */
export const branchLabel = (branch: InstitutionBranch) => branch.name.trim() || branch.label || "Nueva sede"
