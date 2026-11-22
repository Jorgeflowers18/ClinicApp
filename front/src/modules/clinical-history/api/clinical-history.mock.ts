// MOCK-ONLY: eliminar al conectar el backend (ver arquitectura-frontend.md § Código solo-mock).
import { createId } from "@/shared/lib/id"
import { getErrorMessage } from "@/shared/lib/error-message"
import { mockDelay, paginate } from "@/shared/lib/mock"
import { ApiError } from "@/shared/types/common"
import { mockPatients } from "@/modules/patients/api/patients.mock-data"
import { appointmentsApi } from "@/modules/appointments/api/appointments.api"
import { treatmentsApi } from "@/modules/treatments/api/treatments.api"

import type { ClinicalHistoryApi, RegisterEncounterInput, RegisterEncounterResult } from "./clinical-history.contract"
import { diagnosisSummary, encounterFormSchema } from "../types/clinical-history.types"
import type {
  ClinicalEncounter,
  ClinicalRecord,
  CreateEncounterInput,
  DentalAttachment,
  EncounterListItem,
  EncounterNote,
  ExamRequest,
  PerformedTreatment,
} from "../types/clinical-history.types"
import { compareEncounters, validateRecord, validateWith } from "../lib/record"
import { assertAttachment } from "../lib/attachments"
import { readAllHistories, readFile, readHistory, seedOnce, storeFile, writeHistory } from "./clinical-history.mock-storage"
import { seedHistoriesByPatient } from "./clinical-history.mock-data"

const ensureSeeded = () => seedOnce(seedHistoriesByPatient)

function toListItem(encounter: ClinicalEncounter): EncounterListItem {
  return {
    id: encounter.id,
    patientId: encounter.patientId,
    date: encounter.date,
    professionalId: encounter.professionalId,
    legacyProfessionalName: encounter.legacyProfessionalName,
    reason: encounter.reason,
    diagnoses: encounter.diagnoses,
    nextVisit: encounter.nextVisit,
  }
}

async function saveRecord(record: ClinicalRecord): Promise<ClinicalRecord> {
  await mockDelay(250)
  const fieldErrors = validateRecord(record)
  if (fieldErrors.length) throw new ApiError("Revisa los datos de la historia antes de guardar", 400, fieldErrors)
  let saved: ClinicalRecord | undefined
  await writeHistory(record.patientId, (history) => {
    if (history.record.revision !== record.revision) {
      throw new ApiError("Otra pestaña o usuario modificó esta historia. Recarga la historia antes de continuar.", 409)
    }
    saved = { ...record, revision: record.revision + 1, updatedAt: new Date().toISOString() }
    return { ...history, record: saved }
  })
  return saved as ClinicalRecord
}

/** Idempotente por `input.id`: reintentar el guardado de la misma atención no la duplica. */
async function createEncounter(patientId: string, input: CreateEncounterInput): Promise<ClinicalEncounter> {
  await mockDelay(300)
  const fieldErrors = validateWith(encounterFormSchema, input)
  if (fieldErrors.length) throw new ApiError("Completa los datos obligatorios de la atención", 400, fieldErrors)
  let created: ClinicalEncounter | undefined
  await writeHistory(patientId, (history) => {
    const existing = history.encounters.find((encounter) => encounter.id === input.id)
    if (existing) {
      created = existing
      return history
    }
    if (input.appointmentId && history.encounters.some((encounter) => encounter.appointmentId === input.appointmentId)) {
      throw new ApiError("Esa cita ya está vinculada a otra atención del paciente", 409, [
        { field: "appointmentId", message: "La cita ya está vinculada a otra atención" },
      ])
    }
    created = { ...input, patientId, addenda: [], createdAt: new Date().toISOString() }
    return { ...history, encounters: [...history.encounters, created].sort(compareEncounters) }
  })
  return created as ClinicalEncounter
}

/** Exámenes solicitados en la atención, como requerimientos pendientes de la historia. */
function examRequestsOf(encounter: ClinicalEncounter): ExamRequest[] {
  return encounter.requestedExams.map((exam) => ({
    id: exam.id,
    kind: exam.kind,
    detail: exam.detail,
    status: "pendiente",
    encounterId: encounter.id,
    requestedAt: encounter.date,
    attachmentId: null,
    receivedAt: null,
  }))
}

/**
 * Lo que con la API hace `POST …/encounters/register` en una transacción, aquí por pasos:
 * 1. registra cada tratamiento realizado (ya completado; descuenta insumos y aparece en Finanzas).
 *    Idempotente por atención + tratamiento: un reintento no lo duplica;
 * 2. crea la atención con las copias y los tratamientos (idempotente por `encounter.id`);
 * 3. en la historia, quita los propuestos registrados y agrega los exámenes solicitados como pendientes
 *    (no fatal: la atención ya quedó registrada);
 * 4. pasa la cita vinculada a "completada" (no fatal).
 */
