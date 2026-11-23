import type { InstitutionApi } from "./institution.contract"
import { httpInstitutionApi } from "./institution.http"

/** El recurso de este módulo. Los hooks y las pantallas importan solo esto (nunca `*.http.ts`). */
export const institutionApi: InstitutionApi = httpInstitutionApi
