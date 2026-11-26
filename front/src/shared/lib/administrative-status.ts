/** Presentation only. Account access and clinical availability remain independent. */
export const administrativeStatuses = {
  account: {
    active: { label: "Activa", tone: "success" },
    inactive: { label: "Inactiva", tone: "muted" },
    blocked: { label: "Bloqueada", tone: "danger" },
    pending: { label: "Pendiente de activación", tone: "warning" },
  },
  professional: {
    ACTIVE: { label: "Activo", tone: "success" },
    INACTIVE: { label: "Inactivo", tone: "muted" },
    VACATION: { label: "Vacaciones", tone: "vacation" },
    LEAVE: { label: "Permiso/Licencia", tone: "warning" },
    RETIRED: { label: "Retirado", tone: "retired" },
  },
  room: {
    active: { label: "Activo", tone: "success" },
    inactive: { label: "Inactivo", tone: "muted" },
  },
  specialty: {
    active: { label: "Activa", tone: "success" },
    inactive: { label: "Inactiva", tone: "muted" },
  },
  activation: {
    invitation: { label: "Invitación pendiente", tone: "warning" },
    temporary: { label: "Contraseña temporal · cambio obligatorio", tone: "warning" },
    active: { label: "Cuenta activa", tone: "success" },
  },
} as const

export type AdministrativeStatusKind = keyof typeof administrativeStatuses
export type AccountState = keyof typeof administrativeStatuses.account
export type ProfessionalState = keyof typeof administrativeStatuses.professional

export function administrativeStatus(kind: AdministrativeStatusKind, state: string) {
  const catalog: Readonly<Record<string, { label: string; tone: string }>> = administrativeStatuses[kind]
  return Object.hasOwn(catalog, state) ? catalog[state] : undefined
}

export function administrativeStatusLabels<K extends AdministrativeStatusKind>(kind: K) {
  return Object.fromEntries(Object.entries(administrativeStatuses[kind]).map(([state, item]) => [state, item.label])) as {
    [S in keyof typeof administrativeStatuses[K]]: string
  }
}

export const accountStates = administrativeStatusLabels("account")
export const professionalStates = administrativeStatusLabels("professional")
export const activationLabels = administrativeStatusLabels("activation")
