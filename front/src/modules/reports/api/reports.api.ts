import { env } from "@/shared/lib/env"

import type { ReportsApi } from "./reports.contract"
import { httpReportsApi } from "./reports.http"
import { mockReportsApi } from "./reports.mock"

/** La única elección entre la API y la demostración para este módulo. */
export const reportsApi: ReportsApi = env.usesApi("reports") ? httpReportsApi : mockReportsApi
