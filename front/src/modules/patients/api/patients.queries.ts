import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query"

import { queryClient } from "@/shared/lib/query-client"
import type { PageQuery } from "@/shared/types/common"

import { patientsApi } from "./patients.api"
import type { PatientFormValues } from "../types/patient.types"

export const patientsKeys = {
  all: ["patients"] as const,
  lists: () => [...patientsKeys.all, "list"] as const,
  list: (query: PageQuery) => [...patientsKeys.lists(), query] as const,
  detail: (id: string) => [...patientsKeys.all, "detail", id] as const,
}

export function usePatientsList(query: PageQuery) {
  return useQuery({
    queryKey: patientsKeys.list(query),
    queryFn: () => patientsApi.list(query),
    placeholderData: keepPreviousData,
  })
}

export function usePatient(id: string | undefined) {
  return useQuery({
    queryKey: patientsKeys.detail(id ?? ""),
    queryFn: () => patientsApi.get(id as string),
    enabled: Boolean(id),
  })
}

export function useCreatePatient() {
  return useMutation({
    mutationFn: (values: PatientFormValues) => patientsApi.create(values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: patientsKeys.lists() })
    },
  })
}

export function useUpdatePatient(id: string) {
  return useMutation({
    mutationFn: (values: PatientFormValues) => patientsApi.update(id, values),
    onSuccess: (patient) => {
      queryClient.invalidateQueries({ queryKey: patientsKeys.lists() })
      queryClient.setQueryData(patientsKeys.detail(id), patient)
    },
  })
}

export function useDeletePatient() {
  return useMutation({
    mutationFn: (id: string) => patientsApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: patientsKeys.lists() })
    },
  })
}
