import { useState } from "react"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { DataTable, type DataTableColumn } from "@/shared/components/data-table"
import { PaginationBar } from "@/shared/components/pagination-bar"
import { useTableQueryState } from "@/shared/hooks/use-table-query-state"
import { formatDateOnly } from "@/shared/lib/date"
import { getErrorMessage } from "@/shared/lib/error-message"
import { useProfessionals } from "@/modules/appointments/api/appointments.queries"
import { useSterilizationCyclesList } from "../api/inventory.queries"
import { useInventoryCatalog } from "../hooks/use-inventory-catalog"
import { sterilizationResultLabels, sterilizationResults, type SterilizationCycle } from "../types/inventory.types"
import { SterilizationCycleFormDialog } from "./sterilization-cycle-form-dialog"
import { InventoryToolbar } from "./inventory-toolbar"
import { InventoryFilter, ALL_INVENTORY as ALL } from "./inventory-filter"
import { InventoryStatus } from "./inventory-presentation"

export function SterilizationTab() {
  const [open,setOpen]=useState(false),[result,setResult]=useState(ALL)
  const cycles=useSterilizationCyclesList(),inventory=useInventoryCatalog(),professionals=useProfessionals(),table=useTableQueryState()
  const instrument=(id:string)=>inventory.data?.find(item=>item.id===id)?.name??(inventory.isPending?"Cargando instrumental…":"Instrumento no disponible")
  const responsible=(id:string)=>professionals.data?.find(item=>item.id===id)?.name??(professionals.isPending?"Cargando responsable…":"Profesional no disponible")
  const search=table.debouncedSearch.trim().toLowerCase()
  const items=(cycles.data??[]).filter(cycle=>(result===ALL||cycle.result===result)&&(!search||[...cycle.itemIds.map(instrument),responsible(cycle.responsibleProfessionalId),cycle.notes].join(" ").toLowerCase().includes(search)))
  const pages=Math.max(1,Math.ceil(items.length/table.pageSize)),page=Math.min(table.page,pages)
  const columns:DataTableColumn<SterilizationCycle>[]=[
    {key:"date",header:"Fecha",cell:cycle=>formatDateOnly(cycle.performedAt,{year:"numeric",month:"short",day:"2-digit"})},
    {key:"items",header:"Instrumentos",cell:cycle=>cycle.itemIds.map(instrument).join(", ")},
    {key:"result",header:"Resultado",cell:cycle=><InventoryStatus label={sterilizationResultLabels[cycle.result]} tone={cycle.result==="aprobado"?"success":"danger"} />},
    {key:"professional",header:"Responsable",cell:cycle=>responsible(cycle.responsibleProfessionalId)},
    {key:"notes",header:"Observaciones",cell:cycle=><span className="whitespace-pre-wrap">{cycle.notes||"—"}</span>},
  ]
  return <div className="space-y-4"><InventoryToolbar search={table.search} onSearch={table.setSearch} label="Buscar ciclos" placeholder="Buscar por instrumento, responsable u observaciones..." filters={<InventoryFilter label="Filtrar ciclos por resultado" value={result} onChange={value=>{setResult(value);table.setPage(1)}} allLabel="Todos los resultados" options={sterilizationResults.map(value=>({value,label:sterilizationResultLabels[value]}))} />} filterCount={Number(Boolean(table.search))+Number(result!==ALL)} onClear={()=>{table.setSearch("");setResult(ALL);table.setPage(1)}} action={<Button data-inventory-create onClick={()=>setOpen(true)}><Plus />Nuevo ciclo</Button>} />
    {(inventory.isError||professionals.isError)&&<Alert variant="destructive"><AlertTitle>No se pudieron resolver todos los nombres</AlertTitle><AlertDescription>{getErrorMessage(inventory.error??professionals.error)}</AlertDescription></Alert>}
    <DataTable className="inventory-table inventory-empty" columns={columns} data={items.slice((page-1)*table.pageSize,page*table.pageSize)} getRowId={cycle=>cycle.id} mobileTitleKey="items" isLoading={cycles.isPending} isError={cycles.isError} errorMessage={getErrorMessage(cycles.error)} emptyTitle={search||result!==ALL?"Sin coincidencias":"Sin ciclos de esterilización"} emptyDescription={search||result!==ALL?"No hay ciclos con estos criterios.":"Todavía no hay ciclos registrados."} />
    {cycles.data&&<PaginationBar page={page} pageSize={table.pageSize} totalItems={items.length} totalPages={pages} onPageChange={table.setPage} />}
    <SterilizationCycleFormDialog open={open} onOpenChange={setOpen} />
  </div>
}
