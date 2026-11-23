import type { AuthApi } from "./auth.contract"
import { httpAuthApi } from "./auth.http"

/** El recurso de este módulo. Los hooks y las pantallas importan solo esto (nunca `*.http.ts`). */
export const authApi: AuthApi = httpAuthApi
