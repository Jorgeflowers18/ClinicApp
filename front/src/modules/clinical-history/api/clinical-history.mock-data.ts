// MOCK-ONLY: eliminar al conectar el backend (ver arquitectura-frontend.md § Código solo-mock).
//
// Visitas de ejemplo: son los 4 registros del historial clínico clásico convertidos al modelo de
// visita. Sus planes apuntan a las asignaciones de ejemplo de `treatments.mock-data.ts`
// (asg_1..asg_3), así se ve la integración sin crear datos nuevos.
import type { DentalVisit } from "../types/clinical-history.types"

function seedVisit(visit: Omit<DentalVisit, "status" | "revision" | "appointmentId" | "chart" | "consents" | "attachments" | "updatedAt" | "closedAt" | "evolution" | "nextVisit"> & Partial<DentalVisit>): DentalVisit {
  return {
    status: "cerrada",
    revision: 0,
    appointmentId: null,
    chart: null,
    consents: [],
    attachments: [],
    evolution: "",
    nextVisit: "",
    updatedAt: visit.createdAt,
    closedAt: visit.createdAt,
    ...visit,
  }
}

const legacyFiles = (names: string[]) => `Adjuntos del registro anterior (sin archivo): ${names.join(", ")}.`

export const seedVisitsByPatient: Record<string, DentalVisit[]> = {
  pat_1: [
    seedVisit({
      id: "hist_1",
      patientId: "pat_1",
      professionalId: "prof_1",
      date: "2025-11-10",
      reason: "Dolor en molar inferior derecho.",
      diagnosis: "Caries profunda en pieza 46.",
      procedures: "Se realizó limpieza y se programó resina compuesta.",
      notes: legacyFiles(["radiografia-pieza46.jpg"]),
      plan: [
        { id: "plan_hist_1_1", treatmentId: "trt_4", description: "Resina compuesta", tooth: "46", sessions: 1, status: "pendiente", assignmentId: null },
      ],
      createdAt: "2025-11-10T09:30:00.000Z",
    }),
    seedVisit({
      id: "hist_2",
      patientId: "pat_1",
      professionalId: "prof_1",
      date: "2026-01-05",
      reason: "Control de rutina.",
      diagnosis: "Sin hallazgos relevantes.",
      procedures: "Limpieza dental preventiva realizada.",
      notes: "",
      plan: [
        { id: "plan_hist_2_1", treatmentId: "trt_1", description: "Limpieza dental", tooth: "", sessions: 1, status: "realizado", assignmentId: "asg_2" },
        { id: "plan_hist_2_2", treatmentId: "trt_4", description: "Resina compuesta", tooth: "46", sessions: 1, status: "pendiente", assignmentId: null },
      ],
      createdAt: "2026-01-05T10:00:00.000Z",
    }),
  ],
  pat_3: [
    seedVisit({
      id: "hist_3",
      patientId: "pat_3",
      professionalId: "prof_2",
      date: "2025-11-01",
      reason: "Evaluación para tratamiento de ortodoncia.",
      diagnosis: "Maloclusión clase II.",
      procedures: "Se inicia plan de ortodoncia con brackets metálicos.",
      notes: legacyFiles(["evaluacion-ortodoncia.pdf"]),
      plan: [
        { id: "plan_hist_3_1", treatmentId: "trt_2", description: "Ajuste de ortodoncia", tooth: "", sessions: 12, status: "en-curso", assignmentId: "asg_1" },
      ],
      createdAt: "2025-11-01T11:00:00.000Z",
    }),
  ],
  pat_4: [
    seedVisit({
      id: "hist_4",
      patientId: "pat_4",
      professionalId: "prof_3",
      date: "2026-02-01",
      reason: "Dolor intenso en pieza 36.",
      diagnosis: "Pulpitis irreversible.",
      procedures: "Se inicia tratamiento de endodoncia, primera sesión completada.",
      notes: legacyFiles(["radiografia-pieza36.jpg", "consentimiento-informado.pdf"]),
      plan: [
        { id: "plan_hist_4_1", treatmentId: "trt_3", description: "Endodoncia", tooth: "36", sessions: 3, status: "en-curso", assignmentId: "asg_3" },
      ],
      createdAt: "2026-02-01T14:00:00.000Z",
    }),
  ],
}
