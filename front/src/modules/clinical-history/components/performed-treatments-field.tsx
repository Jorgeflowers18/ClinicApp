import { useState } from "react"
import { Plus, Trash2 } from "lucide-react"
import { useFormContext, useWatch } from "react-hook-form"

import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldError, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { createId } from "@/shared/lib/id"
import { formatCurrency } from "@/shared/lib/number"
import { useActiveTreatments } from "@/modules/treatments/api/treatments.queries"

import type { EncounterFormValues, PerformedTreatment, ProposedTreatment } from "../types/clinical-history.types"

interface PerformedTreatmentsFieldProps {
  /** Tratamientos propuestos de la historia: se ofrecen como atajo y conservan su id al agregarse. */
  proposed: ProposedTreatment[]
}

/**
 * Tratamientos realizados en la atención, siempre del catálogo de tratamientos activos. El costo es
 * el precio del catálogo y queda guardado en la atención. No es un `<form>` propio porque vive dentro
 * del formulario de la atención.
 */
export function PerformedTreatmentsField({ proposed }: PerformedTreatmentsFieldProps) {
  const { control, setValue } = useFormContext<EncounterFormValues>()
  const performed = useWatch({ control, name: "performedTreatments" })
  const { data: activeTreatments } = useActiveTreatments()
  const [treatmentId, setTreatmentId] = useState("")
  const [tooth, setTooth] = useState("")
  const [error, setError] = useState("")

  const catalog = activeTreatments ?? []
  const treatmentById = new Map(catalog.map((treatment) => [treatment.id, treatment]))
  const treatmentItems = Object.fromEntries(catalog.map((treatment) => [treatment.id, treatment.name]))
  const addedIds = new Set(performed.map((item) => item.id))
  const shortcuts = proposed.filter((item) => !addedIds.has(item.id))
  const total = performed.reduce((sum, item) => sum + item.cost, 0)

  function add(item: PerformedTreatment) {
    setValue("performedTreatments", [...performed, item], { shouldDirty: true })
  }

  function addFromCatalog() {
    const treatment = treatmentById.get(treatmentId)
    if (!treatment) {
      setError("Selecciona un tratamiento del catálogo")
      return
    }
    if (tooth.trim().length > 60) {
      setError("La pieza o zona admite máximo 60 caracteres")
      return
    }
    add({ id: createId(), treatmentId: treatment.id, description: treatment.name, tooth: tooth.trim(), cost: treatment.price, assignmentId: null })
    setTreatmentId("")
    setTooth("")
    setError("")
  }

  /** El id del propuesto se conserva: al guardar la atención, sale de la lista de propuestos. */
  function addProposed(item: ProposedTreatment) {
    const treatment = item.treatmentId ? treatmentById.get(item.treatmentId) : undefined
    if (!treatment) return
    add({ id: item.id, treatmentId: treatment.id, description: treatment.name, tooth: item.tooth, cost: treatment.price, assignmentId: null })
  }

  return (
    <FieldSet>
      <FieldLegend>Tratamientos realizados</FieldLegend>
      <FieldDescription>
        Cada tratamiento se registra con el precio del catálogo y descuenta sus insumos. Se puede registrar aunque el
        paciente tenga saldos pendientes.
      </FieldDescription>

      {shortcuts.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Tratamientos propuestos en la historia</p>
          <div className="flex flex-wrap gap-2">
            {shortcuts.map((item) => {
              const treatment = item.treatmentId ? treatmentById.get(item.treatmentId) : undefined
              return (
                <Button
                  key={item.id}
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={!treatment}
                  title={treatment ? undefined : "Inactivo en el catálogo o de texto libre: agrégalo desde el catálogo"}
                  onClick={() => addProposed(item)}
                >
                  <Plus />
                  {treatment?.name ?? item.description}
                  {item.tooth && ` (${item.tooth})`}
                  {treatment && ` · ${formatCurrency(treatment.price)}`}
                </Button>
              )
            })}
          </div>
        </div>
      )}

      <div className="grid gap-3 rounded-lg border bg-muted/30 p-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto] md:items-start">
        <Field data-invalid={!!error}>
          <FieldLabel htmlFor="performed-treatment">Tratamiento del catálogo</FieldLabel>
          <Select
            items={treatmentItems}
            value={treatmentId || null}
            onValueChange={(value) => {
              setTreatmentId(value ?? "")
              setError("")
            }}
          >
            <SelectTrigger id="performed-treatment" className="w-full" aria-invalid={!!error}>
              <SelectValue placeholder="Selecciona un tratamiento..." />
            </SelectTrigger>
            <SelectContent>
              {catalog.map((treatment) => (
                <SelectItem key={treatment.id} value={treatment.id}>
                  {treatment.name} · {formatCurrency(treatment.price)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldError errors={error ? [{ message: error }] : undefined} />
        </Field>
        <Field>
          <FieldLabel htmlFor="performed-tooth">Pieza / zona</FieldLabel>
          <Input
            id="performed-tooth"
            placeholder="Ej. 36 o arcada superior"
            value={tooth}
            onChange={(event) => setTooth(event.target.value)}
          />
        </Field>
        <Button type="button" variant="outline" className="md:mt-6" onClick={addFromCatalog}>
          <Plus />
          Agregar
        </Button>
      </div>

      {performed.length === 0 ? (
        <p className="text-sm text-muted-foreground">No se registraron tratamientos en esta atención.</p>
      ) : (
        <div className="rounded-lg border">
          <Table aria-label="Tratamientos realizados">
            <TableHeader>
              <TableRow>
                <TableHead>Pieza / zona</TableHead>
                <TableHead>Tratamiento</TableHead>
                <TableHead className="text-right">Costo</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {performed.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.tooth || "General"}</TableCell>
                  <TableCell className="whitespace-normal font-medium">{item.description}</TableCell>
                  <TableCell className="text-right">{formatCurrency(item.cost)}</TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Quitar ${item.description}`}
                      onClick={() =>
                        setValue(
                          "performedTreatments",
                          performed.filter((row) => row.id !== item.id),
                          { shouldDirty: true }
                        )
                      }
                    >
                      <Trash2 />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={2}>Total de la atención</TableCell>
                <TableCell className="text-right">{formatCurrency(total)}</TableCell>
                <TableCell />
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      )}
    </FieldSet>
  )
}
