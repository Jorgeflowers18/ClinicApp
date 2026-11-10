import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { Link, useLocation } from "react-router-dom"

import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

import { AuthLayout, AuthUnavailableAction } from "../components/auth-layout"
import { accessRequestSchema, type AccessRequestFormValues } from "../types/access-form.types"

export function RequestAccessPage() {
  const location = useLocation()
  const { register, formState: { errors } } = useForm<AccessRequestFormValues>({
    resolver: zodResolver(accessRequestSchema),
    mode: "onTouched",
    defaultValues: { fullName: "", email: "", institution: "", message: "" },
  })

  return (
    <AuthLayout title="Solicitar acceso" description="Completa tus datos para preparar una solicitud de acceso a ClinicApp Odontología.">
      <form className="auth-form" noValidate onSubmit={(event) => event.preventDefault()} aria-describedby="auth-description auth-unavailable">
        <FieldGroup>
          <Field data-invalid={!!errors.fullName}>
            <FieldLabel htmlFor="request-name">Nombre completo</FieldLabel>
            <Input
              id="request-name"
              autoComplete="name"
              placeholder="Tu nombre y apellido"
              required
              aria-invalid={!!errors.fullName}
              aria-describedby={errors.fullName ? "request-name-error" : undefined}
              {...register("fullName")}
            />
            <FieldError id="request-name-error" errors={errors.fullName ? [errors.fullName] : undefined} />
          </Field>
          <Field data-invalid={!!errors.email}>
            <FieldLabel htmlFor="request-email">Correo electrónico</FieldLabel>
            <Input
              id="request-email"
              type="email"
              autoComplete="email"
              placeholder="tu@clinica.com"
              required
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? "request-email-error" : undefined}
              {...register("email")}
            />
            <FieldError id="request-email-error" errors={errors.email ? [errors.email] : undefined} />
          </Field>
          <Field>
            <FieldLabel htmlFor="request-institution">Nombre de la clínica o institución</FieldLabel>
            <Input
              id="request-institution"
              autoComplete="organization"
              placeholder="Nombre de tu clínica"
              aria-describedby="request-institution-hint"
              {...register("institution")}
            />
            <p id="request-institution-hint" className="auth-optional">Opcional</p>
          </Field>
          <Field>
            <FieldLabel htmlFor="request-message">Mensaje adicional <span className="auth-optional">(opcional)</span></FieldLabel>
            <Textarea id="request-message" rows={3} placeholder="Cuéntanos brevemente para qué necesitas acceso" {...register("message")} />
          </Field>
        </FieldGroup>
        <AuthUnavailableAction label="Enviar solicitud" explanation="El envío de solicitudes estará disponible próximamente." />
        <p className="auth-navigation">
          ¿Ya tienes acceso?{" "}
          <Link className="auth-link" to="/login" state={location.state}>Iniciar sesión</Link>
        </p>
      </form>
    </AuthLayout>
  )
}
