import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query"

import { queryClient } from "@/shared/lib/query-client"
import type { PageQuery } from "@/shared/types/common"

import { treatmentsApi } from "./treatments.api"
import type { TreatmentFormValues } from "../types/treatment.types"

export const treatmentsKeys = {
  all: ["treatments"] as const,
  lists: () => [...treatmentsKeys.all, "list"] as const,
  list: (query: PageQuery) => [...treatmentsKeys.lists(), query] as const,
  active: () => [...treatmentsKeys.all, "active"] as const,
  detail: (id: string) => [...treatmentsKeys.all, "detail", id] as const,
  assignments: (id: string) => [...treatmentsKeys.all, "assignments", id] as const,
}

export function useTreatmentsList(query: PageQuery) {
  return useQuery({
    queryKey: treatmentsKeys.list(query),
    queryFn: () => treatmentsApi.list(query),
    placeholderData: keepPreviousData,
  })
}

export function useActiveTreatments() {
  return useQuery({
    queryKey: treatmentsKeys.active(),
    queryFn: () => treatmentsApi.listActive(),
    staleTime: 5 * 60_000,
  })
}

export function useTreatment(id: string | undefined) {
  return useQuery({
    queryKey: treatmentsKeys.detail(id ?? ""),
    queryFn: () => treatmentsApi.get(id as string),
    enabled: Boolean(id),
  })
}

export function useTreatmentAssignments(id: string | undefined) {
  return useQuery({
    queryKey: treatmentsKeys.assignments(id ?? ""),
    queryFn: () => treatmentsApi.listAssignments(id as string),
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

export function useDeleteTreatment() {
  return useMutation({
    mutationFn: (id: string) => treatmentsApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: treatmentsKeys.lists() })
      queryClient.invalidateQueries({ queryKey: treatmentsKeys.active() })
    },
  })
}

export function useAdvanceSession(treatmentId: string) {
  return useMutation({
    mutationFn: (assignmentId: string) => treatmentsApi.advanceSession(assignmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: treatmentsKeys.assignments(treatmentId) })
    },
  })
}
