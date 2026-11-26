import type { PatientsApi } from "./patients.contract"
import { httpPatientsApi } from "./patients.http"
import { demoPatientsApi,withDemoAdapter } from "@/modules/saas/adapters/operational-demo"

/** El recurso de este módulo. Los hooks y las pantallas importan solo esto (nunca `*.http.ts`). */
export const patientsApi: PatientsApi = withDemoAdapter(httpPatientsApi,demoPatientsApi)
