import { ArrowLeft, ShieldAlert } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/shared/components/page-header"
import type { Patient } from "@/modules/patients/types/patient.types"

interface RecordHeaderProps {
  patient: Patient
  /** El consentimiento de datos guardado sigue pendiente. */
  consentPending: boolean
  onBack: () => void
}

export function RecordHeader({ patient, consentPending, onBack }: RecordHeaderProps) {
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
          consentPending && (
            <Badge variant="outline" className="text-xs">
              <ShieldAlert />
              Consentimiento de datos pendiente
            </Badge>
          )
        }
      />
    </div>
  )
}
