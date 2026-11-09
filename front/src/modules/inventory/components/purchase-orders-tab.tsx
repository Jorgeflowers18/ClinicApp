import { useState } from "react"
import { toast } from "sonner"
import { Plus } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DataTable, type DataTableColumn } from "@/shared/components/data-table"
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
  const columns: DataTableColumn<PurchaseOrder>[] = [
    { key: "supplier", header: "Proveedor", cell: (order) => supplierName(order.supplierId) },
    { key: "lines", header: "Líneas", cell: (order) => order.lines.length },
    {
      key: "status",
      header: "Estado",
      cell: (order) => (
        <Badge variant={STATUS_VARIANT[order.status]}>
          {purchaseOrderStatusLabels[order.status]}
        </Badge>
      ),
    },
    {
      key: "date",
      header: "Fecha",
      cell: (order) => formatDateTime(order.createdAt, { year: "numeric", month: "short", day: "2-digit" }),
    },
    {
      key: "actions",
      header: "",
      className: "w-10 text-right",
      cell: (order) => order.status === "pendiente" && (
        <div className="flex flex-wrap justify-end gap-2">
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
      ),
    },
  ]

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

      <DataTable
        columns={columns}
        data={orders ?? []}
        getRowId={(order) => order.id}
        isLoading={isLoading}
        emptyTitle="Sin órdenes de compra"
        emptyDescription="Todavía no hay órdenes de compra registradas."
        onRowClick={openDetail}
      />

      <PurchaseOrderFormDialog open={dialogOpen} onOpenChange={setDialogOpen} order={selectedOrder} />
    </div>
  )
}
