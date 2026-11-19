import { useState } from "react"
import { createRoot } from "react-dom/client"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { NumericInput } from "@/components/ui/numeric-input"
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

export function mount() {
  const element = document.createElement("div"); element.dataset.uiFixture = ""
  Object.assign(element.style, { position: "fixed", top: "80px", left: "16px", right: "16px", zIndex: "40", maxHeight: "calc(100dvh - 100px)", overflow: "auto", background: "var(--card)", padding: "16px" })
  document.body.appendChild(element); createRoot(element).render(<Fixture />)
}
const options = { prof_3: "Dra. Andrea del Camino, especialista en rehabilitación oral integral y odontología avanzada", prof_2: "Dr. Andrés Vega" }
// oxlint-disable-next-line react/only-export-components -- Browser test fixture mounted explicitly, outside application Fast Refresh.
function Fixture() {
  const [items, setItems] = useState<Record<string,string>>(options)
  const [value, setValue] = useState("prof_3"), [changes, setChanges] = useState(0)
  const [variant,setVariant]=useState<"small"|"medium"|"wide"|"complex">("small"), [open,setOpen]=useState(false)
  return <div className="space-y-4">
    <Select items={items} value={value} onValueChange={next=>{setValue(next!);setChanges(v=>v+1)}}><SelectTrigger aria-label="Profesional asíncrono" className="w-56"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(items).map(([key,label])=><SelectItem key={key} value={key}>{label}</SelectItem>)}</SelectContent></Select>
    <Button onClick={()=>setItems({})}>Vaciar opciones durante carga</Button><Button onClick={()=>setItems(options)}>Recuperar opciones</Button><output aria-label="Cambios de selección">{changes}</output>
    <label>Importe de prueba<NumericInput aria-label="Importe de prueba" prefix="$" min={-20} max={500} step="0.01" defaultValue="12.35" /></label>
    <label>Duración de prueba<NumericInput aria-label="Duración de prueba" suffix="min" min={5} step={5} defaultValue={30} /></label>
    <label>Control especializado<Input aria-label="Control especializado" type="number" nativeNumberControls min={0} defaultValue={2} /></label>
    {(["small","medium","wide","complex"] as const).map(size=><Button key={size} onClick={()=>{setVariant(size);setOpen(true)}}>Abrir {size}</Button>)}
    <Dialog open={open} onOpenChange={setOpen}><DialogContent variant={variant}><DialogHeader><DialogTitle>Formulario {variant}</DialogTitle><DialogDescription>Comprobación de contenido largo y acciones accesibles.</DialogDescription></DialogHeader><DialogBody>{Array.from({length:24},(_,i)=><label key={i} className="block mb-4">Campo {i+1}<Input aria-label={"Campo "+(i+1)} defaultValue={"Valor "+(i+1)} /></label>)}</DialogBody><DialogFooter><Button variant="outline" onClick={()=>setOpen(false)}>Cancelar prueba</Button><Button onClick={()=>setOpen(false)}>Guardar prueba</Button></DialogFooter></DialogContent></Dialog>
  </div>
}
