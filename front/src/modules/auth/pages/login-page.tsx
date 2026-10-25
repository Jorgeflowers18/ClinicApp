import { useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { Link, Navigate, useLocation } from "react-router-dom"
import { Eye, EyeOff, LoaderCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { getErrorMessage } from "@/shared/lib/error-message"

import { useLogin } from "../api/auth.queries"
import { AuthLayout } from "../components/auth-layout"
import { useAuthStore } from "../store/auth-store"
import { loginSchema, type LoginFormValues } from "../types/auth.types"

export function LoginPage() {
  const user = useAuthStore((state) => state.user)
  const location = useLocation()
  const login = useLogin()
  const [showPassword, setShowPassword] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  })

  if (user) {
    const redirectTo = (location.state as { from?: string } | null)?.from ?? "/"
    const nextTarget = user.profile && user.profile.fullName.trim() ? redirectTo : "/perfil-usuario"
    return <Navigate to={nextTarget} replace />
  }

  function onSubmit(values: LoginFormValues) {
    login.mutate(values)
  }

  return (
    <AuthLayout title="Iniciar sesión" description="Accede a tu espacio de gestión clínica.">
      <form className="auth-form" noValidate onSubmit={handleSubmit(onSubmit)} aria-describedby="auth-description" aria-busy={login.isPending}>
        <FieldGroup>
          <Field data-invalid={!!errors.email}>
            <FieldLabel htmlFor="email">Correo electrónico</FieldLabel>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="tu@clinica.com"
              required
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? "email-error" : undefined}
              {...register("email")}
            />
            <FieldError id="email-error" errors={errors.email ? [errors.email] : undefined} />
          </Field>

          <Field data-invalid={!!errors.password}>
            <FieldLabel htmlFor="password">Contraseña</FieldLabel>
            <div className="auth-password">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="••••••••"
                required
                aria-invalid={!!errors.password}
                aria-describedby={errors.password ? "password-error" : undefined}
                {...register("password")}
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="auth-password-toggle"
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                aria-pressed={showPassword}
                aria-controls="password"
              >
                {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
              </button>
            </div>
            <FieldError id="password-error" errors={errors.password ? [errors.password] : undefined} />
          </Field>
        </FieldGroup>

        <div className="auth-options">
          <div className="auth-remember">
            <Checkbox id="remember" disabled checked={false} aria-describedby="remember-status" />
            <FieldLabel htmlFor="remember">Recordarme</FieldLabel>
          </div>
          <Link className="auth-link" to="/recuperar-contrasena" state={location.state}>¿Olvidaste tu contraseña?</Link>
        </div>
        <p id="remember-status" className="auth-remember-help">Recordarme aún no está disponible.</p>

        {login.isError && (
          <p role="alert" className="text-sm text-destructive">{getErrorMessage(login.error)}</p>
        )}

        <Button type="submit" className="auth-submit" disabled={login.isPending}>
          {login.isPending && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
          {login.isPending ? "Ingresando..." : "Ingresar"}
        </Button>

        <p className="auth-navigation">
          ¿No tienes acceso?{" "}
          <Link className="auth-link" to="/solicitar-acceso" state={location.state}>Solicitar acceso</Link>
        </p>
      </form>
    </AuthLayout>
  )
}
