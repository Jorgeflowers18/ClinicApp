import type { InstitutionApi } from "./institution.contract"
import { initialInstitutionProfile, type InstitutionProfile } from "../types/institution.types"
import { useDemoContext } from "@/modules/saas/state"
import { demoId, readDemoData, updateDemoData } from "@/modules/saas/adapters/demo-repository"
import { ApiError } from "@/shared/types/common"
import { isInstitutionAdministrator } from "@/modules/saas/lib/access-catalogs"

export function demoInstitutionProfile(): InstitutionProfile {
  const org = readDemoData().organizations.find(item => item.id === useDemoContext.getState().organizationId)
  // Old seeded names/branches are not confirmed institutional configuration.
  return org?.profile ?? { ...initialInstitutionProfile, name: "", legalName: "", ruc: "", phone: "", email: "", address: "", website: "", notes: "", hours: "", branches: [] }
}
export const demoInstitutionApi: InstitutionApi = {
  async getProfile() { return demoInstitutionProfile() },
  async getPublic() { return demoInstitutionProfile() },
  async saveProfile(profile) {
    const context = useDemoContext.getState()
    const user = readDemoData().users.find(item => item.id === context.userId)
    if (!user || !isInstitutionAdministrator(user, readDemoData(), context.organizationId)) throw new ApiError("No puedes configurar esta institución.", 403)
    const saved = { ...profile, branches: profile.branches.map(branch => ({ ...branch, id: branch.id || demoId() })), updatedAt: new Date().toISOString() }
    updateDemoData(data => { data.organizations.find(item => item.id === context.organizationId)!.profile = saved })
    return saved
  },
}
