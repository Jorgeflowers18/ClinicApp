import { useNavigate, useParams, useSearchParams } from "react-router-dom"
import { PageHeader } from "@/shared/components/page-header"
import { PatientForm } from "../components/patient-form"

/** Keep direct edit links and creation as full pages, using the same form as the dialog. */
export function PatientFormPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  return <div className="patient-editor">
    <PageHeader title={id ? "Editar paciente" : "Nuevo paciente"} description={id ? "Actualiza los datos del paciente sin alterar sus registros clínicos." : "Registra la información del paciente. Los campos con * son obligatorios."} />
    <PatientForm key={id ?? "new"} patientId={id} initialSection={searchParams.get("seccion")}
      onCancel={() => navigate(id ? `/pacientes/${id}` : "/pacientes")}
      onSaved={patient => navigate(`/pacientes/${patient.id}`)} />
  </div>
}
