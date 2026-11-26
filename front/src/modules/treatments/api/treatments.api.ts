import type { TreatmentsApi } from "./treatments.contract"
import { httpTreatmentsApi } from "./treatments.http"
import { withDemoAdapter } from "@/modules/saas/adapters/operational-demo"

/** El recurso de este módulo. Los hooks y las pantallas importan solo esto (nunca `*.http.ts`). */
export const treatmentsApi: TreatmentsApi = withDemoAdapter(httpTreatmentsApi,{async listActive(){return []},async listAssignmentsByPatient(){return []}})
