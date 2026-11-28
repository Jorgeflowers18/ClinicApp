import { useStaffInstitution } from "@/modules/saas/lib/institution-scope"
import { useDemoContext } from "@/modules/saas/state"
export function BranchHoursHint(){
 const {profile}=useStaffInstitution(),context=useDemoContext()
 const branch=context.userId?profile?.branches.find(item=>item.id===context.siteId):profile?.branches.length===1?profile.branches[0]:undefined
 if(!branch)return null
 return <details className="text-sm text-muted-foreground"><summary className="cursor-pointer">Horario de sede · {branch.name}</summary><p className="whitespace-pre-wrap mt-2">{branch.hours||"Sin horario de atención configurado."}</p><p className="mt-1">La disponibilidad de cada profesional puede ser más limitada que el horario general de la sede.</p></details>
}
