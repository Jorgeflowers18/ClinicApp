import { useEffect, useRef, useState, type ReactNode } from "react"
import { CircleAlert, Info, LockKeyhole } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { HeaderThemeSwitch } from "@/app/layout/header-theme-switch"
import { usePublicInstitution } from "@/modules/institution/hooks/use-institution-profile"
import { InstitutionLogo } from "@/shared/components/brand-logo"

import "../auth.css"

export function AuthLayout({ title, description, children, wide = false }: {
  title: string
  description: string
  children: ReactNode
  wide?: boolean
}) {
  const institution = usePublicInstitution()
  const heading = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    const previousTitle = document.title
    document.title = `${title} · ${institution.name}`
    return () => { document.title = previousTitle }
  }, [title, institution.name])

  useEffect(() => { heading.current?.focus({ preventScroll: true }) }, [title])

  return (
    <div className="auth-shell" data-auth-width={wide ? "wide" : "normal"}>
      <div className="auth-toolbar">
        <HeaderThemeSwitch />
      </div>

      <main className="auth-main" aria-labelledby="auth-title">
        <header className="auth-brand">
          <InstitutionLogo image={institution.logoImage} name={institution.name} className="auth-brand-mark" imageClassName="auth-brand-logo" />
          <h1>{institution.name}</h1>
          {institution.subtitle.trim() && <p>{institution.subtitle}</p>}
        </header>

        <Card className="auth-card">
          <CardHeader className="auth-card-header">
            <h2 id="auth-title" ref={heading} tabIndex={-1}>{title}</h2>
            <p id="auth-description">{description}</p>
          </CardHeader>
          <CardContent className="auth-card-content">{children}</CardContent>
        </Card>

        <p className="auth-footer">
          <LockKeyhole size={14} aria-hidden="true" />
          Acceso para personal autorizado
        </p>
      </main>
    </div>
  )
}

export function AuthNotice({ children, error = false, id }: { children: ReactNode; error?: boolean; id?: string }) {
  const Icon = error ? CircleAlert : Info
  return <p id={id} className={"auth-notice" + (error ? " auth-notice-error" : "")} role={error ? "alert" : "note"}>
    <Icon size={16} aria-hidden="true" /><span>{children}</span>
  </p>
}

const rememberHelp = "Sin marcar, la sesión se cierra al cerrar el navegador. Márcalo solo en un equipo personal: la sesión durará 7 días."

export function AuthRememberHelp() {
  const [open, setOpen] = useState(false)
  return <>
    <Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger closeOnClick={false} onClick={() => setOpen(true)} render={
        <Button type="button" variant="ghost" size="icon" className="auth-help" aria-label="Información sobre Recordarme" aria-expanded={open} />
      }><Info size={14} aria-hidden="true" /></TooltipTrigger>
      <TooltipContent className="max-w-72">{rememberHelp}</TooltipContent>
    </Tooltip>
    <span id="remember-status" className="sr-only">{rememberHelp}</span>
  </>
}
