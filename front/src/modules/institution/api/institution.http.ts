import type { components } from "@/shared/api/schema"
import { fitImage, logoLimits } from "@/shared/lib/fit-image"
import { apiGet, apiPut } from "@/shared/lib/http"

import type { InstitutionApi } from "./institution.contract"
import type { InstitutionProfile } from "../types/institution.types"

type InstitutionProfileDto = components["schemas"]["InstitutionProfileDto"]
type InstitutionProfileRequest = components["schemas"]["InstitutionProfileRequest"]
type PublicInstitutionDto = components["schemas"]["PublicInstitutionDto"]

const toProfile = (dto: InstitutionProfileDto): InstitutionProfile => ({
  ...dto,
  logoImage: dto.logoImage ?? null,
  branches: dto.branches.map((branch) => ({ ...branch })),
})

async function toRequest(profile: InstitutionProfile): Promise<InstitutionProfileRequest> {
  return {
    name: profile.name, subtitle: profile.subtitle, legalName: profile.legalName, ruc: profile.ruc, phone: profile.phone,
    email: profile.email, address: profile.address, website: profile.website, logoText: profile.logoText,
    // La API acepta PNG, JPG o WebP de hasta ~500 KB: un SVG o un logo grande se recodifican aquí.
    logoImage: await fitImage(profile.logoImage, logoLimits),
    notes: profile.notes, hours: profile.hours,
    // Una sede nueva va sin id; `label` lo calcula el servidor.
    branches: profile.branches.map(({ id, name, address, phone, hours, isMain }) => ({ id: id || null, name, address, phone, hours, isMain })),
  }
}

export const httpInstitutionApi: InstitutionApi = {
  async getPublic(signal) {
    const dto = await apiGet<PublicInstitutionDto>("/institution/public", { signal })
    return { ...dto, logoImage: dto.logoImage ?? null }
  },
  async getProfile(signal) {
    return toProfile(await apiGet<InstitutionProfileDto>("/institution/profile", { signal }))
  },
  async saveProfile(profile) {
    return toProfile(await apiPut<InstitutionProfileDto>("/institution/profile", await toRequest(profile)))
  },
}
