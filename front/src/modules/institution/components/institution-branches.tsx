import { useRef,useState } from "react"
import { Building2,MoreHorizontal,Pencil,Plus,Trash2,Power,Star } from "lucide-react"
import { Link } from "react-router-dom"
import { toast } from "sonner"
import { AdministrativeStatusBadge } from "@/shared/components/administrative-status-badge"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card,CardContent,CardHeader,CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { FieldError } from "@/components/ui/field"
import { DropdownMenu,DropdownMenuContent,DropdownMenuItem,DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle } from "@/components/ui/dialog"
import { ConfirmDialog } from "@/shared/components/confirm-dialog"
import { DataTable } from "@/shared/components/data-table"
import { PageHeader } from "@/shared/components/page-header"
import adminStyles from "@/modules/saas/components/administrative-ui.module.css"
import { SearchInput } from "@/shared/components/search-input"
import { ResetFiltersButton } from "@/shared/components/reset-filters-button"
import { getErrorMessage } from "@/shared/lib/error-message"
import { scrollToValidationTarget } from "@/shared/lib/validation-focus"
import { useDemoContext,useSaasData } from "@/modules/saas/state"
import { activeInstitutionScope } from "@/modules/saas/lib/institution-scope"
import { SaasSelect } from "@/modules/saas/components/controls"
import { branchLabel,type InstitutionBranch } from "../types/institution.types"
import { branchDeletionReason,branchHoursErrors,emptyBranchWeek,formatBranchHours,parseBranchHours,type BranchWeek } from "../lib/branch-hours"
import { BranchHoursEditor } from "./branch-hours-editor"
import styles from "./institution-branches.module.css"
type Draft=Pick<InstitutionBranch,"name"|"address"|"phone"|"hours">
type Editor={original:InstitutionBranch|null;draft:Draft;week:BranchWeek;scheduled:boolean}
type Props={standalone?:boolean;branches:InstitutionBranch[];onCommit:(branches:InstitutionBranch[])=>Promise<void>;editorOnly?:boolean;onEditorClose?:()=>void;readOnly?:boolean;states?:Record<string,boolean>;onToggle?:(branch:InstitutionBranch)=>void}
const newEditor=():Editor=>({original:null,draft:{name:"",address:"",phone:"",hours:""},week:emptyBranchWeek(),scheduled:false})
export function InstitutionBranches({branches,onCommit,editorOnly=false,onEditorClose,standalone=false,readOnly=false,states:providedStates,onToggle}:Props){
 const [editor,setEditor]=useState<Editor|null>(editorOnly?newEditor:null),[deleting,setDeleting]=useState<InstitutionBranch|null>(null),[principal,setPrincipal]=useState<InstitutionBranch|null>(null),[error,setError]=useState(""),[issues,setIssues]=useState<Record<string,string>>({}),[hoursErrors,setHoursErrors]=useState<Record<string,string>>({}),[busy,setBusy]=useState(false),[search,setSearch]=useState(""),[state,setState]=useState("all"),[location,setLocation]=useState("all")
 const data=useSaasData(),demo=Boolean(useDemoContext(ctx=>ctx.userId)),scope=activeInstitutionScope(),states=providedStates??data.branchStates?.[scope]??{},lock=useRef(false),createRef=useRef<HTMLButtonElement>(null),returnFocusRef=useRef<HTMLButtonElement|null>(null)
 const returnFocus=()=>returnFocusRef.current?.isConnected?returnFocusRef.current:createRef.current
 const closeEditor=()=>{if(!busy&&(!editor||JSON.stringify(editor)===JSON.stringify(editor.original?{original:editor.original,draft:{name:editor.original.name,address:editor.original.address,phone:editor.original.phone,hours:editor.original.hours},week:parseBranchHours(editor.original.hours)??emptyBranchWeek(),scheduled:Boolean(parseBranchHours(editor.original.hours))}:newEditor())||confirm("¿Descartar los cambios de la sede?"))){setEditor(null);setError("");setIssues({});setHoursErrors({});onEditorClose?.()}}
 function openCreate(trigger:HTMLButtonElement){returnFocusRef.current=trigger;setError("");setIssues({});setHoursErrors({});setEditor(newEditor())}
 function edit(branch:InstitutionBranch,trigger:HTMLButtonElement|null){returnFocusRef.current=trigger;setError("");setIssues({});setHoursErrors({});const week=parseBranchHours(branch.hours);setEditor({original:branch,draft:{name:branch.name,address:branch.address,phone:branch.phone,hours:branch.hours},week:week??emptyBranchWeek(),scheduled:Boolean(week)})}
 const dependency=(branch:InstitutionBranch)=>branchDeletionReason({server:!demo,id:branch.id,branches,assignments:data.users.filter(user=>user.organizationIds.includes(scope)).flatMap(user=>user.assignments.filter(item=>item.organizationId===scope)),operations:(data as typeof data&{operations?:Record<string,unknown>}).operations?.[scope]})
 async function saveBranch(event:React.FormEvent){
 event.preventDefault();if(!editor||lock.current)return
 const found:Record<string,string>={},name=editor.draft.name.trim()
 if(!name)found.name="Ingresa el nombre de la sede."
 else if(branches.some(branch=>branch.id!==editor.original?.id&&branch.name.trim().toLocaleLowerCase("es")===name.toLocaleLowerCase("es")))found.name="Ya existe una sede con ese nombre."
 const scheduleIssues=editor.scheduled?branchHoursErrors(editor.week):{}
 setIssues(found);setHoursErrors(scheduleIssues)
 if(Object.keys(found).length||Object.keys(scheduleIssues).length){requestAnimationFrame(()=>{const target=document.getElementById(found.name?"sede-name":"branch-hours-"+Object.keys(scheduleIssues)[0]+"-0-start")??document.getElementById("branch-day-"+Object.keys(scheduleIssues)[0]);if(target)scrollToValidationTarget(target)});return}
 lock.current=true;setBusy(true);setError("")
 try{
  if(editor.original&&!branches.some(branch=>branch.id===editor.original!.id))throw new Error("Esta sede ya no está disponible. Cierra el formulario y revisa el listado.")
  const draft={...editor.draft,name,hours:editor.scheduled?formatBranchHours(editor.week):editor.draft.hours},next=editor.original?branches.map(branch=>branch.id===editor.original!.id?{...branch,...draft}:branch):[...branches,{...draft,id:"",isMain:branches.length===0}]
  await onCommit(next);setEditor(null);onEditorClose?.();toast.success(editor.original?"Sede actualizada":"Sede creada")
 }catch(cause){setError(getErrorMessage(cause))}finally{lock.current=false;setBusy(false)}
 }
 async function remove(){
 if(!deleting||lock.current)return
 const reason=dependency(deleting);if(reason){setError(reason);return}
 lock.current=true;setBusy(true);setError("")
 try{await onCommit(branches.filter(branch=>branch.id!==deleting.id));setDeleting(null);toast.success("Sede eliminada de la demostración")}catch(cause){setError(getErrorMessage(cause))}finally{lock.current=false;setBusy(false)}
 }
 async function setMain(){
 if(!principal||lock.current)return
 lock.current=true;setBusy(true);setError("")
 try{if(states[principal.id]===false)throw new Error("Activa la sede antes de establecerla como principal.");await onCommit(branches.map(branch=>({...branch,isMain:branch.id===principal.id})));setPrincipal(null);toast.success("Sede principal actualizada")}catch(cause){setError(getErrorMessage(cause))}finally{lock.current=false;setBusy(false)}
 }
 const locations=[...new Set(branches.map(branch=>branch.address.trim()).filter(Boolean))]
 const rows=branches.filter(branch=>branch.name.toLocaleLowerCase("es").includes(search.trim().toLocaleLowerCase("es"))&&(state==="all"||(states[branch.id]!==false)===(state==="active"))&&(location==="all"||branch.address.trim()===location))
 const actions=(branch:InstitutionBranch)=><DropdownMenu><DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={"Acciones de sede "+branchLabel(branch)}/>}><MoreHorizontal/></DropdownMenuTrigger><DropdownMenuContent align="end" className={styles.menu}>
 <DropdownMenuItem onClick={event=>edit(branch,event.currentTarget.closest("[role=menu]")?.querySelector("button")??null)}><Pencil/>Editar sede</DropdownMenuItem>
 {!branch.isMain&&<DropdownMenuItem disabled={states[branch.id]===false} onClick={()=>{setError("");setPrincipal(branch)}}><Star/>Establecer como principal</DropdownMenuItem>}
 {onToggle&&<DropdownMenuItem onClick={()=>onToggle(branch)}><Power/>{states[branch.id]===false?"Activar sede":"Desactivar sede"}</DropdownMenuItem>}
 <DropdownMenuItem variant="destructive" onClick={()=>{setError("");setDeleting(branch)}}><Trash2/>Eliminar sede</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
 const text=(key:"name"|"address"|"phone",label:string)=>editor&&<div className={styles.field}><label htmlFor={"sede-"+key}>{label}</label><Input id={"sede-"+key} placeholder={key==="name"?"Nombre de la sede":key==="address"?"Calle, número y ciudad":"Teléfono de contacto"} value={editor.draft[key]} aria-invalid={Boolean(issues[key])} onChange={event=>{setEditor({...editor,draft:{...editor.draft,[key]:event.target.value}});setIssues(old=>({...old,[key]:""}));setError("")}}/><FieldError>{issues[key]}</FieldError></div>
 return <>{!editorOnly&&<Card className={standalone?styles.standalone:styles.section} data-institution-branches>{standalone?<PageHeader headingLevel={2} title="Sedes" description="Gestiona las ubicaciones y horarios de tu institución." actions={<Button ref={createRef} onClick={event=>openCreate(event.currentTarget)}><Plus/>Nueva sede</Button>}/>:(<CardHeader className={styles.header}><div className={styles.heading}><CardTitle role="heading" aria-level={2}>Sedes <span className={styles.count}>{branches.length}</span></CardTitle><p>Ubicaciones, horarios y estado de tu institución.</p></div>{readOnly?<Button variant="outline" render={<Link to="/administracion/sedes"/>}>Administrar sedes</Button>:branches.length>0&&<Button ref={createRef} variant="outline" onClick={event=>openCreate(event.currentTarget)}><Plus/>Crear sede</Button>}</CardHeader>)}<CardContent className={standalone?styles.standaloneContent:styles.content}>
 {!branches.length?<div className={styles.empty}><Building2/><h3>Todavía no hay sedes registradas.</h3><p>Registra una ubicación con sus datos reales.</p>{!readOnly&&!standalone&&<Button ref={createRef} onClick={event=>openCreate(event.currentTarget)}><Plus/>Crear primera sede</Button>}</div>:<>
 {!readOnly&&<div className="saas-filters"><SearchInput value={search} onChange={setSearch} ariaLabel="Buscar sedes" placeholder="Buscar por nombre de sede"/><SaasSelect label="Estado" value={state} onChange={setState} items={{all:"Todos",active:"Activa",inactive:"Inactiva"}}/>{locations.length>1&&<SaasSelect label="Ubicación" value={location} onChange={setLocation} items={{all:"Todas",...Object.fromEntries(locations.map(address=>[address,address]))}}/>}<ResetFiltersButton disabled={!search&&state==="all"&&location==="all"} onReset={()=>{setSearch("");setState("all");setLocation("all")}}/></div>}
 <div className={styles.catalog}><DataTable className={adminStyles.table} data={readOnly?branches:rows} getRowId={branch=>branch.id} mobileTitleKey="name" columns={[
 {key:"name",header:"Sede",cell:branch=><strong>{branchLabel(branch)}</strong>},{key:"address",header:"Dirección",cell:branch=>branch.address||"Sin dirección"},{key:"phone",header:"Contacto",cell:branch=>branch.phone||"Sin teléfono"},{key:"hours",header:"Horario",cell:branch=>branch.hours.includes("\n")?<details><summary>Ver horario por día</summary><span className={styles.hours}>{branch.hours}</span></details>:<span className={styles.hours}>{branch.hours||"Sin horario configurado"}</span>},{key:"state",header:"Estado",cell:branch=><AdministrativeStatusBadge kind="resource" state={states[branch.id]===false?"inactive":"active"}/>},{key:"principal",header:"Principal",cell:branch=>branch.isMain?<Badge variant="secondary">Principal</Badge>:"—"},...(!readOnly?[{key:"actions",header:"",cell:actions}]:[]),
 ]}/></div></>}
 </CardContent></Card>}
 <Dialog open={Boolean(editor)} onOpenChange={open=>!open&&closeEditor()}><DialogContent variant="medium" className={styles.editor} finalFocus={returnFocus}><DialogHeader className={styles.editorHeader}><DialogTitle>{editor?.original?"Editar sede":"Nueva sede"}</DialogTitle><DialogDescription>Datos y horario general de esta ubicación. Cada profesional conserva su disponibilidad propia.</DialogDescription></DialogHeader>
 {editor&&<form className={styles.editorForm} noValidate onSubmit={event=>void saveBranch(event)} aria-busy={busy}><div className={styles.editorBody}><fieldset className={styles.group}><legend>Información de la sede</legend>{text("name","Nombre de la sede *")}{text("address","Dirección")}{text("phone","Teléfono")}</fieldset>
 <fieldset className={styles.group}><legend>Horario de atención</legend><label className="saas-check"><Checkbox checked={editor.scheduled} onCheckedChange={checked=>setEditor({...editor,scheduled:Boolean(checked)})}/>Configurar horario por día</label>
 {editor.scheduled?<BranchHoursEditor value={editor.week} onChange={week=>{setEditor({...editor,week});setHoursErrors({})}} errors={hoursErrors}/>:<p className={styles.hours}>{editor.draft.hours||"Sin horario configurado. No se asume que la sede esté abierta."}</p>}</fieldset>
 {error&&<p role="alert" className={styles.error}>{error}</p>}</div><div className={styles.editorFooter}><Button type="button" variant="outline" disabled={busy} onClick={closeEditor}>Cancelar</Button><Button type="submit" disabled={busy}>Guardar sede</Button></div></form>}
 </DialogContent></Dialog>
 {principal&&<ConfirmDialog open onOpenChange={open=>!open&&!busy&&setPrincipal(null)} title="Establecer como principal" description={branchLabel(principal)+". Se retirará la marca institucional de la sede anterior. Las asignaciones y sedes preferidas de los profesionales no cambiarán. "+error} confirmLabel="Establecer como principal" isLoading={busy} onConfirm={setMain}/>}
 {deleting&&<ConfirmDialog open onOpenChange={open=>!open&&!busy&&setDeleting(null)} title={dependency(deleting)?"No es posible eliminar esta sede":"Eliminar sede"} description={dependency(deleting)||("Se eliminará «"+branchLabel(deleting)+"» del catálogo de demostración, sin eliminar datos clínicos. "+error)} confirmLabel={dependency(deleting)?"Entendido":"Eliminar sede"} destructive={!dependency(deleting)} isLoading={busy} onConfirm={dependency(deleting)?()=>setDeleting(null):remove}/>}
 </>
}
