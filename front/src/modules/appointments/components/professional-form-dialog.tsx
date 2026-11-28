import { ServerProfileDialog } from "@/modules/saas/components/server-profile-dialog"
import type { Professional } from "../types/appointment.types"
export function ProfessionalFormDialog({open,onOpenChange,professional}:{open:boolean;onOpenChange:(open:boolean)=>void;professional:Professional|null}){
 return open?<ServerProfileDialog professional={professional} createProfessional={!professional} onClose={()=>onOpenChange(false)}/>:null
}
