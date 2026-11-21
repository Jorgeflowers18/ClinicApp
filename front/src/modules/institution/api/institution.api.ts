import { env } from "@/shared/lib/env"

import type { InstitutionApi } from "./institution.contract"
import { httpInstitutionApi } from "./institution.http"
import { mockInstitutionApi } from "./institution.mock"

/** La única elección entre la API y la demostración para este módulo. */
export const institutionApi: InstitutionApi = env.usesApi("institution") ? httpInstitutionApi : mockInstitutionApi
