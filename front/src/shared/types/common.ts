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

export class ApiError extends Error {
  status: number
  fieldErrors?: ApiFieldError[]

  constructor(message: string, status: number, fieldErrors?: ApiFieldError[]) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.fieldErrors = fieldErrors
  }
}

export type Role = "admin" | "recepcion" | "medico"
