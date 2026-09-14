import { useState } from "react"
import { Plus } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
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

      {isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : cycles && cycles.length > 0 ? (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Instrumentos</TableHead>
                <TableHead>Resultado</TableHead>
                <TableHead>Responsable</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cycles.map((cycle) => (
                <TableRow key={cycle.id}>
                  <TableCell className="text-muted-foreground">
                    {formatDateOnly(cycle.performedAt, { year: "numeric", month: "short", day: "2-digit" })}
                  </TableCell>
                  <TableCell>{cycle.itemIds.map(itemName).join(", ")}</TableCell>
                  <TableCell>
                    <Badge variant={cycle.result === "aprobado" ? "default" : "destructive"}>
                      {sterilizationResultLabels[cycle.result]}
                    </Badge>
                  </TableCell>
                  <TableCell>{professionalName(cycle.responsibleProfessionalId)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Sin ciclos de esterilización registrados todavía.
        </p>
      )}

      <SterilizationCycleFormDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  )
}
