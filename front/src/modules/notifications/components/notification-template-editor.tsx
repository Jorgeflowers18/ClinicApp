import { useRef } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { Plus } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { getErrorMessage } from "@/shared/lib/error-message"

import { useNotificationTemplate, useUpdateNotificationTemplate } from "../api/notifications.queries"
import {
  notificationTemplateSchema,
  notificationVariables,
  type NotificationTemplateFormValues,
} from "../types/notification.types"

function applyPreview(message: string) {
  return notificationVariables.reduce(
    (text, variable) => text.split(variable.token).join(variable.example),
    message
  )
}

export function NotificationTemplateEditor() {
  const { data: template, isLoading } = useNotificationTemplate()
  const updateTemplate = useUpdateNotificationTemplate()
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  const {
    handleSubmit,
    register,
    setValue,
    getValues,
    watch,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<NotificationTemplateFormValues>({
    resolver: zodResolver(notificationTemplateSchema),
    values: template ? { message: template.message } : undefined,
    defaultValues: { message: "" },
  })

  const { ref: messageRef, ...messageRegister } = register("message")
  const message = watch("message")

  function insertVariable(token: string) {
    const el = textareaRef.current
    const current = getValues("message") ?? ""
    const start = el?.selectionStart ?? current.length
    const end = el?.selectionEnd ?? current.length
    const nextValue = `${current.slice(0, start)}${token}${current.slice(end)}`

    setValue("message", nextValue, { shouldDirty: true, shouldValidate: true })

    requestAnimationFrame(() => {
      if (!el) return
      el.focus()
      const cursor = start + token.length
      el.setSelectionRange(cursor, cursor)
    })
  }

  async function onSubmit(values: NotificationTemplateFormValues) {
    try {
      await updateTemplate.mutateAsync(values)
      toast.success("Plantilla de notificación actualizada")
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  if (isLoading) {
    return <Skeleton className="h-56 w-full" />
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Plantilla de notificación predeterminada</CardTitle>
        <CardDescription>
          Este es el mensaje que se envía a los pacientes. Haz clic en una variable para insertarla donde esté el
          cursor; se reemplaza automáticamente por el dato real de cada paciente/cita al enviar.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {notificationVariables.map((variable) => (
              <Button
                key={variable.token}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => insertVariable(variable.token)}
              >
                <Plus />
                {variable.label}
              </Button>
            ))}
          </div>

          <Field data-invalid={!!errors.message}>
            <FieldLabel htmlFor="message">Mensaje</FieldLabel>
            <Textarea
              id="message"
              rows={4}
              placeholder="Hola [nombre del cliente], te escribimos desde..."
              aria-invalid={!!errors.message}
              {...messageRegister}
              ref={(node) => {
                messageRef(node)
                textareaRef.current = node
              }}
            />
            <FieldError errors={errors.message ? [errors.message] : undefined} />
          </Field>

          <div className="rounded-lg border bg-muted/30 p-3 text-sm">
            <p className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">Vista previa</p>
            <p className="whitespace-pre-wrap text-foreground">{applyPreview(message || "")}</p>
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={isSubmitting || !isDirty}>
              {isSubmitting ? "Guardando..." : "Guardar plantilla"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
