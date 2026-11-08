import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query"

import { queryClient } from "@/shared/lib/query-client"
import { getErrorMessage } from "@/shared/lib/error-message"
import { appointmentsApi } from "@/modules/appointments/api/appointments.api"
import { appointmentsKeys } from "@/modules/appointments/api/appointments.queries"
import { treatmentsApi } from "@/modules/treatments/api/treatments.api"
import { treatmentsKeys } from "@/modules/treatments/api/treatments.queries"
import { inventoryKeys } from "@/modules/inventory/api/inventory.queries"
import { financeKeys } from "@/modules/finance/api/finance.queries"

import { clinicalHistoryApi } from "./clinical-history.api"
import type {
  AddEncounterNoteInput,
  ClinicalEncounter,
  ClinicalRecord,
  CreateEncounterInput,
  DentalAttachment,
  EncounterListQuery,
  EncounterNote,
  ExamRequest,
  PatientClinicalHistory,
  PerformedTreatment,
  UploadAttachmentInput,
} from "../types/clinical-history.types"

export const clinicalHistoryKeys = {
  all: ["clinical-history"] as const,
  encounters: () => [...clinicalHistoryKeys.all, "encounters"] as const,
  encounterList: (query: EncounterListQuery) => [...clinicalHistoryKeys.encounters(), query] as const,
  record: (patientId: string) => [...clinicalHistoryKeys.all, "record", patientId] as const,
  file: (patientId: string, attachmentId: string) => [...clinicalHistoryKeys.all, "file", patientId, attachmentId] as const,
}

export function useEncountersList(query: EncounterListQuery, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: clinicalHistoryKeys.encounterList(query),
    queryFn: () => clinicalHistoryApi.listEncounters(query),
    placeholderData: keepPreviousData,
    enabled: options?.enabled ?? true,
  })
}

/** Historia del paciente: `{ record, encounters }`. */
export function useClinicalHistory(patientId: string | undefined) {
  return useQuery({
    queryKey: clinicalHistoryKeys.record(patientId ?? ""),
    queryFn: () => clinicalHistoryApi.getRecord(patientId as string),
    enabled: Boolean(patientId),
    // Los conflictos se detectan por revisión al guardar; refetch al enfocar pisaría los cambios en edición.
    refetchOnWindowFocus: false,
  })
}

export function useAttachmentFile(patientId: string, attachment: DentalAttachment, enabled: boolean) {
  return useQuery({
    queryKey: clinicalHistoryKeys.file(patientId, attachment.id),
    queryFn: () => clinicalHistoryApi.getAttachmentFile(patientId, attachment.id),
    enabled,
    staleTime: Infinity,
  })
}

/** Reemplaza la historia editable en la caché sin volver a pedirla (las atenciones no cambian). */
function updateCachedRecord(record: ClinicalRecord) {
  queryClient.setQueryData<PatientClinicalHistory>(clinicalHistoryKeys.record(record.patientId), (history) =>
    history ? { ...history, record } : history
  )
}

export function useSaveRecord() {
  return useMutation({
    mutationFn: (record: ClinicalRecord) => clinicalHistoryApi.saveRecord(record),
    onSuccess: updateCachedRecord,
  })
}

export interface RegisterEncounterInput {
  /** Historia guardada (con la revisión que se leyó): la atención copia su odontograma y sus alertas. */
  record: ClinicalRecord
  encounter: CreateEncounterInput
}

