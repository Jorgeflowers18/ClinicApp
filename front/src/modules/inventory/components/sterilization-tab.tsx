import { useState } from "react"
import { Plus } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DataTable, type DataTableColumn } from "@/shared/components/data-table"
import { formatDateOnly } from "@/shared/lib/date"
import { useProfessionals } from "@/modules/appointments/api/appointments.queries"

import { useInventoryList, useSterilizationCyclesList } from "../api/inventory.queries"
import { SterilizationCycleFormDialog } from "./sterilization-cycle-form-dialog"
import { sterilizationResultLabels } from "../types/inventory.types"

export function SterilizationTab() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const { data: cycles, isLoading } = useSterilizationCyclesList()
  const { data: inventoryPage } = useInventoryList({ page: 1, pageSize: 100 })
  const { data: professionals } = useProfessionals()
  const columns: DataTableColumn<NonNullable<typeof cycles>[number]>[] = [
    {
      key: "date",
      header: "Fecha",
      cell: (cycle) => formatDateOnly(cycle.performedAt, { year: "numeric", month: "short", day: "2-digit" }),
    },
    { key: "items", header: "Instrumentos", cell: (cycle) => cycle.itemIds.map(itemName).join(", ") },
    {
      key: "result",
      header: "Resultado",
      cell: (cycle) => (
        <Badge variant={cycle.result === "aprobado" ? "default" : "destructive"}>
          {sterilizationResultLabels[cycle.result]}
        </Badge>
      ),
    },
    {
      key: "professional",
      header: "Responsable",
      cell: (cycle) => professionalName(cycle.responsibleProfessionalId),
    },
  ]

  function itemName(itemId: string) {
    return inventoryPage?.items.find((item) => item.id === itemId)?.name ?? "Insumo"
  }

  function professionalName(professionalId: string) {
    return professionals?.find((professional) => professional.id === professionalId)?.name ?? "Profesional"
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setDialogOpen(true)}>
          <Plus />
          Nuevo ciclo
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={cycles ?? []}
        getRowId={(cycle) => cycle.id}
        isLoading={isLoading}
        mobileTitleKey="items"
        emptyTitle="Sin ciclos de esterilización"
        emptyDescription="Todavía no hay ciclos registrados."
      />

      <SterilizationCycleFormDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  )
}
