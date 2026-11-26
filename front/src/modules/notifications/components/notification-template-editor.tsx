import { useRef } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useWatch } from "react-hook-form"
import { useValidatedForm as useForm } from "@/shared/hooks/use-validated-form"
import { FileText, Plus, Save } from "lucide-react"
import { toast } from "sonner"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { NotificationMessagePreview } from "./notification-message-preview"
import { useDemoContext } from "@/modules/saas/state"
import { getErrorMessage } from "@/shared/lib/error-message"
import { useNotificationTemplate, useUpdateNotificationTemplate } from "../api/notifications.queries"
import { useTemplateNavigationGuard } from "../hooks/use-template-navigation-guard"
import { notificationTemplateSchema, notificationVariables, type NotificationTemplateFormValues } from "../types/notification.types"

const variableLabels: Record<string,string> = {
  "[nombre del cliente]": "Nombre del paciente", "[nombre de la clínica]": "Clínica",
  "[fecha de la cita]": "Fecha de cita", "[hora de la cita]": "Hora de cita", "[profesional]": "Profesional",
}
export function NotificationTemplateEditor() {
  const query = useNotificationTemplate()
  if (query.isPending) return <Skeleton className="h-48 w-full" aria-label="Cargando plantilla" />
  if (!query.data) return <Alert variant="destructive"><AlertDescription>No se pudo cargar la plantilla. No se ha abierto un formulario vacío sobre tus datos.</AlertDescription><Button variant="outline" onClick={() => void query.refetch()}>Reintentar carga de plantilla</Button></Alert>
  return <>{query.isError && <Alert variant="destructive"><AlertDescription>No se pudo actualizar la plantilla desde el servidor. Tu borrador se conserva.</AlertDescription><Button variant="outline" onClick={() => void query.refetch()}>Reintentar carga de plantilla</Button></Alert>}<TemplateForm initialMessage={query.data.message} /></>
}
function TemplateForm({ initialMessage }: { initialMessage: string }) {
  const updateTemplate = useUpdateNotificationTemplate(), textareaRef = useRef<HTMLTextAreaElement | null>(null), submitting = useRef(false)
  const saved = useRef(initialMessage)
  const form = useForm<NotificationTemplateFormValues>({ resolver: zodResolver(notificationTemplateSchema), defaultValues: {message: initialMessage} })
  const { handleSubmit, register, setValue, getValues, reset, clearErrors, setError, formState: { errors, isSubmitting, isDirty } } = form
  useTemplateNavigationGuard(isDirty || isSubmitting, isSubmitting, () => reset({message:saved.current}))
  const { ref: messageRef, ...messageRegister } = register("message")
  const message = useWatch({control:form.control,name:"message"})
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
    if(!useDemoContext.getState().userId&&/\{[^{}]+\}/.test(values.message)){setError("message",{message:"Las variables nuevas se pueden previsualizar y usar en WhatsApp. Para guardarlas como plantilla del servidor falta integrar su resolver. En demostración sí puedes guardarlas localmente."});return}
    if(submitting.current) return
    submitting.current = true; clearErrors("root.server")
    try {
      const updated = await updateTemplate.mutateAsync(values)
      saved.current = updated.message
      reset({ message: updated.message })
      toast.success("Plantilla de mensaje actualizada")
    } catch(error) {
      setError("root.server", { message: getErrorMessage(error) })
    } finally { submitting.current = false }
  }
  return <Card className="clinic-notification-template messaging-template">
    <CardHeader><CardTitle><FileText aria-hidden="true" />Plantilla de mensaje predeterminada</CardTitle><CardDescription>Personaliza el mensaje que reciben los pacientes</CardDescription></CardHeader>
    <CardContent><form noValidate onSubmit={event => void handleSubmit(values => onSubmit(values))(event)} className="messaging-template-layout">
      <fieldset disabled={isSubmitting} className="messaging-template-editor">
        <div><p className="messaging-field-heading">Variables disponibles</p><div className="messaging-variables" role="group" aria-label="Insertar variable">
          {notificationVariables.map(variable => <Button key={variable.token} type="button" variant="outline" size="sm" onClick={() => insertVariable(variable.token)}><Plus aria-hidden="true" />{variableLabels[variable.token] ?? variable.label}</Button>)}
        </div></div>
        <Field data-invalid={Boolean(errors.message)}><FieldLabel htmlFor="message">Mensaje</FieldLabel><Textarea id="message" rows={6} placeholder="Hola [nombre del cliente], te escribimos desde…" aria-invalid={Boolean(errors.message)} aria-describedby={errors.message ? "message-error message-count" : "message-count"} {...messageRegister} ref={node => { messageRef(node); textareaRef.current = node }} />
          <FieldError id="message-error" errors={errors.message ? [errors.message] : undefined} /><span id="message-count" className="messaging-character-count">{message.length} caracteres en la plantilla</span>
        </Field>
        <p className="messaging-hint">Se insertan donde esté el cursor y se sustituyen al generar el mensaje. La vista previa utiliza datos de ejemplo.</p>
      </fieldset>
      <NotificationMessagePreview message={message||""}/>
      {errors.root?.server && <Alert variant="destructive" className="messaging-save-error"><AlertDescription>{errors.root.server.message}</AlertDescription></Alert>}
      <div className="messaging-template-actions" data-form-actions="" data-context="page"><Button type="submit" disabled={isSubmitting || !isDirty}><Save aria-hidden="true" />{isSubmitting ? "Guardando..." : "Guardar plantilla"}</Button></div>
    </form></CardContent>
  </Card>
}
