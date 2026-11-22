import { env } from "@/shared/lib/env"

import type { InventoryApi } from "./inventory.contract"
import { httpInventoryApi } from "./inventory.http"
import { mockInventoryApi } from "./inventory.mock"

/** La única elección entre la API y la demostración para este módulo. */
export const inventoryApi: InventoryApi = env.usesApi("inventory") ? httpInventoryApi : mockInventoryApi
