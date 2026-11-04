import { Trash2 } from "lucide-react"
import { useFormContext, useWatch } from "react-hook-form"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatCurrency } from "@/shared/lib/number"
import { useActiveTreatments, useTreatmentsList } from "@/modules/treatments/api/treatments.queries"

import type { ProposedTreatment, RecordFormValues } from "../types/clinical-history.types"
import { PlanItemForm } from "./plan-item-form"

export function TreatmentPlanTab() {
  const { control, setValue } = useFormContext<RecordFormValues>()
  const plan = useWatch({ control, name: "plan" })
  const { data: activeTreatments } = useActiveTreatments()
  // Catálogo completo (incluye inactivos) para mostrar nombre y precio de ítems antiguos.
  const { data: catalog } = useTreatmentsList({ page: 1, pageSize: 100 })

  const treatmentById = new Map((catalog?.items ?? activeTreatments ?? []).map((treatment) => [treatment.id, treatment]))
  const estimatedTotal = plan.reduce((sum, item) => sum + (treatmentById.get(item.treatmentId ?? "")?.price ?? 0), 0)

  function updatePlan(next: ProposedTreatment[]) {
    setValue("plan", next, { shouldDirty: true })
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Tratamientos propuestos</CardTitle>
          <CardDescription>
            Tratamientos sugeridos al paciente. Se agregan y se quitan con «Guardar cambios»; cuando se realizan, se
            registran en la atención.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <PlanItemForm treatments={activeTreatments ?? []} onAdd={(item) => updatePlan([...plan, item])} />

          {plan.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              No hay tratamientos propuestos. Agrégalos desde el catálogo.
            </div>
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pieza / zona</TableHead>
                    <TableHead>Tratamiento</TableHead>
                    <TableHead className="text-right">Precio</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {plan.map((item) => {
                    const treatment = item.treatmentId ? treatmentById.get(item.treatmentId) : undefined
                    const name = treatment?.name ?? item.description
                    return (
                      <TableRow key={item.id}>
                        <TableCell>{item.tooth || "General"}</TableCell>
                        <TableCell className="whitespace-normal">
                          <div className="font-medium">{name}</div>
                          {!item.treatmentId && <Badge variant="outline">Texto libre anterior</Badge>}
                        </TableCell>
                        <TableCell className="text-right">{treatment ? formatCurrency(treatment.price) : "—"}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Quitar ${name} de los propuestos`}
                            onClick={() => updatePlan(plan.filter((row) => row.id !== item.id))}
                          >
                            <Trash2 />
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {plan.length > 0 && (
            <p className="text-right text-sm text-muted-foreground">
              Total estimado: <span className="font-medium text-foreground">{formatCurrency(estimatedTotal)}</span>
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
