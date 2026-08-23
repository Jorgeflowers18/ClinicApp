import { ApiError } from "@/shared/types/common"

export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message
  }
  if (error instanceof Error) {
    return error.message
  }
  return "Ocurrió un error inesperado"
}
