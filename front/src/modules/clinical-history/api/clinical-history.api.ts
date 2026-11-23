import type { ClinicalHistoryApi } from "./clinical-history.contract"
import { httpClinicalHistoryApi } from "./clinical-history.http"

/** El recurso de este módulo. Los hooks y las pantallas importan solo esto (nunca `*.http.ts`). */
export const clinicalHistoryApi: ClinicalHistoryApi = httpClinicalHistoryApi
