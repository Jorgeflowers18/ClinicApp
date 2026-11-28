import { zodResolver } from "@hookform/resolvers/zod"
import { ArrowLeft, LoaderCircle } from "lucide-react"
import { useState } from "react"
import { useValidatedForm as useForm } from "@/shared/hooks/use-validated-form"
import { Link, useNavigate, useSearchParams } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { PasswordInput } from "@/components/ui/password-input"
import { getErrorMessage } from "@/shared/lib/error-message"
import { ApiError } from "@/shared/types/common"

import { usePasswordReset } from "../api/auth.queries"
import { AuthLayout, AuthNotice } from "../components/auth-layout"
import { passwordResetSchema, type PasswordResetFormValues } from "../types/auth.types"
import { useDemoContext } from "@/modules/saas/state"
import { identityService } from "@/modules/saas/services"

/** Destino del enlace del correo de recuperación: `{Auth:FrontendBaseUrl}/restablecer-contrasena?token=…`. */
export function ResetPasswordPage({demoPurpose}:{demoPurpose?:"first-login"|"profile"}) {
  const [params] = useSearchParams()
  const token = params.get("token")?.trim() ?? ""
  const demo=Boolean(demoPurpose)||params.get("demo")==="1",[done,setDone]=useState(false),[demoError,setDemoError]=useState("")
  const navigate = useNavigate()
  const reset = usePasswordReset()
  const { register, handleSubmit, formState: { errors } } = useForm<PasswordResetFormValues>({
    resolver: zodResolver(passwordResetSchema),
    mode: "onTouched",
    defaultValues: { password: "", confirmation: "" },
  })

  async function onSubmit({ password }: PasswordResetFormValues) {
    if(demo){setDemoError("");try{if(demoPurpose==="first-login")await identityService.completeDemoActivation(useDemoContext.getState().userId??"");setDone(true)}catch(error){setDemoError(getErrorMessage(error))}return}
    if (reset.isPending) return
    reset.mutate({ token, password }, {
      onSuccess: () => navigate("/login", { replace: true, state: { passwordReset: true } }),
    })
  }

  // Un 400 aquí es el enlace (vencido, ya usado o inválido), no la contraseña: esa la valida el formulario.
  const linkInvalid = !demo&&(!token || (reset.error instanceof ApiError && reset.error.status === 400 && !reset.error.fieldErrors?.some((issue) => /password/i.test(issue.field))))

  return (
    <AuthLayout title={demoPurpose==="first-login"?"Configura tu contraseña personal":"Restablecer contraseña"} description={demoPurpose==="first-login"?"Por seguridad, debes cambiar tu contraseña temporal antes de continuar.":"Elige una contraseña nueva para tu cuenta."}>
      {demo&&<AuthNotice>Demostración frontend. No se guarda la contraseña, no se crea un token real ni se cambia el acceso en el servidor.</AuthNotice>}
      {done?<div className="auth-form"><AuthNotice>Recorrido de demostración completado. No se modificó ninguna contraseña real.</AuthNotice><Button onClick={()=>navigate(useDemoContext.getState().userId?"/perfil-usuario":"/login?demo=1")}>Continuar</Button></div>:linkInvalid ? (
        <div className="auth-form">
          <AuthNotice error>El enlace no es válido o ya expiró. Solicita uno nuevo desde «Recuperar contraseña».</AuthNotice>
          <Button className="auth-submit" nativeButton={false} render={<Link to="/recuperar-contrasena" />}>Solicitar uno nuevo</Button>
        </div>
      ) : (
        <form className="auth-form" noValidate onSubmit={(event) => { void handleSubmit(onSubmit)(event) }} aria-describedby="auth-description" aria-busy={reset.isPending}>
          <FieldGroup>
            <Field data-invalid={!!errors.password}>
              <FieldLabel htmlFor="reset-password">Contraseña nueva</FieldLabel>
              <PasswordInput id="reset-password" autoComplete="new-password" required
                aria-invalid={!!errors.password} aria-describedby={errors.password ? "reset-password-error" : "reset-password-hint"} {...register("password")} />
              {errors.password
                ? <FieldError id="reset-password-error" errors={[errors.password]} />
                : <p id="reset-password-hint" className="auth-optional">De 8 a 128 caracteres.</p>}
            </Field>
            <Field data-invalid={!!errors.confirmation}>
              <FieldLabel htmlFor="reset-confirmation">Repite la contraseña</FieldLabel>
              <PasswordInput id="reset-confirmation" autoComplete="new-password" required
                aria-invalid={!!errors.confirmation} aria-describedby={errors.confirmation ? "reset-confirmation-error" : undefined} {...register("confirmation")} />
              <FieldError id="reset-confirmation-error" errors={errors.confirmation ? [errors.confirmation] : undefined} />
            </Field>
          </FieldGroup>
          {demoError&&<AuthNotice error>{demoError}</AuthNotice>}
          {reset.isError && <AuthNotice error>{getErrorMessage(reset.error)}</AuthNotice>}
          <Button type="submit" className="auth-submit" disabled={reset.isPending}>
            {reset.isPending && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
            {reset.isPending ? "Guardando..." : "Guardar contraseña"}
          </Button>
        </form>
      )}
      <p className="auth-navigation">
        <Link className="auth-link" to="/login">
          <ArrowLeft size={14} aria-hidden="true" />
          Volver a iniciar sesión
        </Link>
      </p>
    </AuthLayout>
  )
}
