import { env } from "@/shared/lib/env"

import type { ClinicalHistoryApi } from "./clinical-history.contract"
import { httpClinicalHistoryApi } from "./clinical-history.http"
import { mockClinicalHistoryApi } from "./clinical-history.mock"

/** La única elección entre la API y la demostración (IndexedDB) para este módulo. */
export const clinicalHistoryApi: ClinicalHistoryApi = env.usesApi("clinical-history") ? httpClinicalHistoryApi : mockClinicalHistoryApi
