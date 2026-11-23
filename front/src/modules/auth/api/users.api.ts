import type { UsersApi } from "./users.contract"
import { httpUsersApi } from "./users.http"

/** Gestión de usuarios (solo admin). Los hooks y las pantallas importan solo esto. */
export const usersApi: UsersApi = httpUsersApi
