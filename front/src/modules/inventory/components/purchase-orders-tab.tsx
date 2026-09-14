import { useState } from "react"
import { toast } from "sonner"
import { Plus } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatDateTime } from "@/shared/lib/date"
import { getErrorMessage } from "@/shared/lib/error-message"

import {
  useCancelPurchaseOrder,
  usePurchaseOrdersList,
  useReceivePurchaseOrder,
  useSuppliersList,
} from "../api/inventory.queries"
import { PurchaseOrderFormDialog } from "./purchase-order-form-dialog"
import { purchaseOrderStatusLabels, type PurchaseOrder, type PurchaseOrderStatus } from "../types/inventory.types"

const STATUS_VARIANT: Record<PurchaseOrderStatus, "outline" | "default" | "destructive"> = {
  pendiente: "outline",
  recibida: "default",
  cancelada: "destructive",
}

export function PurchaseOrdersTab() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null)
  const { data: orders, isLoading } = usePurchaseOrdersList()
  const receiveOrder = useReceivePurchaseOrder()
  const cancelOrder = useCancelPurchaseOrder()
  const { data: suppliers } = useSuppliersList()

  function supplierName(supplierId: string) {
    return suppliers?.find((supplier) => supplier.id === supplierId)?.name ?? "Proveedor"
  }

  function openCreate() {
    setSelectedOrder(null)
    setDialogOpen(true)
  }

  function openDetail(order: PurchaseOrder) {
    setSelectedOrder(order)
    setDialogOpen(true)
  }

  function handleReceive(id: string) {
    receiveOrder.mutate(id, {
      onSuccess: () => toast.success("Orden recibida, stock actualizado"),
      onError: (err) => toast.error(getErrorMessage(err)),
    })
  }

  function handleCancel(id: string) {
    cancelOrder.mutate(id, {
      onSuccess: () => toast.success("Orden cancelada"),
      onError: (err) => toast.error(getErrorMessage(err)),
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openCreate}>
          <Plus />
          Nueva orden
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : orders && orders.length > 0 ? (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Proveedor</TableHead>
                <TableHead>Líneas</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => (
                <TableRow key={order.id} className="cursor-pointer" onClick={() => openDetail(order)}>
                  <TableCell className="font-medium">{supplierName(order.supplierId)}</TableCell>
                  <TableCell>{order.lines.length}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[order.status]}>
                      {purchaseOrderStatusLabels[order.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDateTime(order.createdAt, { year: "numeric", month: "short", day: "2-digit" })}
                  </TableCell>
                  <TableCell className="text-right">
                    {order.status === "pendiente" && (
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(event) => {
                            event.stopPropagation()
                            handleReceive(order.id)
                          }}
                        >
                          Recibir
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(event) => {
                            event.stopPropagation()
                            handleCancel(order.id)
                          }}
                        >
                          Cancelar
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Sin órdenes de compra registradas todavía.
        </p>
      )}

      <PurchaseOrderFormDialog open={dialogOpen} onOpenChange={setDialogOpen} order={selectedOrder} />
    </div>
  )
}
