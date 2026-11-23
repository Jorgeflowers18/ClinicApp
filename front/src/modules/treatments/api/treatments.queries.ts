import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query"

import { queryClient } from "@/shared/lib/query-client"
import type { PageQuery } from "@/shared/types/common"

import { treatmentsApi } from "./treatments.api"
import type { Treatment, TreatmentFormValues } from "../types/treatment.types"

export const treatmentsKeys = {
  all: ["treatments"] as const,
  lists: () => [...treatmentsKeys.all, "list"] as const,
  list: (query: PageQuery) => [...treatmentsKeys.lists(), query] as const,
  active: () => [...treatmentsKeys.all, "active"] as const,
  detail: (id: string) => [...treatmentsKeys.all, "detail", id] as const,
  assignments: (id: string) => [...treatmentsKeys.all, "assignments", id] as const,
  allAssignments: () => [...treatmentsKeys.all, "assignments"] as const,
  patientAssignments: (patientId: string) => [...treatmentsKeys.all, "assignments", "patient", patientId] as const,
}

export function usePatientAssignments(patientId: string | undefined) {
  return useQuery({
    queryKey: treatmentsKeys.patientAssignments(patientId ?? ""),
    queryFn: ({ signal }) => treatmentsApi.listAssignmentsByPatient(patientId as string, signal),
    enabled: Boolean(patientId),
  })
}

export function useTreatmentsList(query: PageQuery) {
  return useQuery({
    queryKey: treatmentsKeys.list(query),
    queryFn: ({ signal }) => treatmentsApi.list(query, signal),
    placeholderData: keepPreviousData,
  })
}

export function useActiveTreatments() {
  return useQuery({
    queryKey: treatmentsKeys.active(),
    queryFn: ({ signal }) => treatmentsApi.listActive(signal),
    staleTime: 5 * 60_000,
  })
}

export function useTreatment(id: string | undefined) {
  return useQuery({
    queryKey: treatmentsKeys.detail(id ?? ""),
    queryFn: ({ signal }) => treatmentsApi.get(id as string, signal),
    enabled: Boolean(id),
  })
}

export function useTreatmentAssignments(id: string | undefined) {
  return useQuery({
    queryKey: treatmentsKeys.assignments(id ?? ""),
    queryFn: ({ signal }) => treatmentsApi.listAssignments(id as string, signal),
    enabled: Boolean(id),
  })
}

export function useCreateTreatment() {
  return useMutation({
    mutationFn: (values: TreatmentFormValues) => treatmentsApi.create(values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: treatmentsKeys.lists() })
      queryClient.invalidateQueries({ queryKey: treatmentsKeys.active() })
    },
  })
}

export function useUpdateTreatment(id: string) {
  return useMutation({
    mutationFn: (values: TreatmentFormValues) => treatmentsApi.update(id, values),
    onSuccess: (treatment) => {
      queryClient.invalidateQueries({ queryKey: treatmentsKeys.lists() })
      queryClient.invalidateQueries({ queryKey: treatmentsKeys.active() })
      queryClient.setQueryData(treatmentsKeys.detail(id), treatment)
    },
  })
}

/** Para un tratamiento que ya se usó y no se puede borrar (`409`): se desactiva en su lugar. */
export function useDeactivateTreatment() {
  return useMutation({
    mutationFn: ({ id, createdAt: _createdAt, ...values }: Treatment) => treatmentsApi.update(id, { ...values, active: false }),
    onSuccess: (treatment) => {
      queryClient.invalidateQueries({ queryKey: treatmentsKeys.lists() })
      queryClient.invalidateQueries({ queryKey: treatmentsKeys.active() })
      queryClient.setQueryData(treatmentsKeys.detail(treatment.id), treatment)
    },
  })
}

export function useDeleteTreatment() {
  return useMutation({
    mutationFn: (id: string) => treatmentsApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: treatmentsKeys.lists() })
      queryClient.invalidateQueries({ queryKey: treatmentsKeys.active() })
    },
  })
}
