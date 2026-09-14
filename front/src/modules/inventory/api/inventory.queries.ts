import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query"

import { queryClient } from "@/shared/lib/query-client"
import type { PageQuery } from "@/shared/types/common"

import { inventoryApi } from "./inventory.api"
import type {
  InventoryItemFormValues,
  MovementFormValues,
  PurchaseOrderFormValues,
  SterilizationCycleFormValues,
  SupplierFormValues,
} from "../types/inventory.types"

export const inventoryKeys = {
  all: ["inventory-items"] as const,
  lists: () => [...inventoryKeys.all, "list"] as const,
  list: (query: PageQuery) => [...inventoryKeys.lists(), query] as const,
  detail: (id: string) => [...inventoryKeys.all, "detail", id] as const,
  movements: (id: string) => [...inventoryKeys.all, "movements", id] as const,
  lots: (id: string) => [...inventoryKeys.all, "lots", id] as const,
  purchaseOrders: () => [...inventoryKeys.all, "purchase-orders"] as const,
  sterilizationCycles: () => [...inventoryKeys.all, "sterilization-cycles"] as const,
  suppliers: () => [...inventoryKeys.all, "suppliers"] as const,
}

export function useSuppliersList() {
  return useQuery({
    queryKey: inventoryKeys.suppliers(),
    queryFn: () => inventoryApi.listSuppliers(),
  })
}

export function useCreateSupplier() {
  return useMutation({
    mutationFn: (values: SupplierFormValues) => inventoryApi.createSupplier(values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inventoryKeys.suppliers() })
    },
  })
}

export function useUpdateSupplier() {
  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: SupplierFormValues }) =>
      inventoryApi.updateSupplier(id, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inventoryKeys.suppliers() })
      queryClient.invalidateQueries({ queryKey: inventoryKeys.purchaseOrders() })
    },
  })
}

export function useDeleteSupplier() {
  return useMutation({
    mutationFn: (id: string) => inventoryApi.removeSupplier(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inventoryKeys.suppliers() })
    },
  })
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

export function useInventoryLots(id: string | undefined) {
  return useQuery({
    queryKey: inventoryKeys.lots(id ?? ""),
    queryFn: () => inventoryApi.listLots(id as string),
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
      queryClient.invalidateQueries({ queryKey: inventoryKeys.lots(itemId) })
    },
  })
}

export function usePurchaseOrdersList() {
  return useQuery({
    queryKey: inventoryKeys.purchaseOrders(),
    queryFn: () => inventoryApi.listPurchaseOrders(),
  })
}

export function useCreatePurchaseOrder() {
  return useMutation({
    mutationFn: (values: PurchaseOrderFormValues) => inventoryApi.createPurchaseOrder(values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inventoryKeys.purchaseOrders() })
    },
  })
}

export function useReceivePurchaseOrder() {
  return useMutation({
    mutationFn: (id: string) => inventoryApi.receivePurchaseOrder(id),
    onSuccess: () => {
      // Una orden puede tocar varios insumos a la vez: invalidar todo lo de inventario es
      // más simple que enumerar los ítems afectados y sigue siendo correcto.
      queryClient.invalidateQueries({ queryKey: inventoryKeys.all })
    },
  })
}

export function useCancelPurchaseOrder() {
  return useMutation({
    mutationFn: (id: string) => inventoryApi.cancelPurchaseOrder(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inventoryKeys.purchaseOrders() })
    },
  })
}

export function useSterilizationCyclesList() {
  return useQuery({
    queryKey: inventoryKeys.sterilizationCycles(),
    queryFn: () => inventoryApi.listSterilizationCycles(),
  })
}

export function useCreateSterilizationCycle() {
  return useMutation({
    mutationFn: (values: SterilizationCycleFormValues) => inventoryApi.createSterilizationCycle(values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inventoryKeys.sterilizationCycles() })
    },
  })
}
