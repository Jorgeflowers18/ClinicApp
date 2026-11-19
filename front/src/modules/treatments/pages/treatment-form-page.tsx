import { useNavigate, useParams } from "react-router-dom"
import { TreatmentFormDialog } from "../components/treatment-form-dialog"
import { TreatmentDetailPage } from "./treatment-detail-page"
import { TreatmentsListPage } from "./treatments-list-page"

/** Preserve direct URLs while presenting the same editor over its catalogue or detail. */
export function TreatmentFormPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  return <>{id ? <TreatmentDetailPage /> : <TreatmentsListPage />}
    <TreatmentFormDialog key={id ?? "new"} treatmentId={id} onClose={() => navigate(id ? `/tratamientos/${id}` : "/tratamientos", { replace: true })} />
  </>
}