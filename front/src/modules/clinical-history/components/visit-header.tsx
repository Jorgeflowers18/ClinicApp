import { useNavigate } from "react-router-dom"
import { ArrowLeft, Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PageHeader } from "@/shared/components/page-header"
import { formatDateOnly } from "@/shared/lib/date"
import type { Patient } from "@/modules/patients/types/patient.types"

import { compareVisits, findDraft } from "../lib/visit"
import { visitStatusLabels, type DentalRecord } from "../types/clinical-history.types"

interface VisitHeaderProps {
  patient: Patient
  record: DentalRecord
  selectedVisitId: string | undefined
  onSelectVisit: (visitId: string) => void
  onNewVisit: () => void
}

export function VisitHeader({ patient, record, selectedVisitId, onSelectVisit, onNewVisit }: VisitHeaderProps) {
  const navigate = useNavigate()
  const draft = findDraft(record)
  const visits = [...record.visits].sort(compareVisits).reverse()
  const visitItems = Object.fromEntries(
    visits.map((visit) => [
      visit.id,
      `${formatDateOnly(visit.date, { day: "2-digit", month: "short", year: "numeric" })} · ${visitStatusLabels[visit.status]}`,
    ])
  )

  return (
    <div>
      <Button variant="ghost" size="sm" className="mb-2 -ml-2" onClick={() => navigate(`/pacientes/${patient.id}`)}>
        <ArrowLeft />
        Volver al paciente
      </Button>
      <PageHeader
        title="Historia clínica odontológica"
        description={`${patient.firstName} ${patient.lastName} · Cédula ${patient.documentId}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {visits.length > 0 && (
              <Select
                items={visitItems}
                value={selectedVisitId ?? null}
                onValueChange={(value) => value && onSelectVisit(value)}
              >
                <SelectTrigger className="w-56" aria-label="Visita">
                  <SelectValue placeholder="Selecciona una visita" />
                </SelectTrigger>
                <SelectContent>
                  {visits.map((visit) => (
                    <SelectItem key={visit.id} value={visit.id}>
                      {visitItems[visit.id]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {draft ? (
              draft.id !== selectedVisitId && (
                <Button onClick={() => onSelectVisit(draft.id)}>Continuar borrador</Button>
              )
            ) : (
              <Button onClick={onNewVisit}>
                <Plus />
                Nueva visita
              </Button>
            )}
          </div>
        }
      />
    </div>
  )
}
