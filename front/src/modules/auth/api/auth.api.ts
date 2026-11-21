import { env } from "@/shared/lib/env"

import type { AuthApi } from "./auth.contract"
import { httpAuthApi } from "./auth.http"
import { mockAuthApi } from "./auth.mock"

/** La única elección entre la API y la demostración para este módulo. */
export const authApi: AuthApi = env.usesApi("auth") ? httpAuthApi : mockAuthApi
