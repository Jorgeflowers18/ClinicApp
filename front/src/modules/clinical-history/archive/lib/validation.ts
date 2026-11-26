import type { FieldIssues } from "@/shared/lib/field-issues"
import type { ClinicalFileDraft } from "../types"
import { clinicalFileTypes } from "./classification"
/** Presentation validation only. The API remains authoritative for ownership and integrity. */
export function fileDraftIssues(value: ClinicalFileDraft): FieldIssues {
  const issues: FieldIssues = {}
  if (!value.displayName.trim() || value.displayName.length > 200) issues.displayName = "Escribe un nombre de hasta 200 caracteres."
  if (!clinicalFileTypes[value.clinicalType]) issues.clinicalType = "Selecciona el tipo clínico del archivo."
  if (value.studyDate) {
    const date = new Date(`${value.studyDate}T12:00:00Z`)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value.studyDate) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value.studyDate) issues.studyDate = "La fecha de estudio no es válida."
  }
  if (value.notes.length > 3000) issues.notes = "Las notas admiten hasta 3000 caracteres."
  if (value.zone.length > 150) issues.zone = "La zona admite hasta 150 caracteres."
  return issues
}
