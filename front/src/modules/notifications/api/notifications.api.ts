import { env } from "@/shared/lib/env"

import type { NotificationsApi } from "./notifications.contract"
import { httpNotificationsApi } from "./notifications.http"
import { mockNotificationsApi } from "./notifications.mock"

export type { NotificationLogQuery } from "./notifications.contract"

/** La única elección entre la API y la demostración para este módulo. */
export const notificationsApi: NotificationsApi = env.usesApi("notifications") ? httpNotificationsApi : mockNotificationsApi
