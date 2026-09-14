import { useState } from "react"
import { toast } from "sonner"
import { MoreHorizontal, Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ConfirmDialog } from "@/shared/components/confirm-dialog"
import { DataTable, type DataTableColumn } from "@/shared/components/data-table"
import { getErrorMessage } from "@/shared/lib/error-message"

import { useDeleteSupplier, useSuppliersList } from "../api/inventory.queries"
import { SupplierFormDialog } from "./supplier-form-dialog"
import type { Supplier } from "../types/inventory.types"

export function SuppliersTab() {
  const { data: suppliers, isLoading, isError, error } = useSuppliersList()
  const deleteSupplier = useDeleteSupplier()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null)
  const [supplierToDelete, setSupplierToDelete] = useState<Supplier | null>(null)

  function openCreate() {
    setEditingSupplier(null)
    setDialogOpen(true)
  }

  function openEdit(supplier: Supplier) {
    setEditingSupplier(supplier)
    setDialogOpen(true)
  }

  function handleDelete() {
    if (!supplierToDelete) return
    deleteSupplier.mutate(supplierToDelete.id, {
      onSuccess: () => {
        toast.success("Proveedor eliminado")
        setSupplierToDelete(null)
      },
      onError: (err) => toast.error(getErrorMessage(err)),
    })
  }

  const columns: DataTableColumn<Supplier>[] = [
    {
      key: "name",
      header: "Proveedor",
      cell: (row) => (
        <div>
          <p className="font-medium text-foreground">{row.name}</p>
          <p className="text-xs text-muted-foreground">{row.contactName || "Sin contacto asignado"}</p>
        </div>
      ),
    },
    { key: "phone", header: "Teléfono", cell: (row) => row.phone || "—" },
    { key: "email", header: "Correo", cell: (row) => row.email || "—" },
    { key: "address", header: "Dirección", cell: (row) => row.address || "—" },
    {
      key: "actions",
      header: "",
      className: "w-10 text-right",
      cell: (row) => (
        <DropdownMenu>
          <DropdownMenuTrigger
            className="inline-flex size-8 items-center justify-center rounded-md hover:bg-muted"
            onClick={(event) => event.stopPropagation()}
          >
            <MoreHorizontal className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => openEdit(row)}>Editar</DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onClick={() => setSupplierToDelete(row)}>
              Eliminar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openCreate}>
          <Plus />
          Nuevo proveedor
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={suppliers ?? []}
        getRowId={(row) => row.id}
        isLoading={isLoading}
        isError={isError}
        errorMessage={getErrorMessage(error)}
        onRowClick={openEdit}
        emptyTitle="Sin proveedores"
        emptyDescription="Registra proveedores para poder elegirlos al crear una orden de compra."
      />

      <SupplierFormDialog open={dialogOpen} onOpenChange={setDialogOpen} supplier={editingSupplier} />

      <ConfirmDialog
        open={!!supplierToDelete}
        onOpenChange={(open) => !open && setSupplierToDelete(null)}
        title="Eliminar proveedor"
        description={`¿Confirmas que deseas eliminar a "${supplierToDelete?.name}"? No se puede eliminar si tiene órdenes de compra asociadas.`}
        confirmLabel="Eliminar"
        destructive
        isLoading={deleteSupplier.isPending}
        onConfirm={handleDelete}
      />
    </div>
  )
}
