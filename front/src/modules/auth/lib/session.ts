import type { AxiosRequestConfig } from "axios"

import { http, setUnauthorizedHandler } from "@/shared/lib/http"

import { authApi } from "../api/auth.api"
import { useAuthStore } from "../store/auth-store"

let renewing: Promise<boolean> | null = null

/**
 * Renueva la sesión con `POST /auth/refresh`. Si varias peticiones reciben un 401 a la vez, todas esperan la
 * misma renovación: el servidor rota la cookie y un segundo refresh simultáneo sería un desperdicio.
 */
export function renewSession(): Promise<boolean> {
  renewing ??= authApi.refresh()
    .then((session) => {
      if (!session) return false
      useAuthStore.getState().setSession(session.accessToken, session.user)
      return true
    })
    .catch(() => false)
    .finally(() => { renewing = null })
  return renewing
}

/** Los 401 de estas rutas son la respuesta en sí (contraseña incorrecta, sin cookie): no se renueva. */
const withoutRenewal = ["/auth/login", "/auth/refresh", "/auth/logout"]

type RetriableConfig = AxiosRequestConfig & { sessionRetried?: boolean }

function installSessionRenewal() {
  setUnauthorizedHandler(async (error) => {
    const config = error.config as RetriableConfig | undefined
    if (!config || withoutRenewal.some((url) => config.url?.startsWith(url))) return undefined

    const sentToken = String(config.headers?.Authorization ?? "").replace(/^Bearer /, "")
    const tokenChanged = !!sentToken && sentToken !== useAuthStore.getState().accessToken
    // Si otra petición ya renovó la sesión mientras esta viajaba, basta con reintentar con el token nuevo.
    if (config.sessionRetried || !(tokenChanged || await renewSession())) {
      // Sin sesión, `ProtectedRoute` lleva al inicio de sesión y recuerda la pantalla (`state.from`).
      if (useAuthStore.getState().user) useAuthStore.getState().clearSession()
      return undefined
    }
    config.sessionRetried = true
    return http.request(config)
  })
}

let started = false

/**
 * Se llama una vez al arrancar (`main.tsx`). Instala la renovación ante un 401 y, como el token no se guarda
 * en el navegador, pregunta al servidor si la cookie de renovación sigue valiendo.
 */
export function startSession(): void {
  if (started) return
  started = true
  installSessionRenewal()
  if (useAuthStore.getState().status !== "checking") return
  void renewSession().then((ok) => {
    if (!ok) useAuthStore.getState().clearSession()
  })
}
