import { Badge } from "@/components/ui/badge"
import { assignmentStatusLabels, type TreatmentAssignment } from "../types/treatment.types"

export function TreatmentSessionProgress({ assignment }: { assignment: TreatmentAssignment }) {
  const { completedSessions: done, totalSessions: total, status } = assignment
  const valid = Number.isInteger(done) && Number.isInteger(total) && total > 0 && done >= 0 && done <= total
  const singleCompleted = total === 1 && done === 1 && status === "completado"
  return <div className="treatment-sessions" data-status={status}>
    <span>{Number.isFinite(done) ? done : "—"} de {Number.isFinite(total) ? total : "—"} {total === 1 ? "sesión" : "sesiones"}</span>
    {valid && !singleCompleted && <div role="progressbar" aria-label="Sesiones realizadas" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done}
      aria-valuetext={`${done} de ${total} sesiones`} className="treatment-session-track"><span style={{ width: `${done / total * 100}%` }} /></div>}
    <Badge variant="outline" className="treatment-assignment-status">{singleCompleted ? "Realizado" : assignmentStatusLabels[status]}</Badge>
  </div>
}
