import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query"

import { queryClient } from "@/shared/lib/query-client"
import { appointmentsKeys } from "@/modules/appointments/api/appointments.queries"
import { treatmentsKeys } from "@/modules/treatments/api/treatments.queries"
import { inventoryKeys } from "@/modules/inventory/api/inventory.queries"
import { financeKeys } from "@/modules/finance/api/finance.queries"

import { clinicalHistoryApi } from "./clinical-history.api"
import type { RegisterEncounterInput } from "./clinical-history.contract"
import type {
  AddEncounterNoteInput,
  ClinicalRecord,
  DentalAttachment,
  EncounterListQuery,
  EncounterNote,
  PatientClinicalHistory,
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
    queryFn: ({ signal }) => clinicalHistoryApi.listEncounters(query, signal),
    placeholderData: keepPreviousData,
    enabled: options?.enabled ?? true,
  })
}

/** Historia del paciente: `{ record, encounters, references }`. */
export function useClinicalHistory(patientId: string | undefined) {
  return useQuery({
    queryKey: clinicalHistoryKeys.record(patientId ?? ""),
    queryFn: ({ signal }) => clinicalHistoryApi.getRecord(patientId as string, signal),
    enabled: Boolean(patientId),
    // Los conflictos se detectan por revisión al guardar; refetch al enfocar pisaría los cambios en edición.
    refetchOnWindowFocus: false,
  })
}

export function useAttachmentFile(patientId: string, attachment: DentalAttachment, enabled: boolean) {
  return useQuery({
    queryKey: clinicalHistoryKeys.file(patientId, attachment.id),
    queryFn: ({ signal }) => clinicalHistoryApi.getAttachmentFile(patientId, attachment.id, signal),
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

export type { RegisterEncounterInput, RegisterEncounterResult } from "./clinical-history.contract"

export function useRegisterEncounter(patientId: string) {
  return useMutation({
    // Una sola transacción en el servidor (POST …/encounters/register).
    mutationFn: (input: RegisterEncounterInput) => clinicalHistoryApi.registerEncounter(patientId, input),
    onSuccess: (result) => {
      if (result.record) updateCachedRecord(result.record)
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
      // El registro es una transacción: no queda nada a medias. Recargar asegura ver el estado del servidor.
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
