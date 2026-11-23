import { useMemo, useState } from "react"
import { Combobox } from "@base-ui/react/combobox"
import { CheckIcon, ChevronDownIcon, LoaderCircle, XIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { useDebounce } from "@/shared/hooks/use-debounce"

import { usePatient, usePatientsList } from "../api/patients.queries"
import type { Patient } from "../types/patient.types"
import styles from "./patient-combobox.module.css"

/** Cuántos pacientes muestra cada búsqueda. Para encontrar a otro, se afina la búsqueda. */
const RESULTS = 20

const fullName = (patient: Pick<Patient, "firstName" | "lastName">) => `${patient.firstName} ${patient.lastName}`.trim()

interface PatientComboboxProps {
  /** Id del paciente elegido, o "" si no hay. */
  value: string
  onChange: (patientId: string) => void
  id?: string
  placeholder?: string
  /** Nombre accesible si el campo no tiene `<label for>`. */
  ariaLabel?: string
  invalid?: boolean
  disabled?: boolean
  /** Con botón para quitar la selección (por ejemplo, en un filtro "Todos los pacientes"). */
  clearable?: boolean
  className?: string
}

/**
 * Selector de paciente que busca en el servidor (`GET /patients?search=`, nombres, documento, teléfono o N.° de
 * historia): sirve con cualquier cantidad de pacientes, no solo con los primeros 100. El paciente elegido se
 * lee aparte (`usePatient`), así se muestra aunque no esté entre los resultados.
 */
export function PatientCombobox({ value, onChange, id, placeholder = "Busca un paciente…", ariaLabel, invalid, disabled, clearable, className }: PatientComboboxProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const debouncedSearch = useDebounce(search.trim(), 300)
  const results = usePatientsList({ page: 1, pageSize: RESULTS, search: debouncedSearch }, { enabled: open })
  const selected = usePatient(value || undefined)

  const found = results.data?.items
  const selectedPatient = value ? found?.find(patient => patient.id === value) ?? selected.data ?? null : null
  const items = useMemo(() => {
    const list = found ?? []
    return selectedPatient && !list.some(patient => patient.id === selectedPatient.id) ? [selectedPatient, ...list] : list
  }, [found, selectedPatient])

  const searching = results.isFetching || search.trim() !== debouncedSearch
  const more = results.data && results.data.totalItems > results.data.items.length
  const status = results.isError ? "No se pudieron buscar los pacientes."
    : searching ? "Buscando…"
    : found && found.length === 0 ? (debouncedSearch ? `Ningún paciente coincide con "${debouncedSearch}".` : "No hay pacientes registrados.")
    : more ? `Se muestran ${found?.length} de ${results.data?.totalItems}. Escribe para afinar la búsqueda.`
    : null

  return (
    <Combobox.Root<Patient>
      items={items}
      value={selectedPatient}
      onValueChange={patient => { onChange(patient?.id ?? ""); setSearch("") }}
      onInputValueChange={(text, { reason }) => { if (reason !== "item-press") setSearch(text) }}
      open={open}
      onOpenChange={next => { setOpen(next); if (!next) setSearch("") }}
      itemToStringLabel={fullName}
      isItemEqualToValue={(item, current) => item.id === current.id}
      filter={null}
      disabled={disabled}
    >
      <Combobox.InputGroup className={cn(styles.group, className)} data-invalid={invalid || undefined}>
        <Combobox.Input
          id={id}
          aria-label={ariaLabel}
          aria-invalid={invalid || undefined}
          placeholder={value && selected.isPending ? "Cargando paciente…" : placeholder}
          className={styles.input}
        />
        {clearable && value && <Combobox.Clear className={styles.button} aria-label="Quitar paciente"><XIcon aria-hidden="true" /></Combobox.Clear>}
        <Combobox.Trigger className={styles.button} aria-label="Abrir lista de pacientes"><ChevronDownIcon aria-hidden="true" /></Combobox.Trigger>
      </Combobox.InputGroup>
      <Combobox.Portal>
        <Combobox.Positioner className="isolate z-50" sideOffset={4} align="start">
          <Combobox.Popup className={styles.popup} aria-busy={searching || undefined}>
            <Combobox.Status className={styles.status}>
              {status && <>{searching && <LoaderCircle aria-hidden="true" className={styles.spinner} />}{status}</>}
            </Combobox.Status>
            <Combobox.List className={styles.list}>
              {(patient: Patient) => (
                <Combobox.Item key={patient.id} value={patient} className={styles.item}>
                  <span className={styles.itemText}>
                    <span className={styles.itemName}>{fullName(patient)}</span>
                    {patient.documentId && <span className={styles.itemMeta}>{patient.documentId}</span>}
                  </span>
                  <Combobox.ItemIndicator className={styles.indicator}><CheckIcon aria-hidden="true" /></Combobox.ItemIndicator>
                </Combobox.Item>
              )}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  )
}
