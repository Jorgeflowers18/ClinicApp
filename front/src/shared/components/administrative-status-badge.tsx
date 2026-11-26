import { Badge } from "@/components/ui/badge"
import { administrativeStatus, type AccountState, type AdministrativeStatusKind, type ProfessionalState } from "@/shared/lib/administrative-status"
import styles from "./administrative-status-badge.module.css"

/** The same semantic presentation in tables, dialogs and portalled filter options. */
export function AdministrativeStatusBadge({ kind, state, appearance = "badge", label }: {
  kind: AdministrativeStatusKind
  state: string
  appearance?: "badge" | "label"
  label?: string
}) {
  const status = administrativeStatus(kind, state)
  const attributes = { "data-status-kind": kind, "data-status": state, "data-tone": status?.tone ?? "muted" }
  const text = label ?? status?.label ?? state
  return appearance === "label"
    ? <span className={styles.label} {...attributes}>{text}</span>
    : <Badge variant="outline" className={styles.badge} {...attributes}>{text}</Badge>
}

export function AccountStatusBadge({ state }: { state: AccountState }) {
  return <AdministrativeStatusBadge kind="account" state={state} />
}
export function ProfessionalStatusBadge({ state }: { state: ProfessionalState }) {
  return <AdministrativeStatusBadge kind="professional" state={state} />
}
