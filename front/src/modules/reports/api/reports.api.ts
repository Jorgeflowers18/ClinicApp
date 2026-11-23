import type { ReportsApi } from "./reports.contract"
import { httpReportsApi } from "./reports.http"

/** El recurso de este módulo. Los hooks y las pantallas importan solo esto (nunca `*.http.ts`). */
export const reportsApi: ReportsApi = httpReportsApi
