import { ArrowLeft, Plus, ShieldAlert } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/shared/components/page-header"
import type { Patient } from "@/modules/patients/types/patient.types"

interface RecordHeaderProps {
  patient: Patient
  /** El consentimiento de datos guardado sigue pendiente. */
  consentPending: boolean
  /** El odontograma ya cargó: la atención necesita su copia. */
  canRegister: boolean
  onBack: () => void
  onRegisterEncounter: () => void
}

export function RecordHeader({ patient, consentPending, canRegister, onBack, onRegisterEncounter }: RecordHeaderProps) {
  return (
    <div>
      <Button variant="ghost" size="sm" className="mb-2 -ml-2" onClick={onBack}>
        <ArrowLeft />
        Volver al paciente
      </Button>
      <PageHeader
        title="Historia clínica odontológica"
        description={`${patient.firstName} ${patient.lastName} · Cédula ${patient.documentId}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {consentPending && (
              <Badge variant="outline" className="text-xs">
                <ShieldAlert />
                Consentimiento de datos pendiente
              </Badge>
            )}
            <Button disabled={!canRegister} onClick={onRegisterEncounter}>
              <Plus />
              Registrar atención
            </Button>
          </div>
        }
      />
    </div>
  )
}
