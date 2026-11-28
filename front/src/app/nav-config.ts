import {
  ChartNoAxesCombined,
  MessagesSquare,
  CalendarDays,
  Wallet,
  ClipboardList,
  LayoutDashboard,
  Package,
  Stethoscope,
  UsersRound,
  UserRoundCog,
  Building2,
  Settings2,
  ShieldCheck,
  Inbox,
  DoorOpen,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

import type { Role } from "@/modules/auth/types/auth.types"

export interface NavItem {
  label: string
  to: string
  icon: LucideIcon
  roles?: Role[]
  module?: string
  placement?: "profile"
}

export const navItems: NavItem[] = [
  { label: "Panel", to: "/", icon: LayoutDashboard },
  { label: "Pacientes", to: "/pacientes", icon: UsersRound },
  { label: "Citas", to: "/citas", icon: CalendarDays },
  {
    label: "Historial clínico",
    to: "/historial-clinico",
    icon: ClipboardList,
    roles: ["admin", "medico"],
  },
  { label: "Tratamientos", to: "/tratamientos", icon: Stethoscope },
  {
    label: "Inventario",
    to: "/inventario",
    icon: Package,
    roles: ["admin", "recepcion"],
  },
  {
    label: "Mensajería",
    to: "/notificaciones",
    icon: MessagesSquare,
    roles: ["admin", "recepcion"],
  },
  {
    label: "Finanzas",
    to: "/finanzas",
    icon: Wallet,
    roles: ["admin", "recepcion"],
  },
  {
    label: "Reportes",
    to: "/reportes",
    icon: ChartNoAxesCombined,
    roles: ["admin"],
  },
  { label: "Usuarios y profesionales", to: "/accesos", icon: UserRoundCog, roles: ["admin"], module: "Personal y accesos" },
  { label: "Roles", to: "/accesos/roles", icon: ShieldCheck, roles: ["admin"], module: "Personal y accesos" },
  { label: "Solicitudes de acceso", to: "/accesos/solicitudes", icon: Inbox, roles: ["admin"], module: "Personal y accesos" },
  { label: "Sedes", to: "/administracion/sedes", icon: Building2, roles: ["admin"], module: "Administración", placement: "profile" },
  { label: "Consultorios", to: "/administracion/consultorios", icon: DoorOpen, roles: ["admin"], module: "Administración", placement: "profile" },
  { label: "Especialidades", to: "/administracion/especialidades", icon: Stethoscope, roles: ["admin"], module: "Administración", placement: "profile" },
  { label: "Tipos de profesionales", to: "/administracion/tipos-profesionales", icon: Settings2, roles: ["admin"], module: "Administración", placement: "profile" },
]

/** The permission catalog is derived from actual navigation, including the existing profile menu. */
export const navigationSections = [...new Map([
  ...navItems.map(item => [item.module ?? (item.to === "/historial-clinico" ? "Historia clínica" : item.label), { id: item.module ?? (item.to === "/historial-clinico" ? "Historia clínica" : item.label), label: item.module === "Personal y accesos" ? "Accesos" : item.module ?? item.label }] as const),
  ["Perfil institucional", { id: "Perfil institucional", label: "Perfil institucional" }] as const,
]).values()]
