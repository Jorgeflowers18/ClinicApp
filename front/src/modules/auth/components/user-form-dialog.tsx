import { AccountAccessDialog } from "@/modules/saas/components/account-access-dialog"
import type { Professional } from "@/modules/appointments/types/appointment.types"
import type { AccessRequest } from "@/modules/saas/types"
import type { ManagedUser,PasswordLink } from "../types/user-admin.types"
export function UserFormDialog({open,onOpenChange,user,prefillProfessional,onPasswordLink,request}:{open:boolean;onOpenChange:(open:boolean)=>void;user:ManagedUser|null;prefillProfessional?:Professional;request?:AccessRequest;onPasswordLink:(value:{name:string;link:PasswordLink})=>void}){
 return open?<AccountAccessDialog user={user} professional={prefillProfessional} request={request} onClose={()=>onOpenChange(false)} onPasswordLink={onPasswordLink}/>:null
}
