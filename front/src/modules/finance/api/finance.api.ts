import type { FinanceApi } from "./finance.contract"
import { httpFinanceApi } from "./finance.http"

/** El recurso de este módulo. Los hooks y las pantallas importan solo esto (nunca `*.http.ts`). */
export const financeApi: FinanceApi = httpFinanceApi
