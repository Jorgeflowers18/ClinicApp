export type HoursInterval = { start: string; end: string }
export type HoursDay = { open: boolean; intervals: HoursInterval[] }
export type BranchWeek = HoursDay[]
export const weekDays = ["Lunes","Martes","Miércoles","Jueves","Viernes","Sábado","Domingo"]
export const emptyBranchWeek = (): BranchWeek => weekDays.map(() => ({ open: false, intervals: [] }))
export const hasRemovedKnownBranch = (known: {id:string}[], next: {id:string}[]) => known.some(branch => branch.id && !next.some(item => item.id === branch.id))
const time = /^(?:[01]\d|2[0-3]):[0-5]\d$/
export function branchHoursErrors(week: BranchWeek): Record<string,string> {
  const errors: Record<string,string> = {}
  week.forEach((day,index) => {
    if (!day.open) return
    if (!day.intervals.length) { errors[index] = "Agrega al menos un intervalo para el día abierto."; return }
    for (let n=0;n<day.intervals.length;n++) {
      const item=day.intervals[n]
      if (!time.test(item.start)||!time.test(item.end)) { errors[index] = "Completa las horas de apertura y cierre."; break }
      if (item.end<=item.start) { errors[index] = "El cierre debe ser posterior a la apertura. Para cruzar medianoche, divide el horario entre ambos días."; break }
      if (day.intervals.slice(0,n).some(other=>item.start<other.end&&item.end>other.start)) { errors[index] = "Los intervalos no pueden solaparse ni repetirse."; break }
    }
  })
  return errors
}
export function formatBranchHours(week: BranchWeek) {
  return weekDays.map((name,index)=>name+": "+(week[index].open ? week[index].intervals.map(item=>item.start+"–"+item.end).join(", ") : "Cerrado")).join("\n")
}
export function parseBranchHours(value: string): BranchWeek | null {
  const lines=value.split("\n")
  if(lines.length!==7) return null
  const week: BranchWeek=[]
  for(let i=0;i<7;i++) {
    if(!lines[i].startsWith(weekDays[i]+": ")) return null
    const text=lines[i].slice(weekDays[i].length+2)
    if(text==="Cerrado"){week.push({open:false,intervals:[]});continue}
    const intervals=text.split(", ").map(item=>{const [start,end]=item.split("–");return {start,end}})
    if(intervals.some(item=>!item.end))return null
    week.push({open:true,intervals})
  }
  return Object.keys(branchHoursErrors(week)).length ? null : week
}
export function branchOpenFor(hours: string, date: string, start: string, end: string): boolean | null {
  const week=parseBranchHours(hours)
  if(!week||!/^\d{4}-\d{2}-\d{2}$/.test(date))return null
  const jsDay=new Date(date+"T12:00:00Z").getUTCDay(),day=week[(jsDay+6)%7]
  return Boolean(day.open&&day.intervals.some(item=>start>=item.start&&end<=item.end&&end>start))
}
export function branchDeletionReason(input: { server: boolean; id: string; branches: {id:string;isMain:boolean}[]; assignments: {siteId:string}[]; operations?: unknown }) {
  if(input.server)return "La ausencia de relaciones en el servidor no se puede comprobar desde aquí. Puedes desactivar la sede; la eliminación requiere validación del backend."
  if(input.assignments.some(item=>item.siteId===input.id))return "Esta sede tiene asignaciones de usuarios o profesionales. Puedes desactivarla conservando su historial."
  function references(value: unknown): boolean {
    if(!value||typeof value!=="object")return false
    if(Array.isArray(value))return value.some(references)
    const item=value as Record<string,unknown>
    return item.siteId===input.id||item.branchId===input.id||Object.values(item).some(references)
  }
  if(references(input.operations))return "Esta sede tiene registros relacionados en la demostración. Puedes desactivarla conservando su historial."
  if(input.branches.length>1&&input.branches.find(item=>item.id===input.id)?.isMain)return "Establece otra sede como principal antes de eliminar esta."
  return ""
}
