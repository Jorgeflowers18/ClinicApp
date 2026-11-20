import { zodResolver } from "@hookform/resolvers/zod"
import { ArrowLeft } from "lucide-react"
import { useForm } from "react-hook-form"
import { Link, useLocation } from "react-router-dom"

import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

import { AuthLayout, AuthUnavailableAction } from "../components/auth-layout"
import { recoverySchema, type RecoveryFormValues } from "../types/access-form.types"

export function RecoverPasswordPage() {
  const location = useLocation()
  const { register, formState: { errors } } = useForm<RecoveryFormValues>({
    resolver: zodResolver(recoverySchema),
    mode: "onTouched",
    defaultValues: { email: "" },
  })

  return (
    <AuthLayout title="Recuperar contraseña" description="Ingresa tu correo para recuperar el acceso a tu cuenta.">
      <form className="auth-form" noValidate onSubmit={(event) => event.preventDefault()} aria-describedby="auth-description auth-unavailable">
        <FieldGroup>
          <Field data-invalid={!!errors.email}>
            <FieldLabel htmlFor="recovery-email">Correo electrónico</FieldLabel>
            <Input
              id="recovery-email"
              type="email"
              autoComplete="email"
              placeholder="nombre@correo.com"
              required
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? "recovery-email-error" : undefined}
              {...register("email")}
            />
            <FieldError id="recovery-email-error" errors={errors.email ? [errors.email] : undefined} />
          </Field>
        </FieldGroup>
        <AuthUnavailableAction label="Enviar instrucciones" explanation="La recuperación por correo aún no está disponible." />
        <p className="auth-navigation">
          <Link className="auth-link" to="/login" state={location.state}>
            <ArrowLeft size={14} aria-hidden="true" />
            Volver a iniciar sesión
          </Link>
        </p>
      </form>
    </AuthLayout>
  )
}
