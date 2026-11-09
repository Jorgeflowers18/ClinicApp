import { Trash2 } from "lucide-react"
import { useFormContext, useWatch } from "react-hook-form"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatCurrency } from "@/shared/lib/number"
import { useActiveTreatments, useTreatmentsList } from "@/modules/treatments/api/treatments.queries"

import { groupPlanByPhase, NO_PHASE, phaseItems } from "../lib/plan"
import { today, type ProposedTreatment, type RecordFormValues, type TreatmentPhase } from "../types/clinical-history.types"
import { PlanItemForm } from "./plan-item-form"

export function TreatmentPlanTab() {
  const { control, setValue } = useFormContext<RecordFormValues>()
  const plan = useWatch({ control, name: "plan" })
  const { data: activeTreatments } = useActiveTreatments()
  // Catálogo completo (incluye inactivos) para mostrar nombre y precio de ítems antiguos.
  const { data: catalog } = useTreatmentsList({ page: 1, pageSize: 100 })

  const treatmentById = new Map((catalog?.items ?? activeTreatments ?? []).map((treatment) => [treatment.id, treatment]))
  const priceOf = (item: ProposedTreatment) => treatmentById.get(item.treatmentId ?? "")?.price ?? 0
  const estimatedTotal = plan.reduce((sum, item) => sum + priceOf(item), 0)
  const groups = groupPlanByPhase(plan)

  function updatePlan(next: ProposedTreatment[]) {
    setValue("plan", next, { shouldDirty: true })
  }

  function updateItem(id: string, change: Partial<ProposedTreatment>) {
    updatePlan(plan.map((item) => (item.id === id ? { ...item, ...change } : item)))
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Plan de tratamiento por fases</CardTitle>
          <CardDescription>
            Tratamientos propuestos al paciente, agrupados por fase. Se agregan y se quitan con «Guardar cambios»;
            cuando se realizan, se registran en la atención y salen del plan.
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
              <Table aria-label="Tratamientos propuestos">
                <TableHeader>
                  <TableRow>
                    <TableHead>Pieza / zona</TableHead>
                    <TableHead>Tratamiento</TableHead>
                    <TableHead className="w-56">Fase</TableHead>
                    <TableHead className="w-40">Fecha prevista</TableHead>
                    <TableHead className="text-right">Precio</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                {groups.map((group) => (
                  <TableBody key={group.phase || "sin-fase"} aria-label={`Fase: ${group.label}`}>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableCell colSpan={4} className="font-medium">
                        {group.label}
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium">
                        {formatCurrency(group.items.reduce((sum, item) => sum + priceOf(item), 0))}
                      </TableCell>
                      <TableCell />
                    </TableRow>
                    {group.items.map((item) => {
                      const treatment = item.treatmentId ? treatmentById.get(item.treatmentId) : undefined
                      const name = treatment?.name ?? item.description
                      return (
                        <TableRow key={item.id}>
                          <TableCell>{item.tooth || "General"}</TableCell>
                          <TableCell className="whitespace-normal">
                            <div className="font-medium">{name}</div>
                            {!item.treatmentId && <Badge variant="outline">Texto libre anterior</Badge>}
                          </TableCell>
                          <TableCell>
                            <Select
                              items={phaseItems}
                              value={item.phase || NO_PHASE}
                              onValueChange={(value) =>
                                updateItem(item.id, { phase: !value || value === NO_PHASE ? "" : (value as TreatmentPhase) })
                              }
                            >
                              <SelectTrigger className="w-full" aria-label={`Fase de ${name}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Object.entries(phaseItems).map(([value, label]) => (
                                  <SelectItem key={value} value={value}>
                                    {label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="date"
                              min={today()}
                              aria-label={`Fecha prevista de ${name}`}
                              value={item.plannedDate}
                              onChange={(event) => updateItem(item.id, { plannedDate: event.target.value })}
                            />
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
                ))}
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={4}>Total estimado</TableCell>
                    <TableCell className="text-right">{formatCurrency(estimatedTotal)}</TableCell>
                    <TableCell />
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
