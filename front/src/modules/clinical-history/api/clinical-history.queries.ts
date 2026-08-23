import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query"

import { queryClient } from "@/shared/lib/query-client"
import type { PageQuery } from "@/shared/types/common"

import { clinicalHistoryApi } from "./clinical-history.api"
import type { ClinicalHistoryFormValues } from "../types/clinical-history.types"

interface ClinicalHistoryQuery extends PageQuery {
  patientId?: string
}

export const clinicalHistoryKeys = {
  all: ["clinical-history"] as const,
  lists: () => [...clinicalHistoryKeys.all, "list"] as const,
  list: (query: ClinicalHistoryQuery) => [...clinicalHistoryKeys.lists(), query] as const,
  detail: (id: string) => [...clinicalHistoryKeys.all, "detail", id] as const,
}

export function useClinicalHistoryList(query: ClinicalHistoryQuery) {
  return useQuery({
    queryKey: clinicalHistoryKeys.list(query),
    queryFn: () => clinicalHistoryApi.list(query),
    placeholderData: keepPreviousData,
  })
}

export function useClinicalHistoryEntry(id: string | undefined) {
  return useQuery({
    queryKey: clinicalHistoryKeys.detail(id ?? ""),
    queryFn: () => clinicalHistoryApi.get(id as string),
    enabled: Boolean(id),
  })
}

export function useCreateClinicalHistoryEntry() {
  return useMutation({
    mutationFn: (values: ClinicalHistoryFormValues) => clinicalHistoryApi.create(values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: clinicalHistoryKeys.lists() })
    },
  })
}

export function useUpdateClinicalHistoryEntry(id: string) {
  return useMutation({
    mutationFn: (values: ClinicalHistoryFormValues) => clinicalHistoryApi.update(id, values),
    onSuccess: (entry) => {
      queryClient.invalidateQueries({ queryKey: clinicalHistoryKeys.lists() })
      queryClient.setQueryData(clinicalHistoryKeys.detail(id), entry)
    },
  })
}