async function registerEncounter(patientId: string, input: RegisterEncounterInput): Promise<RegisterEncounterResult> {
  const warnings: string[] = []
  const current = input.record
  let saved: ClinicalRecord | null = null

  const performedTreatments: PerformedTreatment[] = []
  for (const item of input.encounter.performedTreatments) {
    if (item.assignmentId || !item.treatmentId) {
      performedTreatments.push(item)
      continue
    }
    const assignment = await treatmentsApi.createAssignment({
      treatmentId: item.treatmentId,
      patientId,
      date: input.encounter.date,
      tooth: item.tooth,
      sourceEncounterId: input.encounter.id,
      sourceKey: `${input.encounter.id}:${item.id}`,
      price: item.cost,
    })
    performedTreatments.push({ ...item, assignmentId: assignment.id })
  }

  const encounter = await createEncounter(patientId, { ...input.encounter, performedTreatments })

  const usedIds = new Set(performedTreatments.map((item) => item.id))
  const existingRequests = new Set(current.examRequests.map((item) => item.id))
  const newRequests = examRequestsOf(encounter).filter((item) => !existingRequests.has(item.id))
  if (current.plan.some((item) => usedIds.has(item.id)) || newRequests.length) {
    try {
      saved = await saveRecord({
        ...current,
        plan: current.plan.filter((item) => !usedIds.has(item.id)),
        examRequests: [...current.examRequests, ...newRequests],
      })
    } catch (error) {
      warnings.push(`La atención se registró, pero no se actualizaron los propuestos ni los exámenes solicitados de la historia: ${getErrorMessage(error)}`)
    }
  }

  let appointmentCompleted = false
  if (encounter.appointmentId) {
    try {
      const appointment = await appointmentsApi.get(encounter.appointmentId)
      if (appointment.status === "programada" || appointment.status === "confirmada") {
        await appointmentsApi.updateStatus(appointment.id, "completada")
        appointmentCompleted = true
      } else if (appointment.status === "cancelada" || appointment.status === "no_asistio") {
        warnings.push("La cita vinculada está cancelada o marcada como no asistida; no se cambió su estado.")
      }
    } catch (error) {
      warnings.push(`La atención se registró, pero no se pudo actualizar la cita: ${getErrorMessage(error)}`)
    }
  }

  return { encounter, record: saved, appointmentCompleted, warnings }
}

export const mockClinicalHistoryApi: ClinicalHistoryApi = {
  async listEncounters(query) {
    await mockDelay(250)
    await ensureSeeded()
    const search = query.search?.trim().toLowerCase()
    const encounters = (await readAllHistories())
      .flatMap((history) => history.encounters)
      .filter((encounter) => !query.patientId || encounter.patientId === query.patientId)
      .filter((encounter) => !query.professionalId || encounter.professionalId === query.professionalId)
      .filter((encounter) => {
        if (!search) return true
        const patient = mockPatients.find((item) => item.id === encounter.patientId)
        return [encounter.reason, diagnosisSummary(encounter), patient?.firstName, patient?.lastName, patient?.documentId]
          .join(" ")
          .toLowerCase()
          .includes(search)
      })
      .sort((a, b) => compareEncounters(b, a))
    return paginate(encounters.map(toListItem), query)
  },
  async getRecord(patientId) {
    await mockDelay(200)
    await ensureSeeded()
    return readHistory(patientId)
  },
  saveRecord,
  registerEncounter,
  async addEncounterNote(patientId, encounterId, input) {
    await mockDelay(250)
    if (input.text.trim().length < 10) {
      throw new ApiError("La nota debe tener al menos 10 caracteres", 400, [{ field: "text", message: "Mínimo 10 caracteres" }])
    }
    const note: EncounterNote = { id: createId(), text: input.text.trim(), authorName: input.authorName, createdAt: new Date().toISOString() }
    await writeHistory(patientId, (history) => {
      if (!history.encounters.some((encounter) => encounter.id === encounterId)) throw new ApiError("Atención no encontrada", 404)
      return {
        ...history,
        encounters: history.encounters.map((encounter) =>
          encounter.id === encounterId ? { ...encounter, addenda: [...encounter.addenda, note] } : encounter
        ),
      }
    })
    return note
  },
  async uploadAttachment(input) {
    await mockDelay(200)
    assertAttachment(input.file)
    const attachment: DentalAttachment = {
      id: createId(),
      name: input.file.name,
      kind: input.kind,
      mime: input.file.type,
      size: input.file.size,
      createdAt: new Date().toISOString(),
    }
    await storeFile(input.patientId, attachment.id, input.file)
    return attachment
  },
  async getAttachmentFile(patientId, attachmentId) {
    return readFile(patientId, attachmentId)
  },
}
