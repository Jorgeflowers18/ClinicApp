import { useState } from "react"
import { MoreHorizontal,Plus,UserRound,Pencil,ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu,DropdownMenuTrigger,DropdownMenuContent,DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription,DialogBody,DialogFooter } from "@/components/ui/dialog"
import { PageHeader } from "@/shared/components/page-header"
import { useUsers } from "@/modules/auth/api/users.queries"
import { useProfessionals } from "@/modules/appointments/api/appointments.queries"
import { PasswordLinkDialog } from "@/modules/auth/components/password-link-dialog"
import type { PasswordLink } from "@/modules/auth/types/user-admin.types"
import { getErrorMessage } from "@/shared/lib/error-message"
import { useDemoContext,useSaasData } from "../state"
import { useStaffInstitution } from "../lib/institution-scope"
import { assignedRoles,accessRoles } from "../lib/access-catalogs"
import { serverPersonSettings,serverAccountState,serverProfessionalState } from "../lib/server-person-settings"
import { professionalSpecialtyIds,useSpecialtyCatalog } from "../lib/specialty-catalog"
import { unifiedServerPeople,type ServerPerson } from "../lib/server-people"
import { StaffDirectory } from "../components/staff-directory"
import { ServerProfileDialog } from "../components/server-profile-dialog"
import { AccountAccessDialog } from "../components/account-access-dialog"
import { StaffManagementPage } from "./staff-page"
import "../saas.css"
export function UnifiedAccessPage(){return useDemoContext(state=>state.userId)?<StaffManagementPage/>:<ServerAccessPage/>}
function ServerAccessPage(){
 const users=useUsers(),professionals=useProfessionals(),data=useSaasData(),{organizationId,profile}=useStaffInstitution(),specialties=useSpecialtyCatalog()
 const [editor,setEditor]=useState<{person:ServerPerson|null;mode:"profile"|"access"|"professional"}|null>(null),[details,setDetails]=useState<string|null>(null),[link,setLink]=useState<{name:string;link:PasswordLink}|null>(null)
 const settings=data.serverStaffSettings?.[organizationId]??{},types=(data.professionalTypes??[]).filter(item=>item.organizationId===organizationId),people=unifiedServerPeople(users.data??[],professionals.data??[])
 const rolesFor=(person:ServerPerson)=>assignedRoles({roles:person.user?[person.user.role]:[],accessRoleIds:person.user?settings[person.id]?.accessRoleIds:[]},data,organizationId)
 const entries=people.map(person=>{
  const prefs=serverPersonSettings(data,organizationId,person),roles=rolesFor(person),ids=professionalSpecialtyIds(person.professional,specialties,prefs.specialtyIds)
  return {id:person.id,name:person.name,email:person.user?.email??"",username:prefs.username??data.identities.find(item=>item.id===person.user?.id)?.username??"",registration:person.professional?.registrationNumber??"",typeId:prefs.professionalTypeId??"",typeName:types.find(item=>item.id===prefs.professionalTypeId)?.name??(person.professional?"Por asignar":"No aplica"),specialtyIds:ids,specialtyNames:ids.map(id=>specialties.find(item=>item.id===id)?.name??"Especialidad anterior"),roleIds:roles.map(role=>role.id),roleNames:roles.map(role=>role.name),siteIds:prefs.siteIds??[],siteNames:(prefs.siteIds??[]).map(id=>profile?.branches.find(item=>item.id===id)?.name??"Sede no disponible"),accountState:person.user?serverAccountState(person.user,prefs):undefined,professionalState:person.professional?serverProfessionalState(person.professional.active,prefs):undefined,
  createAccount:<Button size="sm" variant="outline" onClick={()=>setEditor({person,mode:"access"})}>Crear cuenta</Button>,
  actions:<DropdownMenu><DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={"Acciones de "+person.name}/>}><MoreHorizontal/></DropdownMenuTrigger><DropdownMenuContent align="end" className="saas-user-menu"><DropdownMenuItem onClick={()=>setDetails(person.id)}><UserRound/>Ver perfil</DropdownMenuItem><DropdownMenuItem onClick={()=>setEditor({person,mode:"profile"})}><Pencil/>Editar perfil</DropdownMenuItem><DropdownMenuItem onClick={()=>setEditor({person,mode:"access"})}><ShieldCheck/>{person.user?"Gestionar acceso":"Crear cuenta"}</DropdownMenuItem></DropdownMenuContent></DropdownMenu>}
 })
 const detail=entries.find(item=>item.id===details)
 return <div className="saas-scope saas-stack staff-management"><PageHeader title="Usuarios y profesionales" description="Gestiona las cuentas y el personal de tu clínica" actions={<div className="saas-inline"><Button variant="outline" onClick={()=>setEditor({person:null,mode:"professional"})}>Registrar profesional</Button><Button onClick={()=>setEditor({person:null,mode:"access"})}><Plus/>Nuevo usuario</Button></div>}/>
 <StaffDirectory people={entries} roles={accessRoles(data,organizationId)} types={types} specialties={specialties} sites={profile?.branches??[]} loading={users.isPending||professionals.isPending} error={users.isError||professionals.isError?getErrorMessage(users.error??professionals.error):undefined}/>
 {editor&&(editor.mode==="access"?<AccountAccessDialog user={editor.person?.user} professional={editor.person?.professional??undefined} onClose={()=>setEditor(null)} onPasswordLink={setLink}/>:<ServerProfileDialog user={editor.person?.user} professional={editor.person?.professional} createProfessional={editor.mode==="professional"} onClose={()=>setEditor(null)}/>)}
 <PasswordLinkDialog value={link} onClose={()=>setLink(null)}/>
 {detail&&<Dialog open onOpenChange={open=>!open&&setDetails(null)}><DialogContent variant="medium" className="saas-scope"><DialogHeader><DialogTitle>{detail.name}</DialogTitle><DialogDescription>Perfil administrativo</DialogDescription></DialogHeader><DialogBody><dl className="saas-summary">{[["Usuario",detail.accountState?detail.username:"Sin cuenta"],["Correo",detail.email],["Tipo profesional",detail.typeName],["Especialidades",detail.specialtyNames.join(" · ")],["Registro",detail.registration],["Roles",detail.roleNames.join(" · ")],["Sedes",detail.siteNames.join(" · ")]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value||"—"}</dd></div>)}</dl></DialogBody><DialogFooter><Button variant="outline" onClick={()=>setDetails(null)}>Cerrar</Button></DialogFooter></DialogContent></Dialog>}
 </div>
}
