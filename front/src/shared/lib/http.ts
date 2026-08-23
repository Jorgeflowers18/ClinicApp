import axios, { AxiosError } from "axios"

import { getAccessToken, useAuthStore } from "@/modules/auth/store/auth-store"
import { ApiError, type ApiFieldError } from "@/shared/types/common"
import { env } from "@/shared/lib/env"

export const http = axios.create({
  baseURL: env.apiBaseUrl,
  timeout: 15000,
})

http.interceptors.request.use((config) => {
  const token = getAccessToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Forma estándar de ASP.NET Core para 400 (ValidationProblemDetails).
interface DotNetValidationProblem {
  title?: string
  detail?: string
  errors?: Record<string, string[]>
}

function toFieldErrors(errors?: Record<string, string[]>): ApiFieldError[] | undefined {
  if (!errors) return undefined
  return Object.entries(errors).flatMap(([field, messages]) =>
    messages.map((message) => ({ field, message }))
  )
}

http.interceptors.response.use(
  (response) => response,
  (error: AxiosError<DotNetValidationProblem>) => {
    const status = error.response?.status ?? 0
    const data = error.response?.data

    if (status === 401) {
      useAuthStore.getState().clearSession()
      if (!window.location.pathname.startsWith("/login")) {
        window.location.assign("/login")
      }
    }

    const message = data?.detail ?? data?.title ?? error.message ?? "Ocurrió un error inesperado"
    return Promise.reject(new ApiError(message, status, toFieldErrors(data?.errors)))
  }
)
