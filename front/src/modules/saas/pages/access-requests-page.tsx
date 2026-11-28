import { useState } from "react"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/shared/components/page-header"
import { DataTable } from "@/shared/components/data-table"
import { SearchInput } from "@/shared/components/search-input"
import { Badge } from "@/components/ui/badge"
import { AdministrativeStatusBadge } from "@/shared/components/administrative-status-badge"
import { Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription,DialogBody,DialogFooter } from "@/components/ui/dialog"
import { useUsers } from "@/modules/auth/api/users.queries"
import { useProfessionals } from "@/modules/appointments/api/appointments.queries"
import { PasswordLinkDialog } from "@/modules/auth/components/password-link-dialog"
import type { PasswordLink } from "@/modules/auth/types/user-admin.types"
import { getErrorMessage } from "@/shared/lib/error-message"
import { useDemoContext,useSaasData } from "../state"
import { useStaffInstitution } from "../lib/institution-scope"
import { unifiedServerPeople } from "../lib/server-people"
import { nameOf } from "../lib/identity"
import { catalogService } from "../catalog-services"
import { SaasSelect } from "../components/controls"
import { AccountAccessDialog } from "../components/account-access-dialog"
import styles from "../components/administrative-ui.module.css"
const labels={pending:"Pendiente",reviewed:"Revisada",approved:"Aprobada",created:"Cuenta vinculada",rejected:"Rechazada"}
export function AccessRequestsPage(){
 const demo=Boolean(useDemoContext(state=>state.userId)),data=useSaasData(),{organizationId}=useStaffInstitution(),users=useUsers({enabled:!demo}),professionals=useProfessionals({enabled:!demo})
 const [search,setSearch]=useState(""),[review,setReview]=useState<string|null>(null),[target,setTarget]=useState("new"),[creating,setCreating]=useState<string|null>(null),[error,setError]=useState(""),[busy,setBusy]=useState(false),[link,setLink]=useState<{name:string;link:PasswordLink}|null>(null)
 const requests=data.requests.filter(item=>item.organizationId===organizationId),people=demo?data.users.filter(item=>item.organizationIds.includes(organizationId)).map(item=>({id:item.id,name:nameOf(item),email:item.email})):unifiedServerPeople(users.data??[],professionals.data??[]).map(item=>({id:item.id,name:item.name,email:item.user?.email??""}))
 const current=requests.find(item=>item.id===review),accountRequest=requests.find(item=>item.id===creating)
 function openReview(id:string){const request=requests.find(item=>item.id===id)!;const match=people.filter(item=>item.email&&item.email.trim().toLowerCase()===request.email.trim().toLowerCase());setTarget(request.personId??(match.length===1?match[0].id:"new"));setError("");setReview(id)}
 async function action(kind:"reviewed"|"approved"|"rejected"){
 if(!current||busy)return
 setBusy(true);setError("")
 try{await catalogService.reviewRequest(current.id,kind,target==="new"?undefined:target);setReview(null);if(kind==="approved")setCreating(current.id)}catch(cause){setError(getErrorMessage(cause))}finally{setBusy(false)}
 }
 const selected=accountRequest?.userId??accountRequest?.personId
 const member=demo?data.users.find(item=>item.id===selected):undefined,user=!demo?users.data?.find(item=>item.id===selected):undefined,professional=!demo?professionals.data?.find(item=>("professional:"+item.id===selected)||item.id===user?.professionalId):undefined
 return <div className="saas-scope saas-stack"><PageHeader title="Solicitudes de acceso" description="Revisa las solicitudes y vincula cada acceso con su identidad."/><p className="saas-hint">Se muestran las solicitudes de esta institución guardadas en este navegador. La consulta y aprobación global del servidor requieren integración posterior.</p>
 <SearchInput value={search} onChange={setSearch} ariaLabel="Buscar solicitudes" placeholder="Buscar por solicitante, usuario o correo"/>
 <DataTable tableBreakpoint="wide" className={`${styles.table} ${styles.requests}`} data={requests.filter(item=>[nameOf(item),item.username,item.email].join(" ").toLocaleLowerCase("es").includes(search.trim().toLocaleLowerCase("es")))} getRowId={item=>item.id} mobileTitleKey="name" columns={[
 {key:"name",header:"Solicitante",cell:item=>nameOf(item)},{key:"username",header:"Usuario propuesto",cell:item=>item.username||"—"},{key:"email",header:"Correo",cell:item=>item.email},{key:"date",header:"Fecha",cell:item=>item.createdAt?new Date(item.createdAt).toLocaleDateString("es-EC"):"Sin fecha registrada"},
 {key:"state",header:"Estado",cell:item=><AdministrativeStatusBadge kind="request" state={item.state}/>},
 {key:"actions",header:"",cell:item=><div className="staff-specialty-actions"><Button variant="outline" size="sm" onClick={()=>openReview(item.id)}>Revisar</Button>{["approved","created"].includes(item.state)&&<Button size="sm" variant="outline" onClick={()=>setCreating(item.id)}>{item.state==="created"?"Gestionar acceso":"Crear o vincular cuenta"}</Button>}</div>},
 ]}/>
 {current&&<Dialog open onOpenChange={open=>!open&&!busy&&setReview(null)}><DialogContent variant="medium" className="saas-scope"><DialogHeader><DialogTitle>Revisar solicitud</DialogTitle><DialogDescription>{nameOf(current)} · {current.email}</DialogDescription></DialogHeader><DialogBody className="saas-stack"><p>Usuario propuesto: {current.username||"Por asignar"}</p><Badge variant="outline">{labels[current.state]}</Badge><SaasSelect label="Vincular con persona" value={target} disabled={current.state==="created"} onChange={setTarget} items={{new:"Nueva identidad",...Object.fromEntries(people.map(item=>[item.id,item.name+" · "+(item.email||"Sin cuenta")]))}}/><p className="saas-hint">Comprueba la identidad antes de aprobar. Los nombres coincidentes no se fusionan automáticamente.</p>{error&&<p role="alert" className="text-destructive">{error}</p>}</DialogBody><DialogFooter><Button variant="outline" disabled={busy} onClick={()=>setReview(null)}>Cerrar</Button>{current.state!=="created"&&<><Button variant="outline" disabled={busy} onClick={()=>void action("rejected")}>Rechazar</Button>{current.state==="rejected"?<Button disabled={busy} onClick={()=>void action("reviewed")}>Volver a revisar</Button>:<Button disabled={busy} onClick={()=>void action("approved")}>Aprobar</Button>}</>}</DialogFooter></DialogContent></Dialog>}
 {accountRequest&&<AccountAccessDialog demo={demo} member={member} user={user} professional={professional} request={accountRequest} onClose={()=>setCreating(null)} onPasswordLink={setLink}/>}
 <PasswordLinkDialog value={link} onClose={()=>setLink(null)}/>
 </div>
}
