import { useRef } from "react"
import { toast } from "sonner"
import type { FieldValues, Path, UseFormReturn } from "react-hook-form"
import { ApiError } from "@/shared/types/common"
import { getErrorMessage } from "@/shared/lib/error-message"

export function useInventorySubmit<T extends FieldValues>(form: UseFormReturn<T>, action: (values: T) => Promise<unknown>, message: string, reveal?: (field: string) => void) {
  const locked = useRef(false)
  return async (values: T, close: () => void) => {
    if(locked.current) return
    locked.current = true
    form.clearErrors("root.server")
    try {
      await action(values)
      form.reset(values)
      toast.success(message)
      close()
    } catch(error) {
      form.setError("root.server", { message: getErrorMessage(error) })
      if(error instanceof ApiError && error.fieldErrors?.length) {
        error.fieldErrors.forEach(({ field, message }) => form.setError(field as Path<T>, { type: "server", message }))
        if(reveal) reveal(error.fieldErrors[0].field)
        else form.setFocus(error.fieldErrors[0].field as Path<T>)
      }
      toast.error(getErrorMessage(error))
    } finally { locked.current = false }
  }
}
