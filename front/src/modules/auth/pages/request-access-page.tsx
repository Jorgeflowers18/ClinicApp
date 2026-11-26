import { zodResolver } from "@hookform/resolvers/zod"
import { LoaderCircle } from "lucide-react"
import { useValidatedForm as useForm } from "@/shared/hooks/use-validated-form"
import { Link, useLocation } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { getErrorMessage } from "@/shared/lib/error-message"

import { useAccessRequest } from "../api/auth.queries"

import { AuthLayout, AuthNotice } from "../components/auth-layout"
import type { AccessRequestFormValues } from "../types/access-form.types"
import { accessRequestDetailsSchema, type AccessRequestFields } from "../lib/access-request-form"

export function RequestAccessPage() {
  const location = useLocation()
  const demo=new URLSearchParams(location.search).get("demo")==="1"
  const request = useAccessRequest(demo)
  const { register, handleSubmit, formState: { errors } } = useForm<AccessRequestFields, unknown, AccessRequestFormValues>({
    resolver: zodResolver(accessRequestDetailsSchema),
    mode: "onTouched",
    defaultValues: { firstName: "", lastName: "", email: "", institution: "", message: "", requestedUsername:"" },
  })

  function onSubmit(values: AccessRequestFormValues) {
    if (request.isPending) return
    request.mutate(values)
  }

  return (
    <AuthLayout title="Solicitar acceso" description="Completa tus datos para solicitar acceso a la plataforma." wide>
      <form className="auth-form" noValidate onSubmit={(event) => { void handleSubmit(onSubmit)(event) }} aria-describedby="auth-description" aria-busy={request.isPending}>
        <FieldGroup className="auth-request-fields">
          <Field data-invalid={!!errors.firstName}>
            <FieldLabel htmlFor="request-name" data-required="true"><span id="request-name-label">Nombres</span></FieldLabel>
            <Input
              id="request-name"
              autoComplete="given-name"
              placeholder="Ej. Juan Carlos"
              required
              aria-labelledby="request-name-label"
              aria-invalid={!!errors.firstName}
              aria-describedby={errors.firstName ? "request-name-error" : undefined}
              {...register("firstName")}
            />
            <FieldError id="request-name-error" errors={errors.firstName ? [errors.firstName] : undefined} />
          </Field>
          <Field data-invalid={!!errors.lastName}>
            <FieldLabel htmlFor="request-last-name" data-required="true"><span id="request-last-name-label">Apellidos</span></FieldLabel>
            <Input id="request-last-name" autoComplete="family-name" placeholder="Ej. Pérez López" required
              aria-labelledby="request-last-name-label" aria-invalid={!!errors.lastName} aria-describedby={errors.lastName ? "request-last-name-error" : undefined} {...register("lastName")} />
            <FieldError id="request-last-name-error" errors={errors.lastName ? [errors.lastName] : undefined} />
          </Field>
          <Field data-invalid={Boolean(errors.requestedUsername)} className="auth-field-full"><FieldLabel htmlFor="requested-username">Nombre de usuario solicitado</FieldLabel><Input id="requested-username" placeholder="Ej. jperez" autoComplete="username" {...register("requestedUsername")} aria-invalid={Boolean(errors.requestedUsername)}/><FieldError>{errors.requestedUsername?.message}</FieldError><p className="auth-optional">Propuesta para revisión administrativa. Se conserva localmente; no reserva un identificador en el servidor.</p></Field>
          <Field data-invalid={!!errors.email} className="auth-field-full">
            <FieldLabel htmlFor="request-email" data-required="true"><span id="request-email-label">Correo electrónico</span></FieldLabel>
            <Input
              id="request-email"
              type="email"
              autoComplete="email"
              placeholder="nombre@correo.com"
              required
              aria-labelledby="request-email-label"
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? "request-email-error" : undefined}
              {...register("email")}
            />
            <FieldError id="request-email-error" errors={errors.email ? [errors.email] : undefined} />
          </Field>
          <Field className="auth-field-full">
            <FieldLabel htmlFor="request-institution">Nombre de la clínica o institución <span className="auth-optional">(opcional)</span></FieldLabel>
            <Input
              id="request-institution"
              autoComplete="organization"
              placeholder="Nombre de tu institución"
              {...register("institution")}
            />
          </Field>
          <Field className="auth-field-full">
            <FieldLabel htmlFor="request-message">Mensaje adicional <span className="auth-optional">(opcional)</span></FieldLabel>
            <Textarea id="request-message" rows={3} placeholder="Cuéntanos brevemente para qué necesitas acceso" {...register("message")} />
          </Field>
        </FieldGroup>
        {request.isSuccess && (
          <AuthNotice id="auth-result">{demo?"Solicitud pendiente en la demostración local. No se creó una cuenta ni se envió un correo.":"Recibimos tu solicitud. El administrador de la clínica la revisará."}</AuthNotice>
        )}
        {request.isError && <AuthNotice id="auth-result" error>{getErrorMessage(request.error)}</AuthNotice>}
        <Button type="submit" className="auth-submit" disabled={request.isPending || request.isSuccess}>
          {request.isPending && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
          {request.isPending ? "Enviando..." : "Enviar solicitud"}
        </Button>
        <p className="auth-navigation">
          ¿Ya tienes acceso?{" "}
          <Link className="auth-link" to="/login" state={location.state}>Iniciar sesión</Link>
        </p>
      </form>
    </AuthLayout>
  )
}
