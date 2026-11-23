import { useQuery } from "@tanstack/react-query"

import { inventoryApi } from "../api/inventory.api"
import { inventoryKeys } from "../api/inventory.queries"

/**
 * Todos los insumos para los selectores (tratamientos, órdenes de compra y esterilización), en una sola
 * petición liviana. Cuelga de `inventoryKeys.lists()`: crear, editar o borrar un insumo la refresca.
 */
export function useInventoryOptions() {
  return useQuery({
    queryKey: [...inventoryKeys.lists(), "options"],
    // Sin `signal`: es un catálogo compartido. Cancelarlo en el doble montaje de StrictMode solo lo repite.
    queryFn: () => inventoryApi.listOptions(),
    staleTime: 30_000,
  })
}
