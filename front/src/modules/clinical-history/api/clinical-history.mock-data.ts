// MOCK-ONLY: eliminar al conectar el backend (ver arquitectura-frontend.md § Código solo-mock).
//
// Historias de ejemplo: los 4 registros del historial clínico clásico convertidos en atenciones.
// Sus tratamientos realizados apuntan a las asignaciones de ejemplo de `treatments.mock-data.ts`
// (asg_1..asg_3), así se ve la integración sin crear datos nuevos.
import { diagnosesFromText, emptyEncounterValues } from "../lib/encounter"
import type { ClinicalEncounter, PatientClinicalHistory, ProposedTreatment } from "../types/clinical-history.types"
import { emptyRecord } from "./clinical-history.mock-migration"

type SeedEncounter = Pick<
  ClinicalEncounter,
  "id" | "patientId" | "professionalId" | "date" | "reason" | "procedures" | "notes" | "performedTreatments" | "createdAt"
> & { diagnosis: string }

/** Atenciones anteriores a la evaluación por pasos: solo motivo, diagnóstico de texto y procedimientos. */
function seedEncounter({ diagnosis, ...encounter }: SeedEncounter): ClinicalEncounter {
  return {
    ...emptyEncounterValues(),
    chartSnapshot: null,
    clinicalSnapshot: null,
    addenda: [],
    ...encounter,
    diagnoses: diagnosesFromText(encounter.id, diagnosis),
  }
}

function seedHistory(patientId: string, encounters: ClinicalEncounter[], plan: ProposedTreatment[] = []): PatientClinicalHistory {
  const record = emptyRecord(patientId, encounters[0].createdAt)
  return { record: { ...record, plan, updatedAt: encounters.at(-1)!.createdAt }, encounters }
}

const legacyFiles = (names: string[]) => `Adjuntos del registro anterior (sin archivo): ${names.join(", ")}.`

export const seedHistoriesByPatient: Record<string, PatientClinicalHistory> = {
  pat_1: seedHistory(
    "pat_1",
    [
      seedEncounter({
        id: "hist_1",
        patientId: "pat_1",
        professionalId: "prof_1",
        date: "2025-11-10",
        reason: "Dolor en molar inferior derecho.",
        diagnosis: "Caries profunda en pieza 46.",
        procedures: "Se realizó limpieza y se programó resina compuesta.",
        notes: legacyFiles(["radiografia-pieza46.jpg"]),
        performedTreatments: [],
        createdAt: "2025-11-10T09:30:00.000Z",
      }),
      seedEncounter({
        id: "hist_2",
        patientId: "pat_1",
        professionalId: "prof_1",
        date: "2026-01-05",
        reason: "Control de rutina.",
        diagnosis: "Sin hallazgos relevantes.",
        procedures: "Limpieza dental preventiva realizada.",
        notes: "",
        performedTreatments: [
          { id: "plan_hist_2_1", treatmentId: "trt_1", description: "Limpieza dental", tooth: "", cost: 35, assignmentId: "asg_2" },
        ],
        createdAt: "2026-01-05T10:00:00.000Z",
      }),
    ],
    [{ id: "plan_hist_2_2", treatmentId: "trt_4", description: "Resina compuesta", tooth: "46", phase: "restauradora", plannedDate: "" }]
  ),
  pat_3: seedHistory("pat_3", [
    seedEncounter({
      id: "hist_3",
      patientId: "pat_3",
      professionalId: "prof_2",
      date: "2025-11-01",
      reason: "Evaluación para tratamiento de ortodoncia.",
      diagnosis: "Maloclusión clase II.",
      procedures: "Se inicia plan de ortodoncia con brackets metálicos.",
      notes: legacyFiles(["evaluacion-ortodoncia.pdf"]),
      performedTreatments: [
        { id: "plan_hist_3_1", treatmentId: "trt_2", description: "Ajuste de ortodoncia", tooth: "", cost: 40, assignmentId: "asg_1" },
      ],
      createdAt: "2025-11-01T11:00:00.000Z",
    }),
  ]),
  pat_4: seedHistory("pat_4", [
    seedEncounter({
      id: "hist_4",
      patientId: "pat_4",
      professionalId: "prof_3",
      date: "2026-02-01",
      reason: "Dolor intenso en pieza 36.",
      diagnosis: "Pulpitis irreversible.",
      procedures: "Se inicia tratamiento de endodoncia, primera sesión completada.",
      notes: legacyFiles(["radiografia-pieza36.jpg", "consentimiento-informado.pdf"]),
      performedTreatments: [
        { id: "plan_hist_4_1", treatmentId: "trt_3", description: "Endodoncia", tooth: "36", cost: 120, assignmentId: "asg_3" },
      ],
      createdAt: "2026-02-01T14:00:00.000Z",
    }),
  ]),
}
