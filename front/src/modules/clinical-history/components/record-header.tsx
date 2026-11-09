import { ArrowLeft, FileWarning, Plus, ShieldAlert } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/shared/components/page-header"
import type { Patient } from "@/modules/patients/types/patient.types"

import type { ClinicalRecord } from "../types/clinical-history.types"
import { MedicalAlerts } from "./medical-alerts"

interface RecordHeaderProps {
  patient: Patient
  /** Historia guardada: los avisos y las alertas no cambian con lo que se edita sin guardar. */
  record: ClinicalRecord
  onBack: () => void
  onRegisterEncounter: () => void
}

export function RecordHeader({ patient, record, onBack, onRegisterEncounter }: RecordHeaderProps) {
  return (
    <div className="space-y-3">
      <div>
        <Button variant="ghost" size="sm" className="mb-2 -ml-2" onClick={onBack}>
          <ArrowLeft />
          Volver al paciente
        </Button>
        <PageHeader
          title="Historia clínica odontológica"
          description={`${patient.firstName} ${patient.lastName} · Cédula ${patient.documentId}${patient.clinicalRecordNumber ? ` · ${patient.clinicalRecordNumber}` : ""}`}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              {record.dataConsent.status === "pendiente" && (
                <Badge variant="outline" className="text-xs">
                  <ShieldAlert />
                  Consentimiento de datos pendiente
                </Badge>
              )}
              {!record.truthDeclaration.accepted && (
                <Badge variant="outline" className="text-xs">
                  <FileWarning />
                  Declaración de veracidad pendiente
                </Badge>
              )}
              <Button onClick={onRegisterEncounter}>
                <Plus />
                Registrar atención
              </Button>
            </div>
          }
        />
      </div>
      <MedicalAlerts source={record.allergiesAndMedication} />
    </div>
  )
}
