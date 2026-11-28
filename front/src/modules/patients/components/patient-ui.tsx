import type { ComponentProps, ReactNode } from "react"
import { Check, ChevronDown, type LucideIcon } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { SectionNavigationTabs } from "@/shared/components/section-navigation"
import { Accordion } from "@base-ui/react/accordion"

export function PatientSectionCard({ title, icon: Icon, action, children, className = "" }: { title: string; icon: LucideIcon; action?: ReactNode; children: ReactNode; className?: string }) {
  return <Card className={`patient-information-card ${className}`}><CardHeader className="patient-section-card-heading"><CardTitle><h2><Icon aria-hidden="true" />{title}</h2></CardTitle>{action}</CardHeader><CardContent>{children}</CardContent></Card>
}

export function PatientEmptyState({ icon: Icon, title, description, action }: { icon: LucideIcon; title: string; description: string; action?: ReactNode }) {
  return <div className="patient-empty" role="status"><Icon aria-hidden="true" /><p>{title}</p><span>{description}</span>{action}</div>
}

export function PatientFormSection({ id, title, icon: Icon, status, children, hasErrors }: { id: string; title: string; icon: LucideIcon; status: string; children: ReactNode; hasErrors?: boolean }) {
  return <Accordion.Item className="patient-form-section" id={id} value={id}>
    <Accordion.Header className="patient-section-heading"><Accordion.Trigger className="patient-section-trigger" data-patient-section-trigger="" aria-describedby={hasErrors ? `${id}-errors` : undefined}>
      <Icon aria-hidden="true" /><span>{title}</span><small id={hasErrors ? `${id}-errors` : undefined} data-errors={hasErrors || undefined} data-complete={!hasErrors && status === "Completa" || undefined}>{!hasErrors && status === "Completa" && <Check aria-hidden="true" />}{hasErrors ? "Revisar" : status}</small><ChevronDown aria-hidden="true" className="patient-section-chevron" />
    </Accordion.Trigger></Accordion.Header>
    <Accordion.Panel className="patient-section-panel" keepMounted render={(props, state) => <div {...props} inert={!state.open} aria-hidden={!state.open || undefined} />}><div className="patient-section-fields">{children}</div></Accordion.Panel>
  </Accordion.Item>
}

export function PatientTabs(props: ComponentProps<typeof SectionNavigationTabs>) {
  return <SectionNavigationTabs {...props} className={`patient-detail-tabs ${props.className ?? ""}`} />
}

export function PatientStateBadge({ status, children }: { status: string; children: ReactNode }) {
  const tone = ["activo", "completada", "completado", "pagada", "registrado", "autorizada", "al_dia", "otorgado", "aceptado"].includes(status) ? "success"
    : ["pendiente", "parcial", "borrador"].includes(status) ? "warning"
    : ["vencida", "cancelada", "anulado", "anulada", "reversado", "no_asistio", "rechazado"].includes(status) ? "danger"
    : ["programada", "confirmada", "en_progreso", "emitida"].includes(status) ? "info" : "neutral"
  return <span className="patient-state-badge" data-tone={tone}>{children}</span>
}
