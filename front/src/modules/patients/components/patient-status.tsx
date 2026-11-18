import { Badge } from "@/components/ui/badge"
import { treatmentStatusLabels, type Patient } from "../types/patient.types"

export function PatientStatus({ status }: { status: Patient["treatmentStatus"] }) {
  return <Badge variant="outline" className="patient-status" data-status={status}>{treatmentStatusLabels[status] ?? "Sin registrar"}</Badge>
}
export function PatientInitials({ patient }: { patient: Pick<Patient, "firstName" | "lastName"> }) {
  return <span className="patient-initials" aria-hidden="true">{patient.firstName.trim()[0]}{patient.lastName.trim()[0]}</span>
}
