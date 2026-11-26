import type { InstitutionApi } from "./institution.contract"
import { httpInstitutionApi } from "./institution.http"
import { demoInstitutionApi } from "./institution.demo"
import { isDemonstrationActive } from "@/shared/lib/demonstration-boundary"

/** El recurso de este módulo. Los hooks y las pantallas importan solo esto (nunca `*.http.ts`). */
export const institutionApi: InstitutionApi = {
  getProfile: signal => (isDemonstrationActive() ? demoInstitutionApi : httpInstitutionApi).getProfile(signal),
  getPublic: signal => (isDemonstrationActive() ? demoInstitutionApi : httpInstitutionApi).getPublic(signal),
  saveProfile: profile => (isDemonstrationActive() ? demoInstitutionApi : httpInstitutionApi).saveProfile(profile),
}
