import { useRef } from "react"
import { toast } from "sonner"
import type { FieldValues, Path, UseFormReturn } from "react-hook-form"
import { ApiError } from "@/shared/types/common"
import { getErrorMessage } from "@/shared/lib/error-message"
import { applyServerFieldErrors } from "@/shared/lib/field-issues"

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
      // `applyServerFieldErrors` lleva `lines[0].itemId` a la ruta del formulario (`lines.0.itemId`) y solo marca campos que existen.
      const issues = error instanceof ApiError ? applyServerFieldErrors(form, error) : []
      if(issues.length) {
        if(reveal) reveal(issues[0].field)
        else form.setFocus(issues[0].field as Path<T>)
      }
      toast.error(getErrorMessage(error))
    } finally { locked.current = false }
  }
}
