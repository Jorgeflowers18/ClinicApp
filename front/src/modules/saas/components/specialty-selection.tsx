import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { specialtyCompatible } from "../lib/specialty-policy"
import type { Specialty } from "../types"
export function SpecialtySelection({ catalog, value, typeId, onChange, error }: { catalog: Specialty[]; value: string[]; typeId?: string|null; onChange:(ids:string[])=>void; error?:string }) {
 const options=catalog.filter(item=>(item.active&&specialtyCompatible(item,typeId))||value.includes(item.id))
 return <Field data-invalid={Boolean(error)}><FieldLabel>Especialidades</FieldLabel><div className="saas-checks" data-validation-field="specialtyIds" tabIndex={-1}>
 {options.map(item=><label className="saas-check" key={item.id}><Checkbox checked={value.includes(item.id)} disabled={!item.active&&!value.includes(item.id)} onCheckedChange={checked=>onChange(checked?[...new Set([...value,item.id])]:value.filter(id=>id!==item.id))} />{item.name}{!item.active?" (inactiva)":!specialtyCompatible(item,typeId)?" (revisar compatibilidad)":!item.professionalTypeIds?.length?" (sin clasificar)":""}</label>)}
 </div>{!options.length&&<p className="saas-hint">No hay especialidades compatibles registradas. Configúralas en Administración.</p>}<FieldError>{error}</FieldError></Field>
}
