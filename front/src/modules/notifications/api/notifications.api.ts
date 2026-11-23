import type { NotificationsApi } from "./notifications.contract"
import { httpNotificationsApi } from "./notifications.http"

export type { NotificationLogQuery, NotificationSummary } from "./notifications.contract"

/** El recurso de este módulo. Los hooks y las pantallas importan solo esto (nunca `*.http.ts`). */
export const notificationsApi: NotificationsApi = httpNotificationsApi
