import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query"

import { queryClient } from "@/shared/lib/query-client"
import type { PageQuery } from "@/shared/types/common"

import { inventoryApi } from "./inventory.api"
import type { InventoryItemFormValues, MovementFormValues } from "../types/inventory.types"

export const inventoryKeys = {
  all: ["inventory-items"] as const,
  lists: () => [...inventoryKeys.all, "list"] as const,
  list: (query: PageQuery) => [...inventoryKeys.lists(), query] as const,
  detail: (id: string) => [...inventoryKeys.all, "detail", id] as const,
  movements: (id: string) => [...inventoryKeys.all, "movements", id] as const,
}

export function useInventoryList(query: PageQuery) {
  return useQuery({
    queryKey: inventoryKeys.list(query),
    queryFn: () => inventoryApi.list(query),
    placeholderData: keepPreviousData,
  })
}

export function useInventoryItem(id: string | undefined) {
  return useQuery({
    queryKey: inventoryKeys.detail(id ?? ""),
    queryFn: () => inventoryApi.get(id as string),
    enabled: Boolean(id),
  })
}

export function useInventoryMovements(id: string | undefined) {
  return useQuery({
    queryKey: inventoryKeys.movements(id ?? ""),
    queryFn: () => inventoryApi.listMovements(id as string),
    enabled: Boolean(id),
  })
}

export function useCreateInventoryItem() {
  return useMutation({
    mutationFn: (values: InventoryItemFormValues) => inventoryApi.create(values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inventoryKeys.lists() })
    },
  })
}

export function useUpdateInventoryItem(id: string) {
  return useMutation({
    mutationFn: (values: InventoryItemFormValues) => inventoryApi.update(id, values),
    onSuccess: (item) => {
      queryClient.invalidateQueries({ queryKey: inventoryKeys.lists() })
      queryClient.setQueryData(inventoryKeys.detail(id), item)
    },
  })
}

export function useDeleteInventoryItem() {
  return useMutation({
    mutationFn: (id: string) => inventoryApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inventoryKeys.lists() })
    },
  })
}

export function useRegisterMovement(itemId: string) {
  return useMutation({
    mutationFn: (values: MovementFormValues) => inventoryApi.registerMovement(itemId, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inventoryKeys.lists() })
      queryClient.invalidateQueries({ queryKey: inventoryKeys.detail(itemId) })
      queryClient.invalidateQueries({ queryKey: inventoryKeys.movements(itemId) })
    },
  })
}
