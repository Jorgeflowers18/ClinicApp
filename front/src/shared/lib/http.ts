import axios, { AxiosError, type AxiosRequestConfig } from "axios"

import { getAccessToken, useAuthStore } from "@/modules/auth/store/auth-store"
import { ApiError } from "@/shared/types/common"
import { env } from "@/shared/lib/env"
import { normalizeProblem } from "@/shared/lib/api-problem"
import { isDemonstrationActive } from "./demonstration-boundary"

/**
 * Cliente HTTP único de la app. Las implementaciones `*.http.ts` de cada módulo usan los helpers `api*` de
 * abajo; ningún archivo de pantalla debe llamar a axios directamente.
 */
export const http = axios.create({
  baseURL: env.apiBaseUrl,
  timeout: 15000,
  // El navegador manda y guarda la cookie httpOnly de renovación (`clinicapp_refresh`, ruta /api/auth).
  // El CORS del back ya permite credenciales para el origen del frontend.
  withCredentials: true,
})

http.interceptors.request.use((config) => {
  if(isDemonstrationActive())throw new ApiError("Esta operación utiliza la API real y no está disponible en la demostración. No se envió ninguna petición al servidor.",501)
  const token = getAccessToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

/**
 * Qué hacer ante un 401 de la API. Por defecto cierra la sesión y lleva al inicio de sesión (comportamiento
 * actual). El plan 1 (auth) lo reemplaza con `setUnauthorizedHandler` para renovar la sesión con
 * `POST /auth/refresh` y reintentar la petición.
 */
export type UnauthorizedHandler = (error: AxiosError) => Promise<unknown> | void

let unauthorizedHandler: UnauthorizedHandler = () => {
  useAuthStore.getState().clearSession()
  if (!window.location.pathname.startsWith("/login")) {
    window.location.assign("/login")
  }
}

export function setUnauthorizedHandler(handler: UnauthorizedHandler) {
  unauthorizedHandler = handler
}

/** Con `responseType: "blob"` el cuerpo del error también llega como Blob: se lee como JSON si lo es. */
async function errorPayload(data: unknown): Promise<unknown> {
  if (typeof Blob !== "undefined" && data instanceof Blob && data.type.includes("json")) {
    try { return JSON.parse(await data.text()) } catch { return undefined }
  }
  return data
}

/**
 * Todo error de red o del servidor sale como un `ApiError` normalizado por `normalizeProblem`: acepta el
 * `ValidationProblemDetails` de ASP.NET (`errors` como diccionario) y el formato de `ClinicApp.ErrorHandling`
 * (`code`, `errors` como lista), y nunca muestra el detalle de un 500.
 */
http.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    if(error instanceof ApiError)return Promise.reject(error)
    // Una petición cancelada (búsqueda vieja, pantalla cerrada) no es un error para el usuario.
    if (axios.isCancel(error)) return Promise.reject(error)

    const status = error.response?.status ?? 0
    if (status === 401) {
      const retried = await unauthorizedHandler(error)
      if (retried !== undefined) return retried
    }

    const problem = normalizeProblem(await errorPayload(error.response?.data), status)
    // Sin errores por campo, `fieldErrors` queda undefined (como antes), no una lista vacía.
    const fieldErrors = problem.errors?.length ? problem.errors.map(({ field, message }) => ({ field, message })) : undefined
    return Promise.reject(new ApiError(problem.detail, status, fieldErrors,
      { kind: problem.kind, code: problem.code, traceId: problem.traceId }))
  }
)

/** Opciones que aceptan los helpers: parámetros de la URL, cancelación y encabezados. */
export type ApiRequestOptions = Pick<AxiosRequestConfig, "params" | "signal" | "headers">

export async function apiGet<T>(url: string, options?: ApiRequestOptions): Promise<T> {
  const { data } = await http.get<T>(url, options)
  return data
}

export async function apiPost<T>(url: string, body?: unknown, options?: ApiRequestOptions): Promise<T> {
  const { data } = await http.post<T>(url, body, options)
  return data
}

export async function apiPut<T>(url: string, body: unknown, options?: ApiRequestOptions): Promise<T> {
  const { data } = await http.put<T>(url, body, options)
  return data
}

export async function apiPatch<T>(url: string, body: unknown, options?: ApiRequestOptions): Promise<T> {
  const { data } = await http.patch<T>(url, body, options)
  return data
}

export async function apiDelete(url: string, options?: ApiRequestOptions): Promise<void> {
  await http.delete(url, options)
}

/** Descarga un archivo (adjuntos de la historia clínica). */
export async function apiBlob(url: string, options?: ApiRequestOptions): Promise<Blob> {
  const { data } = await http.get<Blob>(url, { ...options, responseType: "blob" })
  return data
}

/** Envía un formulario multipart (subida de archivos). El navegador pone el `Content-Type` con su límite. */
export async function apiForm<T>(url: string, form: FormData, options?: ApiRequestOptions): Promise<T> {
  const { data } = await http.post<T>(url, form, options)
  return data
}
