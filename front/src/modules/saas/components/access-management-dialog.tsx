import { AccountAccessDialog } from "./account-access-dialog"
import type { StaffUser } from "../types"
/** Compatibility entry point; credentials and actions share one account flow. */
export function AccessManagementDialog({user,onClose}:{user:StaffUser;onClose:()=>void}){
 return <AccountAccessDialog demo member={user} onClose={onClose}/>
}
