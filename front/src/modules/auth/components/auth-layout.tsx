import { useEffect, useRef, type ReactNode } from "react"
import { Info, LockKeyhole, Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { readInstitutionProfile } from "@/modules/institution/types/institution.types"
import { InstitutionLogo } from "@/shared/components/brand-logo"

import "../auth.css"

export function AuthLayout({ title, description, children }: {
  title: string
  description: string
  children: ReactNode
}) {
  const institution = readInstitutionProfile()
  const { resolvedTheme, setTheme } = useTheme()
  const isDark = resolvedTheme === "dark"
  const heading = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    const previousTitle = document.title
    document.title = `${title} · ClinicApp Odontología`
    heading.current?.focus({ preventScroll: true })
    return () => { document.title = previousTitle }
  }, [title])

  return (
    <div className="auth-shell">
      <div className="auth-toolbar">
        <div className="auth-theme-switch" role="group" aria-label="Tema de la aplicación">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Tema claro"
            aria-pressed={!isDark}
            title="Tema claro"
            onClick={() => setTheme("light")}
          >
            <Sun aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Tema oscuro"
            aria-pressed={isDark}
            title="Tema oscuro"
            onClick={() => setTheme("dark")}
          >
            <Moon aria-hidden="true" />
          </Button>
        </div>
      </div>

      <main className="auth-main" aria-labelledby="auth-title">
        <header className="auth-brand">
          <InstitutionLogo image={institution.logoImage} text={institution.logoText} className="auth-brand-mark" imageClassName="auth-brand-logo" />
          <h1>{institution.name}</h1>
          <p>Gestión clínica en un solo lugar</p>
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

export function AuthUnavailableAction({ label, explanation }: { label: string; explanation: string }) {
  return (
    <div className="auth-unavailable-action">
      <p id="auth-unavailable" className="auth-notice">
        <Info size={16} aria-hidden="true" />
        <span>{explanation}</span>
      </p>
      <Button type="submit" className="auth-submit" disabled aria-describedby="auth-unavailable">
        {label}
      </Button>
    </div>
  )
}
