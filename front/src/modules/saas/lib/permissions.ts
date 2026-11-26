import type { Role } from "@/modules/auth/types/auth.types"
import type { SaasData, StaffUser } from "../types"

/** Predefined role capabilities. The clinic administrator assigns roles, never individual grants. */
export function defaultGrant(role: Role, module: string, action: string) {
  if (role === "admin") return true
  if (role === "medico") return ["Pacientes", "Citas", "Historia clínica", "Tratamientos"].includes(module) && ["view", "create", "edit", "export"].includes(action)
  return ["Pacientes", "Citas", "Tratamientos", "Inventario", "Finanzas", "Mensajería"].includes(module) && !["manage", "approve"].includes(action)
}
export function demoCan(user: StaffUser, _data: SaasData, module: string, action: string) {
  return user.roles.some(role => defaultGrant(role, module, action))
}
export function permissionModuleForPath(path: string) {
  const modules: Record<string, string> = {
    pacientes: "Pacientes", citas: "Citas", "historial-clinico": "Historia clínica", tratamientos: "Tratamientos",
    inventario: "Inventario", finanzas: "Finanzas", reportes: "Reportes", notificaciones: "Mensajería", "personal-accesos": "Personal y accesos",
  }
  return modules[path.split("/")[1]] ?? null
}
