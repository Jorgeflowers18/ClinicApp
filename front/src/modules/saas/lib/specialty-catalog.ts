import type { Professional } from "@/modules/appointments/types/appointment.types"
import { useProfessionals } from "@/modules/appointments/api/appointments.queries"
import { useDemoContext,useSaasData } from "../state"
import { useStaffInstitution } from "./institution-scope"
import { normalizedCatalogName } from "./specialty-policy"
import type { SaasData,Specialty } from "../types"
/** Existing API specialty labels are projected into the same catalog, never guessed from a professional type. */
export function professionalSpecialtyCatalog(data:SaasData,scope:string,professionals:Professional[]):Specialty[]{
 const result=data.specialties.filter(item=>item.organizationId===scope)
 for(const person of professionals){
  const metadata=data.serverStaffSettings?.[scope]?.[person.userId??""]??data.serverStaffSettings?.[scope]?.["professional:"+person.id]
  if(metadata?.specialtyIds?.length)continue
  if(!person.specialty.trim()||result.some(item=>item.id==="legacy-specialty:"+encodeURIComponent(normalizedCatalogName(person.specialty))||normalizedCatalogName(item.name)===normalizedCatalogName(person.specialty)))continue
  result.push({id:"legacy-specialty:"+encodeURIComponent(normalizedCatalogName(person.specialty)),organizationId:scope,name:person.specialty,description:"Especialidad existente en la API; pendiente de clasificar.",active:true})
 }
 return result
}
export function useSpecialtyCatalog(){
 const data=useSaasData(),demo=useDemoContext(state=>state.userId),{organizationId}=useStaffInstitution(),professionals=useProfessionals({enabled:!demo})
 return professionalSpecialtyCatalog(data,organizationId,professionals.data??[])
}
export function professionalSpecialtyIds(professional:Professional|undefined|null,catalog:Specialty[],saved?:string[]){
 return saved??(professional?catalog.filter(item=>item.id==="legacy-specialty:"+encodeURIComponent(normalizedCatalogName(professional.specialty))||normalizedCatalogName(item.name)===normalizedCatalogName(professional.specialty)).map(item=>item.id):[])
}
