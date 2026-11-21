import { env } from "@/shared/lib/env"

import type { PatientsApi } from "./patients.contract"
import { httpPatientsApi } from "./patients.http"
import { mockPatientsApi } from "./patients.mock"

/** La única elección entre la API y la demostración para este módulo. */
export const patientsApi: PatientsApi = env.usesApi("patients") ? httpPatientsApi : mockPatientsApi
