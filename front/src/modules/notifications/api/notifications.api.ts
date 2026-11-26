import type { NotificationsApi } from "./notifications.contract"
import { httpNotificationsApi } from "./notifications.http"
import { withDemoAdapter,demoNotificationsApi } from "@/modules/saas/adapters/operational-demo"

export type { NotificationLogQuery, NotificationSummary } from "./notifications.contract"

/** El recurso de este módulo. Los hooks y las pantallas importan solo esto (nunca `*.http.ts`). */
export const notificationsApi: NotificationsApi = withDemoAdapter(httpNotificationsApi,demoNotificationsApi)
