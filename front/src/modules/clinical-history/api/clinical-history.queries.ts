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
import {
  assignablePlanStatuses,
  type CloseVisitResult,
  type DentalAttachment,
  type DentalRecord,
  type DentalVisit,
  type StartVisitInput,
  type UploadAttachmentInput,
  type VisitListQuery,
} from "../types/clinical-history.types"

export const clinicalHistoryKeys = {
  all: ["clinical-history"] as const,
  visits: () => [...clinicalHistoryKeys.all, "visits"] as const,
  visitList: (query: VisitListQuery) => [...clinicalHistoryKeys.visits(), query] as const,
  record: (patientId: string) => [...clinicalHistoryKeys.all, "record", patientId] as const,
  file: (patientId: string, attachmentId: string) => [...clinicalHistoryKeys.all, "file", patientId, attachmentId] as const,
}

export function useDentalVisitsList(query: VisitListQuery, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: clinicalHistoryKeys.visitList(query),
    queryFn: () => clinicalHistoryApi.listVisits(query),
    placeholderData: keepPreviousData,
    enabled: options?.enabled ?? true,
  })
}

export function useDentalRecord(patientId: string | undefined) {
  return useQuery({
    queryKey: clinicalHistoryKeys.record(patientId ?? ""),
    queryFn: () => clinicalHistoryApi.getRecord(patientId as string),
    enabled: Boolean(patientId),
    // Los conflictos se detectan por revisión al guardar; refetch al enfocar pisaría el borrador en edición.
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

/** Reemplaza una visita dentro de la historia en caché sin volver a pedirla. */
export function updateCachedVisit(patientId: string, visit: DentalVisit) {
  queryClient.setQueryData<DentalRecord>(clinicalHistoryKeys.record(patientId), (record) =>
    record ? { ...record, visits: record.visits.map((item) => (item.id === visit.id ? visit : item)) } : record
  )
}

export function useStartVisit(patientId: string) {
  return useMutation({
    mutationFn: (input: StartVisitInput) => clinicalHistoryApi.startVisit(patientId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: clinicalHistoryKeys.record(patientId) })
      queryClient.invalidateQueries({ queryKey: clinicalHistoryKeys.visits() })
    },
  })
}

export function useDiscardDraft(patientId: string) {
  return useMutation({
    mutationFn: (visitId: string) => clinicalHistoryApi.discardDraft(patientId, visitId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: clinicalHistoryKeys.record(patientId) })
      queryClient.invalidateQueries({ queryKey: clinicalHistoryKeys.visits() })
    },
  })
}

export function useUploadAttachment() {
  return useMutation({
    mutationFn: (input: UploadAttachmentInput) => clinicalHistoryApi.uploadAttachment(input),
  })
}

/**
 * Cierre coordinado desde el frontend (mismo criterio que citas → notificaciones):
 * 1. crea las asignaciones de los ítems aprobados (idempotente por ítem) y avanza una sesión en los "realizados";
 * 2. guarda las asignaciones en el borrador, así un reintento no las duplica;
 * 3. cierra la visita;
 * 4. marca la cita vinculada como completada (no fatal: la visita ya quedó cerrada).
 * Con backend real, este flujo debería moverse a una única transacción de `POST /visits/:id/close`.
 */
async function closeVisitSequence(visit: DentalVisit): Promise<CloseVisitResult> {
  const createdAssignmentIds: string[] = []
  const warnings: string[] = []
  const plan = [...visit.plan]

  for (const [index, item] of plan.entries()) {
    if (!assignablePlanStatuses.includes(item.status) || !item.treatmentId || item.assignmentId) continue
    const assignment = await treatmentsApi.createAssignment({
      treatmentId: item.treatmentId,
      patientId: visit.patientId,
      totalSessions: item.sessions,
      startDate: visit.date,
      sourceVisitId: visit.id,
      sourcePlanItemId: item.id,
    })
    if (item.status === "realizado" && assignment.completedSessions === 0) {
      await treatmentsApi.advanceSession(assignment.id)
    }
    plan[index] = { ...item, assignmentId: assignment.id }
    createdAssignmentIds.push(assignment.id)
  }

  const withAssignments = createdAssignmentIds.length
    ? await clinicalHistoryApi.saveDraft({ ...visit, plan })
    : visit
  const closed = await clinicalHistoryApi.closeVisit(withAssignments)

  let appointmentCompleted = false
  if (closed.appointmentId) {
    try {
      const appointment = await appointmentsApi.get(closed.appointmentId)
      if (appointment.status === "programada" || appointment.status === "confirmada") {
        await appointmentsApi.updateStatus(appointment.id, "completada")
        appointmentCompleted = true
      } else if (appointment.status === "cancelada" || appointment.status === "no_asistio") {
        warnings.push("La cita vinculada está cancelada o marcada como no asistida; no se cambió su estado.")
      }
    } catch (error) {
      warnings.push(`La visita se cerró, pero no se pudo actualizar la cita: ${getErrorMessage(error)}`)
    }
  }

  return { visit: closed, createdAssignmentIds, appointmentCompleted, warnings }
}

export function useCloseVisit(patientId: string) {
  return useMutation({
    mutationFn: closeVisitSequence,
    onSuccess: (result) => {
      updateCachedVisit(patientId, result.visit)
      queryClient.invalidateQueries({ queryKey: clinicalHistoryKeys.record(patientId) })
      queryClient.invalidateQueries({ queryKey: clinicalHistoryKeys.visits() })
      if (result.createdAssignmentIds.length) {
        queryClient.invalidateQueries({ queryKey: treatmentsKeys.all })
        queryClient.invalidateQueries({ queryKey: inventoryKeys.all })
        queryClient.invalidateQueries({ queryKey: financeKeys.all })
      }
      if (result.appointmentCompleted) {
        queryClient.invalidateQueries({ queryKey: appointmentsKeys.lists() })
      }
    },
    onError: () => {
      // Una falla a mitad de camino pudo haber creado asignaciones: se refresca todo lo afectado.
      queryClient.invalidateQueries({ queryKey: clinicalHistoryKeys.record(patientId) })
      queryClient.invalidateQueries({ queryKey: treatmentsKeys.all })
    },
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
