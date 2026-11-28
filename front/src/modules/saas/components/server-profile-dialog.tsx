import { useRef,useState } from "react"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { ChevronDown } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Field,FieldLabel,FieldError } from "@/components/ui/field"
import { Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription,DialogBody,DialogFooter } from "@/components/ui/dialog"
import { useValidatedForm } from "@/shared/hooks/use-validated-form"
import { useModalAccordion } from "@/shared/hooks/use-modal-accordion"
import { documentValidationMessage } from "@/shared/lib/ecuadorian-cedula"
import { getErrorMessage } from "@/shared/lib/error-message"
import { applyServerFieldErrors } from "@/shared/lib/field-issues"
import { useUsers,useUpdateUser } from "@/modules/auth/api/users.queries"
import { useSaveProfessional } from "@/modules/appointments/api/appointments.queries"
import type { Professional } from "@/modules/appointments/types/appointment.types"
import type { ManagedUser } from "@/modules/auth/types/user-admin.types"
import { readDemoData,demoId } from "../adapters/demo-repository"
import { useSaasData } from "../state"
import { useStaffInstitution } from "../lib/institution-scope"
import { useSpecialtyCatalog,professionalSpecialtyIds } from "../lib/specialty-catalog"
import { specialtySelectionError } from "../lib/specialty-policy"
import { initialPersonNames,serverProfessionalState } from "../lib/server-person-settings"
import { builtinRoleId } from "../lib/access-catalogs"
import { clinicDay } from "../lib/professional-policy"
import { catalogService } from "../catalog-services"
import { professionalStates,type StaffSettings,type ProfessionalState } from "../types"
import { SaasSelect } from "./controls"
import { SpecialtySelection } from "./specialty-selection"
const schema=z.object({firstName:z.string().trim().min(1,"Ingresa los nombres."),lastName:z.string().trim().min(1,"Ingresa los apellidos."),documentType:z.string(),documentNumber:z.string(),phone:z.string().trim().refine(value=>!value||/^\+?[\d ()-]{7,20}$/.test(value),"Ingresa un teléfono válido."),professionalTypeId:z.string(),specialtyIds:z.array(z.string()),registration:z.string().max(40,"Hasta 40 caracteres."),siteIds:z.array(z.string()),state:z.enum(["ACTIVE","INACTIVE","VACATION","LEAVE","RETIRED"]),from:z.string(),to:z.string()}).superRefine((value,ctx)=>{
 const issue=documentValidationMessage(value.documentType,value.documentNumber);if(issue)ctx.addIssue({code:"custom",path:["documentNumber"],message:issue})
 if(["VACATION","LEAVE"].includes(value.state)&&(!/^\d{4}-\d{2}-\d{2}$/.test(value.from)||!value.to||value.to<value.from))ctx.addIssue({code:"custom",path:["from"],message:"Indica un período válido de inicio y finalización."})
})
type Values=z.infer<typeof schema>
type Props={user?:ManagedUser|null;professional?:Professional|null;createProfessional?:boolean;onClose:()=>void}
export function ServerProfileDialog(props:Props){return <ServerProfileForm key={props.user?.id??props.professional?.id??"new"} {...props}/>}
function ServerProfileForm({user:providedUser,professional,createProfessional=false,onClose}:Props){
 const data=useSaasData(),{organizationId,organization,profile}=useStaffInstitution(),users=useUsers(),user=providedUser??users.data?.find(item=>item.id===professional?.userId),clinical=Boolean(professional)||createProfessional
 const catalog=useSpecialtyCatalog(),scopeSettings=data.serverStaffSettings?.[organizationId]??{},settingsId=user?.id??"professional:"+professional?.id
 const [original]=useState<StaffSettings>(()=>({...readDemoData().serverStaffSettings?.[organizationId]?.["professional:"+professional?.id],...readDemoData().serverStaffSettings?.[organizationId]?.[settingsId],accessRoleIds:scopeSettings[settingsId]?.accessRoleIds??(user?[builtinRoleId(organizationId,user.role)]:[]),professionalTypeId:(scopeSettings[settingsId]??scopeSettings["professional:"+professional?.id])?.professionalTypeId??null}))
 const names=initialPersonNames(user?.name??professional?.name??"",original),oldIds=professionalSpecialtyIds(professional,catalog,original.specialtyIds),state=clinical?serverProfessionalState(professional?.active??true,original):"ACTIVE"
 const absence=original.absences?.find(item=>item.from<=clinicDay()&&item.to>=clinicDay()),root=useRef<HTMLDivElement>(null),savedId=useRef<string|undefined>(undefined),saveProfessional=useSaveProfessional(),updateUser=useUpdateUser(),[failure,setFailure]=useState("")
 const accordion=useModalAccordion(root,"personal")
 const form=useValidatedForm<Values>({resolver:zodResolver(schema),defaultValues:{...names,documentType:original.documentType??"otro",documentNumber:original.documentNumber??"",phone:original.phone??"",professionalTypeId:original.professionalTypeId??"",specialtyIds:oldIds,registration:professional?.registrationNumber??"",siteIds:original.siteIds??[],state:state as ProfessionalState,from:absence?.from??clinicDay(),to:absence?.to??""}},root)
 const values=form.watch(),errors=form.formState.errors
 const groups=[{id:"personal",title:"Datos personales",fields:["firstName","lastName","documentNumber","phone"]},...(clinical?[{id:"professional",title:"Perfil profesional",fields:["professionalTypeId","specialtyIds","registration","state","from","to"]}]:[]),{id:"sites",title:"Sedes asignadas",fields:["siteIds"]}]
 function reveal(field:string){const group=groups.find(item=>item.fields.includes(field));if(group)accordion.request(group.id,'[name="'+field+'"],[data-validation-field="'+field+'"]')}
 async function save(next:Values){
 setFailure("")
 try{
  if(clinical){
   const issue=specialtySelectionError(catalog,next.specialtyIds,next.professionalTypeId||null,oldIds,original.professionalTypeId)
   if(issue){form.setError("specialtyIds",{message:issue});reveal("specialtyIds");return}
   if(!next.specialtyIds.length){form.setError("specialtyIds",{message:"Selecciona al menos una especialidad."});reveal("specialtyIds");return}
  }
  const name=next.firstName+" "+next.lastName,nameChanged=next.firstName!==names.firstName||next.lastName!==names.lastName
  if(next.state==="RETIRED"&&state!=="RETIRED"&&!confirm("¿Confirmas el retiro del profesional? Se conservarán sus registros y citas históricas."))return
  const specialty=next.specialtyIds.map(id=>catalog.find(item=>item.id===id)?.name).filter(Boolean).join(" · ")
  if(clinical&&specialty.length>80){form.setError("specialtyIds",{message:"La API actual admite hasta 80 caracteres para la especialidad. Reduce la selección."});reveal("specialtyIds");return}
  let personId=user?.id??settingsId
  if(clinical){
   const saved=await saveProfessional.mutateAsync({id:professional?.id??savedId.current,values:{name:nameChanged||!professional?name:professional.name,specialty,registrationNumber:next.registration,active:!["INACTIVE","RETIRED"].includes(next.state)},userId:professional?.userId??user?.id??null})
   savedId.current=saved.id;personId=user?.id??"professional:"+saved.id
   if(professional?.active&&!saved.active&&(saved.futureAppointments??0)>0)toast.warning("El profesional tiene citas futuras. Revísalas en Citas; no se han cancelado.")
  }
  if(user&&nameChanged)await updateUser.mutateAsync({id:user.id,values:{name,email:user.email,role:user.role,professionalId:user.professionalId??"",active:user.active}})
  let absences=original.absences??[]
  if(["VACATION","LEAVE"].includes(next.state)){const period={id:absence?.id??demoId(),type:next.state as "VACATION"|"LEAVE",from:next.from,to:next.to,note:absence?.note??""};absences=[...absences.filter(item=>item.id!==period.id),period]}
  else if(next.state==="ACTIVE"&&absence)absences=absences.filter(item=>item.id!==absence.id)
  const latest=readDemoData().serverStaffSettings?.[organizationId]?.[personId]??original
  await catalogService.saveServerSettings(personId,{...latest,accessRoleIds:latest.accessRoleIds.length?latest.accessRoleIds:user?[builtinRoleId(organizationId,user.role)]:[],firstName:next.firstName,lastName:next.lastName,documentType:next.documentType,documentNumber:next.documentNumber,phone:next.phone,professionalTypeId:next.professionalTypeId||null,specialtyIds:next.specialtyIds,siteIds:next.siteIds,professionalState:["VACATION","LEAVE"].includes(next.state)?"ACTIVE":next.state,absences},professional?.id??savedId.current)
  onClose()
 }catch(error){if(!applyServerFieldErrors(form,error).length)setFailure(getErrorMessage(error))}
 }
 const text=(key:"firstName"|"lastName"|"documentNumber"|"phone"|"registration"|"from"|"to",label:string,type="text")=><Field data-invalid={Boolean(errors[key])}><FieldLabel htmlFor={"profile-"+key}>{label}</FieldLabel><Input id={"profile-"+key} type={type} {...form.register(key,key==="documentNumber"?{onBlur:()=>void form.trigger("documentNumber")}:undefined)} aria-invalid={Boolean(errors[key])}/><FieldError>{errors[key]?.message}</FieldError></Field>
 const contents={
 personal:<div className="saas-grid">{text("firstName","Nombres *")}{text("lastName","Apellidos *")}<SaasSelect label="Tipo de documento" value={values.documentType} items={{cedula:"Cédula ecuatoriana",pasaporte:"Pasaporte",extranjero:"Documento extranjero",ruc:"RUC",otro:"Otro documento"}} onChange={value=>form.setValue("documentType",value,{shouldDirty:true,shouldValidate:Boolean(errors.documentNumber)})}/>{text("documentNumber","Número de documento")}{text("phone","Teléfono","tel")}</div>,
 professional:<div className="saas-grid"><SaasSelect label="Tipo profesional" value={values.professionalTypeId||"none"} items={{none:"Sin tipo asignado",...Object.fromEntries((data.professionalTypes??[]).filter(item=>item.organizationId===organizationId&&(item.active||item.id===original.professionalTypeId)).map(item=>[item.id,item.name+(!item.active?" (inactivo)":"")]))}} onChange={value=>form.setValue("professionalTypeId",value==="none"?"":value,{shouldDirty:true})}/>
 {text("registration","Registro profesional")}<div className="col-span-full"><SpecialtySelection catalog={catalog} typeId={values.professionalTypeId} value={values.specialtyIds} onChange={ids=>form.setValue("specialtyIds",ids,{shouldDirty:true,shouldValidate:form.formState.isSubmitted})} error={errors.specialtyIds?.message}/></div>
 <SaasSelect label="Estado profesional" statusKind="professional" value={values.state} items={professionalStates} onChange={value=>form.setValue("state",value as Values["state"],{shouldDirty:true})}/>
 {["VACATION","LEAVE"].includes(values.state)&&<div className="saas-grid">{text("from","Fecha de inicio","date")}{text("to","Fecha de finalización","date")}</div>}
 <p className="saas-hint col-span-full">Los períodos y estados laborales extendidos se guardan en el frontend. No se cancelan citas ni se modifican atenciones históricas.</p></div>,
 sites:<Field><FieldLabel>Sedes asignadas</FieldLabel><div className="saas-checks">{(profile?.branches??organization.branches).filter(site=>organization.branches.some(item=>item.id===site.id)||values.siteIds.includes(site.id)).map(site=><label className="saas-check" key={site.id}><Checkbox checked={values.siteIds.includes(site.id)} disabled={!organization.branches.some(item=>item.id===site.id)} onCheckedChange={checked=>form.setValue("siteIds",checked?[...new Set([...values.siteIds,site.id])]:values.siteIds.filter(id=>id!==site.id),{shouldDirty:true})}/>{site.name}{!organization.branches.some(item=>item.id===site.id)&&" (inactiva · asociación conservada)"}</label>)}</div>{!profile?.branches.length&&<p className="saas-hint">No hay sedes registradas.</p>}</Field>
 }
 function close(){if(!form.formState.isSubmitting&&(!form.formState.isDirty||confirm("¿Descartar los cambios del perfil?")))onClose()}
 return <Dialog open onOpenChange={open=>!open&&close()}><DialogContent variant="wide" className="saas-scope"><DialogHeader><DialogTitle>{createProfessional?"Registrar profesional":"Editar perfil"}</DialogTitle><DialogDescription>Datos personales y profesionales. Las credenciales y los roles se administran en Gestionar acceso.</DialogDescription></DialogHeader><DialogBody ref={root}><form id="staff-profile-form" noValidate onSubmit={event=>void form.handleSubmit(save,invalid=>{const field=groups.flatMap(group=>group.fields).find(field=>field in invalid);if(field)reveal(field)})(event)}>
 {groups.map(group=><section className="saas-accordion" key={group.id}><button type="button" aria-expanded={accordion.open===group.id} aria-controls={"profile-panel-"+group.id} onClick={()=>accordion.request(accordion.open===group.id?null:group.id)}>{group.title}<ChevronDown className="size-4"/></button><div id={"profile-panel-"+group.id} className="saas-accordion-motion" data-open={accordion.open===group.id} inert={accordion.open!==group.id} aria-hidden={accordion.open!==group.id||undefined} data-validation-panel><div><div className="saas-accordion-body">{contents[group.id as keyof typeof contents]}</div></div></div></section>)}
 {failure&&<p role="alert" className="text-destructive">{failure}</p>}</form></DialogBody><DialogFooter><Button variant="outline" disabled={form.formState.isSubmitting} onClick={close}>Cancelar</Button><Button form="staff-profile-form" type="submit" disabled={form.formState.isSubmitting}>Guardar perfil</Button></DialogFooter></DialogContent></Dialog>
}
