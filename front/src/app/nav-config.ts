import {
  BarChart3,
  Bell,
  Building2,
  CalendarDays,
  CreditCard,
  FileText,
  LayoutDashboard,
  Package,
  Stethoscope,
  Users,
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
  { label: "Pacientes", to: "/pacientes", icon: Users },
  { label: "Citas", to: "/citas", icon: CalendarDays },
  {
    label: "Historial clínico",
    to: "/historial-clinico",
    icon: FileText,
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
    icon: CreditCard,
    roles: ["admin", "recepcion"],
  },
  {
    label: "Perfil institucional",
    to: "/perfil-institucion",
    icon: Building2,
    roles: ["admin"],
  },
  {
    label: "Reportes",
    to: "/reportes",
    icon: BarChart3,
    roles: ["admin"],
  },
]
