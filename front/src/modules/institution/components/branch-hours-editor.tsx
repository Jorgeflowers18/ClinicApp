import { Plus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { FieldError } from "@/components/ui/field"
import { weekDays,type BranchWeek } from "../lib/branch-hours"
import styles from "./branch-hours-editor.module.css"
export function BranchHoursEditor({value,onChange,errors}:{value:BranchWeek;onChange:(week:BranchWeek)=>void;errors:Record<string,string>}){
 return <div className={styles.week}>{weekDays.map((name,index)=>{
 const day=value[index],update=(patch:Partial<typeof day>)=>onChange(value.map((item,n)=>n===index?{...item,...patch}:item))
 return <fieldset id={"branch-day-"+index} tabIndex={-1} className={styles.day} key={name}><legend><label><Checkbox checked={day.open} onCheckedChange={checked=>update({open:Boolean(checked),intervals:checked&&!day.intervals.length?[{start:"",end:""}]:day.intervals})}/>{name}</label><span>{day.open?"Abierto":"Cerrado"}</span></legend>
 {day.open&&<div className={styles.intervals}>{day.intervals.map((interval,n)=><div key={n} className={styles.interval}>
 <label htmlFor={"branch-hours-"+index+"-"+n+"-start"}>Apertura<Input id={"branch-hours-"+index+"-"+n+"-start"} type="time" value={interval.start} aria-invalid={Boolean(errors[index])} onChange={event=>update({intervals:day.intervals.map((item,i)=>i===n?{...item,start:event.target.value}:item)})}/></label>
 <label htmlFor={"branch-hours-"+index+"-"+n+"-end"}>Cierre<Input id={"branch-hours-"+index+"-"+n+"-end"} type="time" value={interval.end} aria-invalid={Boolean(errors[index])} onChange={event=>update({intervals:day.intervals.map((item,i)=>i===n?{...item,end:event.target.value}:item)})}/></label>
 <Button type="button" variant="ghost" size="icon-sm" aria-label={"Quitar intervalo "+(n+1)+" de "+name} onClick={()=>update({intervals:day.intervals.filter((_,i)=>i!==n)})}><X/></Button></div>)}
 <Button type="button" variant="outline" size="sm" className={styles.add} onClick={()=>update({intervals:[...day.intervals,{start:"",end:""}]})}><Plus/>Agregar intervalo</Button></div>}
 <FieldError id={"branch-day-"+index+"-error"}>{errors[index]}</FieldError></fieldset>
 })}</div>
}
