import { env } from "@/shared/lib/env"

import type { TreatmentsApi } from "./treatments.contract"
import { httpTreatmentsApi } from "./treatments.http"
import { mockTreatmentsApi } from "./treatments.mock"

/** La única elección entre la API y la demostración para este módulo. */
export const treatmentsApi: TreatmentsApi = env.usesApi("treatments") ? httpTreatmentsApi : mockTreatmentsApi