export interface RegisterEncounterResult {
  encounter: ClinicalEncounter
  /** Última versión guardada de la historia, si la secuencia la guardó (propuestos usados o exámenes solicitados). */
  record: ClinicalRecord | null
  appointmentCompleted: boolean
  warnings: string[]
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
 * Registro de una atención coordinado desde el frontend (mismo criterio que citas → notificaciones).
 * La historia debe estar guardada: la atención copia su odontograma y sus alertas.
 * 1. registra cada tratamiento realizado en Tratamientos (ya completado; descuenta insumos y aparece
 *    en Finanzas). Idempotente por atención + tratamiento: un reintento no lo duplica;
 * 2. crea la atención con las copias y los tratamientos (idempotente por `encounter.id`);
 * 3. en la historia, quita los tratamientos propuestos que se registraron y agrega los exámenes
 *    solicitados como pendientes (no fatal: la atención ya quedó registrada);
 * 4. pasa la cita vinculada a "completada" (no fatal).
 * Con backend real, debería ser una única transacción de `POST …/encounters`.
 */
async function registerEncounterSequence(patientId: string, input: RegisterEncounterInput): Promise<RegisterEncounterResult> {
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

  const encounter = await clinicalHistoryApi.createEncounter(patientId, { ...input.encounter, performedTreatments })

  const usedIds = new Set(performedTreatments.map((item) => item.id))
  const existingRequests = new Set(current.examRequests.map((item) => item.id))
  const newRequests = examRequestsOf(encounter).filter((item) => !existingRequests.has(item.id))
  if (current.plan.some((item) => usedIds.has(item.id)) || newRequests.length) {
    try {
      saved = await clinicalHistoryApi.saveRecord({
        ...current,
        plan: current.plan.filter((item) => !usedIds.has(item.id)),
        examRequests: [...current.examRequests, ...newRequests],
      })
      updateCachedRecord(saved)
    } catch (error) {
      warnings.push(
        `La atención se registró, pero no se actualizaron los propuestos ni los exámenes solicitados de la historia: ${getErrorMessage(error)}`
      )
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

export function useRegisterEncounter(patientId: string) {
  return useMutation({
    mutationFn: (input: RegisterEncounterInput) => registerEncounterSequence(patientId, input),
    onSuccess: (result) => {
      queryClient.setQueryData<PatientClinicalHistory>(clinicalHistoryKeys.record(patientId), (history) =>
        history && !history.encounters.some((item) => item.id === result.encounter.id)
          ? { ...history, encounters: [...history.encounters, result.encounter] }
          : history
      )
      queryClient.invalidateQueries({ queryKey: clinicalHistoryKeys.encounters() })
      if (result.encounter.performedTreatments.length) {
        queryClient.invalidateQueries({ queryKey: treatmentsKeys.all })
        queryClient.invalidateQueries({ queryKey: inventoryKeys.all })
        queryClient.invalidateQueries({ queryKey: financeKeys.all })
      }
      if (result.appointmentCompleted) queryClient.invalidateQueries({ queryKey: appointmentsKeys.lists() })
    },
    onError: () => {
      // Una falla a mitad de camino pudo haber guardado la historia o registrado tratamientos.
      queryClient.invalidateQueries({ queryKey: clinicalHistoryKeys.record(patientId) })
      queryClient.invalidateQueries({ queryKey: treatmentsKeys.all })
      queryClient.invalidateQueries({ queryKey: inventoryKeys.all })
    },
  })
}

export function useAddEncounterNote(patientId: string) {
  return useMutation({
    mutationFn: ({ encounterId, input }: { encounterId: string; input: AddEncounterNoteInput }) =>
      clinicalHistoryApi.addEncounterNote(patientId, encounterId, input),
    onSuccess: (note: EncounterNote, { encounterId }) => {
      queryClient.setQueryData<PatientClinicalHistory>(clinicalHistoryKeys.record(patientId), (history) =>
        history
          ? {
              ...history,
              encounters: history.encounters.map((encounter) =>
                encounter.id === encounterId ? { ...encounter, addenda: [...encounter.addenda, note] } : encounter
              ),
            }
          : history
      )
    },
  })
}

export function useUploadAttachment() {
  return useMutation({
    mutationFn: (input: UploadAttachmentInput) => clinicalHistoryApi.uploadAttachment(input),
  })
}

/** Descarga (o toma de la caché) el archivo original de un adjunto. */
export function fetchAttachmentFile(patientId: string, attachment: DentalAttachment) {
  return queryClient.fetchQuery({
    queryKey: clinicalHistoryKeys.file(patientId, attachment.id),
    queryFn: () => clinicalHistoryApi.getAttachmentFile(patientId, attachment.id),
    staleTime: Infinity,
  })
}
