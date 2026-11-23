import type { TreatmentsApi } from "./treatments.contract"
import { httpTreatmentsApi } from "./treatments.http"

/** El recurso de este módulo. Los hooks y las pantallas importan solo esto (nunca `*.http.ts`). */
export const treatmentsApi: TreatmentsApi = httpTreatmentsApi
