import type { ManagedUser } from "@/modules/auth/types/user-admin.types"
import type { Professional } from "@/modules/appointments/types/appointment.types"
export type ServerPerson = { id: string; name: string; user: ManagedUser | null; professional: Professional | null }
/** Join by stable links; names/emails never decide whether two records are the same person. */
export function unifiedServerPeople(users: ManagedUser[], professionals: Professional[]): ServerPerson[] {
  const linked = new Set<string>()
  const people = users.map(user => {
    const professional = professionals.find(item => item.id === user.professionalId || item.userId === user.id) ?? null
    if (professional) linked.add(professional.id)
    return { id: user.id, name: user.name, user, professional }
  })
  return [...people, ...professionals.filter(item => !linked.has(item.id)).map(professional => ({ id: "professional:" + professional.id, name: professional.name, user: null, professional }))]
}
