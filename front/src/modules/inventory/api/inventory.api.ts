import type { InventoryApi } from "./inventory.contract"
import { httpInventoryApi } from "./inventory.http"

/** El recurso de este módulo. Los hooks y las pantallas importan solo esto (nunca `*.http.ts`). */
export const inventoryApi: InventoryApi = httpInventoryApi
