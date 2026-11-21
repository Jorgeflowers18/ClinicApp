import { zodResolver } from "@hookform/resolvers/zod"
import { ArrowLeft, LoaderCircle } from "lucide-react"
import { useForm } from "react-hook-form"
import { Link, useLocation } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { getErrorMessage } from "@/shared/lib/error-message"

import { usePasswordRecovery } from "../api/auth.queries"
import { AuthLayout, AuthNotice } from "../components/auth-layout"
import { recoverySchema, type RecoveryFormValues } from "../types/access-form.types"

export function RecoverPasswordPage() {
  const location = useLocation()
  const recovery = usePasswordRecovery()
  const { register, handleSubmit, formState: { errors } } = useForm<RecoveryFormValues>({
    resolver: zodResolver(recoverySchema),
    mode: "onTouched",
    defaultValues: { email: "" },
  })

  function onSubmit(values: RecoveryFormValues) {
    if (recovery.isPending) return
    recovery.mutate(values.email)
  }

  return (
    <AuthLayout title="Recuperar contraseña" description="Ingresa tu correo para recuperar el acceso a tu cuenta.">
      <form className="auth-form" noValidate onSubmit={(event) => { void handleSubmit(onSubmit)(event) }} aria-describedby="auth-description" aria-busy={recovery.isPending}>
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
        {/* El servidor responde igual exista o no el correo: el mensaje tampoco lo revela. */}
        {recovery.isSuccess && (
          <AuthNotice id="auth-result">Si el correo está registrado, te enviamos un enlace para restablecer la contraseña. Revisa tu bandeja de entrada.</AuthNotice>
        )}
        {recovery.isError && <AuthNotice id="auth-result" error>{getErrorMessage(recovery.error)}</AuthNotice>}
        <Button type="submit" className="auth-submit" disabled={recovery.isPending}>
          {recovery.isPending && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
          {recovery.isPending ? "Enviando..." : "Enviar instrucciones"}
        </Button>
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
