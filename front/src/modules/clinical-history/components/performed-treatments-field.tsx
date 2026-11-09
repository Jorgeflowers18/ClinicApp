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

import { sumCosts } from "../lib/record"
import type { EncounterFormValues, PerformedTreatment, ProposedTreatment } from "../types/clinical-history.types"

interface PerformedTreatmentsFieldProps {
  /** Tratamientos propuestos de la historia: se ofrecen como atajo y conservan su id al agregarse. */
  proposed: ProposedTreatment[]
}

interface CostInputProps {
  index: number
  item: PerformedTreatment
  catalogPrice: number | undefined
}

/** Costo editable de un tratamiento realizado. Muestra el precio del catálogo si se ajustó. */
function CostInput({ index, item, catalogPrice }: CostInputProps) {
  const { setValue, formState } = useFormContext<EncounterFormValues>()
  const error = formState.errors.performedTreatments?.[index]?.cost
  const adjusted = catalogPrice !== undefined && Number.isFinite(item.cost) && item.cost !== catalogPrice

  return (
    <div className="ml-auto flex w-32 flex-col items-end gap-1">
      <div className="relative w-full">
        <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-sm text-muted-foreground">$</span>
        <Input
          type="number"
          inputMode="decimal"
          min={0}
          step="0.01"
          className="pl-6 text-right"
          aria-label={`Costo de ${item.description}`}
          aria-invalid={!!error}
          value={Number.isNaN(item.cost) ? "" : item.cost}
          onChange={(event) =>
            setValue(
              `performedTreatments.${index}.cost`,
              event.target.value === "" ? Number.NaN : Number(event.target.value),
              // Si ya se mostró un error, se vuelve a validar al corregir.
              { shouldDirty: true, shouldValidate: Boolean(error) }
            )
          }
        />
      </div>
      {error ? (
        <p className="text-xs text-destructive">{error.message}</p>
      ) : (
        adjusted && <p className="text-xs text-muted-foreground">Catálogo: {formatCurrency(catalogPrice)}</p>
      )}
    </div>
  )
}

/**
 * Tratamientos realizados en la atención, siempre del catálogo de tratamientos activos. El costo
 * parte del precio del catálogo y se puede ajustar; queda guardado en la atención y en Tratamientos.
 * No es un `<form>` propio porque vive dentro del formulario de la atención.
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
  const total = sumCosts(performed)

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
        Cada tratamiento se agrega con el precio del catálogo; el costo se puede ajustar (por ejemplo, un descuento) y
        es el que se cobra en Finanzas. Descuenta sus insumos y se puede registrar aunque el paciente tenga saldos
        pendientes.
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
              {performed.map((item, index) => (
                <TableRow key={item.id}>
                  <TableCell className="align-top">{item.tooth || "General"}</TableCell>
                  <TableCell className="whitespace-normal align-top font-medium">{item.description}</TableCell>
                  <TableCell className="text-right align-top">
                    <CostInput index={index} item={item} catalogPrice={treatmentById.get(item.treatmentId ?? "")?.price} />
                  </TableCell>
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
