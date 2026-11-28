import type { ServerPerson } from "./server-people"
import type { SaasData, StaffSettings, AccountState } from "../types"
import { effectiveProfessionalState } from "./professional-policy"
export function serverPersonSettings(data:SaasData,scope:string,person:ServerPerson):StaffSettings {
 const saved=data.serverStaffSettings?.[scope]??{}
 const values:Partial<StaffSettings>={...saved["professional:"+person.professional?.id],...saved[person.id]}
 return {...values,accessRoleIds:values.accessRoleIds??[],professionalTypeId:values.professionalTypeId??null}
}
export function serverAccountState(user:{active:boolean;lastLoginAt?:string|null},settings:StaffSettings):AccountState {
 if(!user.active)return settings.state==="blocked"?"blocked":"inactive"
 if(settings.state==="pending"&&user.lastLoginAt&&(!settings.accessConfiguredAt||user.lastLoginAt>settings.accessConfiguredAt))return "active"
 return settings.state??"active"
}
export function serverProfessionalState(active:boolean,settings:StaffSettings) {
 if(!active)return settings.professionalState==="RETIRED"?"RETIRED":"INACTIVE"
 return effectiveProfessionalState({professionalState:settings.professionalState??"ACTIVE",absences:settings.absences??[]})
}
export function initialPersonNames(fullName:string,settings?:StaffSettings){
 const [first,...last]=fullName.trim().split(/\s+/)
 return {firstName:settings?.firstName??first??"",lastName:settings?.lastName??last.join(" ")}
}
