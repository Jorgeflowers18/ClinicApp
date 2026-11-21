import { errorKind, type ApiErrorKind } from "@/shared/lib/api-problem"

export interface Paginated<T> {
  items: T[]
  page: number
  pageSize: number
  totalItems: number
  totalPages: number
}

export interface PageQuery {
  page?: number
  pageSize?: number
  search?: string
}

export interface ApiFieldError {
  field: string
  message: string
}

/** Datos extra del error de la API (ver `shared/lib/api-problem.ts`). */
export interface ApiErrorDetails {
  kind?: ApiErrorKind
  code?: string
  traceId?: string
}

/**
 * Único error que ven las pantallas, venga del servidor (normalizado en `shared/lib/http.ts`) o de un mock.
 * `kind` clasifica el error (validación, conflicto, sesión…); `traceId` sirve para buscarlo en el log del back.
 */
export class ApiError extends Error {
  status: number
  fieldErrors?: ApiFieldError[]
  kind: ApiErrorKind
  code: string
  traceId?: string

  constructor(message: string, status: number, fieldErrors?: ApiFieldError[], details: ApiErrorDetails = {}) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.fieldErrors = fieldErrors
    this.code = details.code ?? `HTTP_${status || "NETWORK"}`
    this.kind = details.kind ?? errorKind(status, this.code, Boolean(fieldErrors?.length))
    this.traceId = details.traceId
  }
}

export type Role = "admin" | "recepcion" | "medico"
