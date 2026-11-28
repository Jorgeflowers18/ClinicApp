import { useRef, useState } from "react"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { KeyRound, Mail, LockKeyhole, UnlockKeyhole, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription,DialogBody,DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Field,FieldLabel,FieldError } from "@/components/ui/field"
import { useValidatedForm } from "@/shared/hooks/use-validated-form"
import { getErrorMessage } from "@/shared/lib/error-message"
import { applyServerFieldErrors } from "@/shared/lib/field-issues"
import { useCreateUser,useUpdateUser,useCreatePasswordLink,useUsers } from "@/modules/auth/api/users.queries"
import type { ManagedUser,PasswordLink } from "@/modules/auth/types/user-admin.types"
import type { Professional } from "@/modules/appointments/types/appointment.types"
import { useSaasData,useSessionUser } from "../state"
import { readDemoData,demoId,assertUsernameAvailable } from "../adapters/demo-repository"
import { demoStaffAdapter } from "../services"
import { catalogService } from "../catalog-services"
import { useStaffInstitution } from "../lib/institution-scope"
import { accessRoles,assignedRoles,builtinRoleId } from "../lib/access-catalogs"
import { initialPersonNames,serverAccountState } from "../lib/server-person-settings"
import { usernameSchema,nameOf } from "../lib/identity"
import { accountStates,type StaffUser,type StaffSettings,type AccessRequest } from "../types"
import { RoleSelection } from "./role-selection"
import { SaasSelect,UsernameField } from "./controls"
import styles from "./administrative-ui.module.css"
const schema=z.object({firstName:z.string().trim(),lastName:z.string().trim(),username:usernameSchema,email:z.string().trim().email("Ingresa un correo válido."),accessRoleIds:z.array(z.string()).min(1,"Selecciona al menos un rol."),state:z.enum(["active","inactive","blocked","pending"]),activation:z.enum(["active","invitation","temporary"])})
type Values=z.infer<typeof schema>
type Props={demo?:boolean;member?:StaffUser|null;user?:ManagedUser|null;professional?:Professional;request?:AccessRequest;onClose:()=>void;onPasswordLink?:(value:{name:string;link:PasswordLink})=>void}
export function AccountAccessDialog(props:Props){return <AccountForm key={(props.member?.id??props.user?.id??props.professional?.id??props.request?.id??"new")+Boolean(props.demo)} {...props}/>}
function AccountForm({demo=false,member,user,professional,request,onClose,onPasswordLink}:Props){
 const data=useSaasData(),{organizationId}=useStaffInstitution(),actor=useSessionUser(),catalog=accessRoles(data,organizationId),root=useRef<HTMLDivElement>(null),lock=useRef(false)
 const apiUsers=useUsers({enabled:!demo}),create=useCreateUser(),update=useUpdateUser(),passwordLink=useCreatePasswordLink()
 const linkedProfessional=professional??undefined,scopeSettings=data.serverStaffSettings?.[organizationId]??{}
 const previousSettings={...scopeSettings["professional:"+linkedProfessional?.id],...scopeSettings[user?.id??""]}
 const existing=demo?Boolean(member&&member.hasAccount!==false):Boolean(user),contextName=member?nameOf(member):user?.name??professional?.name??(request?nameOf(request):"")
 const names=member?{firstName:member.firstName,lastName:member.lastName}:request?{firstName:request.firstName,lastName:request.lastName}:initialPersonNames(contextName,previousSettings)
 const form=useValidatedForm<Values>({resolver:zodResolver(schema.superRefine((value,ctx)=>{if(!contextName){if(!value.firstName)ctx.addIssue({code:"custom",path:["firstName"],message:"Ingresa los nombres."});if(!value.lastName)ctx.addIssue({code:"custom",path:["lastName"],message:"Ingresa los apellidos."})}})),defaultValues:{...names,username:member?.username??previousSettings.username??request?.username??data.identities.find(item=>item.id===user?.id)?.username??"",email:member?.email??user?.email??request?.email??"",accessRoleIds:member?assignedRoles(member,data,organizationId).map(item=>item.id):previousSettings.accessRoleIds?.length?previousSettings.accessRoleIds:[builtinRoleId(organizationId,user?.role??(professional?"medico":"recepcion"))],state:existing?member?.state??(user?serverAccountState(user,previousSettings):"pending"):"pending",activation:existing?member?.activation??previousSettings.activation??"active":"invitation"}},root)
 const values=form.watch(),errors=form.formState.errors,[failure,setFailure]=useState(""),[done,setDone]=useState(""),[action,setAction]=useState<string|null>(null)
 const draftId=useRef(member?.id??demoId()),created=useRef<{user:ManagedUser;passwordLink:PasswordLink}|null>(null),isSelf=(member?.id??user?.id)===actor?.id
 function close(){if(!form.formState.isSubmitting&&(!form.formState.isDirty||confirm("¿Descartar los cambios de acceso?")))onClose()}
 async function save(next:Values){
 if(lock.current)return
 lock.current=true;setFailure("")
 try{
  assertUsernameAvailable(next.username,member?.id??user?.id??created.current?.user.id)
  if(isSelf&&(!catalog.some(item=>item.builtin==="admin"&&item.active&&next.accessRoleIds.includes(item.id))||next.state!=="active")){form.setError("accessRoleIds",{message:"Tu cuenta debe conservar el rol Administrador y permanecer activa."});return}
  if(demo){
   const previous=readDemoData().users.find(item=>item.id===member?.id)??member
   const base:StaffUser=previous??{id:draftId.current,firstName:next.firstName,lastName:next.lastName,username:"",email:"",phone:"",documentType:"otro",documentNumber:"",roles:["recepcion"],state:"pending",organizationIds:[organizationId],assignments:[],professionalId:null,profession:"",registration:"",specialtyIds:[],professionalState:"ACTIVE",absences:[],activation:"invitation",mustChangePassword:false,profile:null,createdAt:new Date().toISOString()}
   const builtin=catalog.filter(item=>next.accessRoleIds.includes(item.id)&&item.builtin).map(item=>item.builtin!)
   const saved=await demoStaffAdapter.saveUser({...base,hasAccount:true,username:next.username,email:next.email,roles:builtin.length?builtin:base.roles,accessRoleIds:next.accessRoleIds,roleAssignments:{...base.roleAssignments,[organizationId]:next.accessRoleIds},state:next.state,activation:next.activation,mustChangePassword:next.activation==="temporary"?true:base.mustChangePassword})
   if(request)await catalogService.completeRequest(request.id,saved.id)
  }else{
   const professionalId=user?.professionalId??professional?.id??""
   if(!user&&!created.current&&professionalId&&apiUsers.data?.some(item=>item.professionalId===professionalId))throw new Error("Este profesional ya tiene una cuenta. Actualiza el listado y utiliza Gestionar acceso.")
   const baseRoles=catalog.filter(item=>next.accessRoleIds.includes(item.id)&&item.builtin).map(item=>item.builtin!)
   const role=baseRoles.includes(user?.role??"recepcion")?(user?.role??"recepcion"):baseRoles[0]??user?.role??"recepcion"
   const payload={name:contextName||nameOf(next),email:next.email,role,professionalId,active:next.state==="active"||next.state==="pending"}
   let id=user?.id??created.current?.user.id
   if(id)await update.mutateAsync({id,values:payload})
   else{created.current=await create.mutateAsync(payload);id=created.current.user.id;if(!payload.active)await update.mutateAsync({id,values:payload})}
   const settings:StaffSettings={...previousSettings,accessRoleIds:next.accessRoleIds,professionalTypeId:previousSettings.professionalTypeId??null,username:next.username,email:next.email,state:next.state,activation:next.activation,accessConfiguredAt:new Date().toISOString(),...(!existing?{firstName:next.firstName,lastName:next.lastName}:{})}
   await catalogService.saveServerSettings(id!,settings,professionalId)
   if(request)await catalogService.completeRequest(request.id,id!)
   if(!existing&&created.current&&onPasswordLink)onPasswordLink({name:payload.name,link:created.current.passwordLink})
  }
  onClose()
 }catch(error){if(!applyServerFieldErrors(form,error).length)setFailure(getErrorMessage(error))}finally{lock.current=false}
 }
 async function runAction(){
 if(!action||lock.current)return
 lock.current=true;setFailure("")
 try{
  if(demo&&member){
   const current=readDemoData().users.find(item=>item.id===member.id)!
   await demoStaffAdapter.saveUser({...current,...(action==="invitation"?{activation:"invitation" as const}:{mustChangePassword:true})})
   setDone("Acción guardada en la demostración. No se envió ningún correo.")
  }else if(user&&onPasswordLink){const link=await passwordLink.mutateAsync(user.id);onPasswordLink({name:user.name,link});onClose()}
  setAction(null)
 }catch(error){setFailure(getErrorMessage(error))}finally{lock.current=false}
 }
 return <Dialog open onOpenChange={open=>!open&&close()}><DialogContent variant="medium" className={`saas-scope ${styles.catalogDialog} ${styles.typeDialog}`}>
 <DialogHeader><DialogTitle>{existing?"Gestionar acceso":contextName?"Crear cuenta de acceso":"Nuevo usuario"}</DialogTitle><DialogDescription>{contextName||"Registra una cuenta administrativa. El perfil profesional se administra por separado."}</DialogDescription></DialogHeader>
 <DialogBody ref={root}><form id="account-access-form" className="saas-stack" noValidate onSubmit={event=>void form.handleSubmit(save)(event)}>
 {!contextName&&<div className="saas-grid">{(["firstName","lastName"] as const).map(key=><Field key={key} data-invalid={Boolean(errors[key])}><FieldLabel htmlFor={"account-"+key}>{key==="firstName"?"Nombres":"Apellidos"} *</FieldLabel><Input id={"account-"+key} {...form.register(key)} aria-invalid={Boolean(errors[key])}/><FieldError>{errors[key]?.message}</FieldError></Field>)}</div>}
 <UsernameField value={values.username} onChange={value=>form.setValue("username",value,{shouldDirty:true,shouldValidate:form.formState.isSubmitted})} accountId={member?.id??user?.id} required error={errors.username?.message}/>
 <Field data-invalid={Boolean(errors.email)}><FieldLabel htmlFor="account-email">Correo de acceso *</FieldLabel><Input id="account-email" type="email" {...form.register("email")} aria-invalid={Boolean(errors.email)}/><FieldError>{errors.email?.message}</FieldError></Field>
 <RoleSelection roles={catalog} value={values.accessRoleIds} onChange={ids=>form.setValue("accessRoleIds",ids,{shouldDirty:true,shouldValidate:form.formState.isSubmitted})} error={errors.accessRoleIds?.message}/>
 <SaasSelect id="state" label={existing?"Estado de cuenta":"Estado inicial de cuenta"} statusKind="account" disabled={isSelf} value={values.state} onChange={value=>form.setValue("state",value as Values["state"],{shouldDirty:true})} items={accountStates}/>
 <SaasSelect label="Método de activación" value={values.activation} items={{invitation:"Invitación",temporary:"Credencial temporal de demostración",active:"Cuenta activa"}} onChange={value=>form.setValue("activation",value as Values["activation"],{shouldDirty:true})}/>
 <p className="saas-hint">{demo?"Configuración de demostración: no envía correos ni genera contraseñas reales.":"La API conserva su rol base y estado activo/inactivo. Roles adicionales, activación y estados extendidos se guardan en esta configuración frontend; no sustituyen la autorización del servidor."}</p>
 {existing&&<section className="saas-stack" aria-label="Acciones de acceso">
 <div className="saas-grid">{[{id:"invitation",label:"Reenviar invitación",Icon:Mail},{id:"reset",label:"Restablecer acceso",Icon:KeyRound},{id:"password",label:"Solicitar cambio de contraseña",Icon:ShieldCheck}].map(({id,label,Icon})=><Button key={id} type="button" variant="outline" className="saas-access-choice" disabled={form.formState.isDirty||form.formState.isSubmitting||isSelf} onClick={()=>{setAction(id);setDone("")}}><Icon/>{label}</Button>)}
 <Button type="button" variant="outline" disabled={isSelf||form.formState.isSubmitting} onClick={()=>form.setValue("state",values.state==="blocked"?"active":"blocked",{shouldDirty:true})}>{values.state==="blocked"?<UnlockKeyhole/>:<LockKeyhole/>}{values.state==="blocked"?"Desbloquear cuenta":"Bloquear cuenta"}</Button></div>
 {!demo&&<p className="saas-hint">Las acciones de contraseña generan el enlace existente de la API. No envían una invitación automáticamente.</p>}
 {action&&<div className="saas-stack"><p>Confirma la acción para {contextName}. Se conservará el perfil profesional.</p><div className="saas-inline"><Button type="button" variant="outline" onClick={()=>setAction(null)}>Cancelar acción</Button><Button type="button" disabled={passwordLink.isPending} onClick={()=>void runAction()}>Confirmar acción</Button></div></div>}
 </section>}
 {done&&<p role="status">{done}</p>}{failure&&<p role="alert" className="text-destructive">{failure}</p>}
 </form></DialogBody><DialogFooter><Button variant="outline" disabled={form.formState.isSubmitting} onClick={close}>Cancelar</Button><Button type="submit" form="account-access-form" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting?"Guardando…":existing?"Guardar acceso":"Crear cuenta"}</Button></DialogFooter>
 </DialogContent></Dialog>
}
