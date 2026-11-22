import { env } from "@/shared/lib/env"

import type { FinanceApi } from "./finance.contract"
import { httpFinanceApi } from "./finance.http"
import { mockFinanceApi } from "./finance.mock"

/** La única elección entre la API y la demostración para este módulo. */
export const financeApi: FinanceApi = env.usesApi("finance") ? httpFinanceApi : mockFinanceApi
