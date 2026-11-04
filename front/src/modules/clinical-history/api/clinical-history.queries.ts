import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query"

import { queryClient } from "@/shared/lib/query-client"

import { clinicalHistoryApi } from "./clinical-history.api"
import type {
  ClinicalRecord,
  DentalAttachment,
  EncounterListQuery,
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
