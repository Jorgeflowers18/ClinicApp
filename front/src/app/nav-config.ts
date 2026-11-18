import {
  ChartNoAxesCombined,
  Bell,
  CalendarDays,
  Wallet,
  ClipboardList,
  LayoutDashboard,
  Package,
  Stethoscope,
  UsersRound,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

import type { Role } from "@/modules/auth/types/auth.types"

export interface NavItem {
  label: string
  to: string
  icon: LucideIcon
  roles?: Role[]
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
    label: "Notificaciones",
    to: "/notificaciones",
    icon: Bell,
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
]
