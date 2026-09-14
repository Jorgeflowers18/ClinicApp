import { useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { ArrowDownCircle, ArrowLeft, ArrowUpCircle, Pencil, Plus } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { PageHeader } from "@/shared/components/page-header"
import { formatDateOnly, formatDateTime } from "@/shared/lib/date"
import { getErrorMessage } from "@/shared/lib/error-message"

import { useInventoryItem, useInventoryLots, useInventoryMovements } from "../api/inventory.queries"
import { RegisterMovementDialog } from "../components/register-movement-dialog"

export function InventoryItemDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [movementDialogOpen, setMovementDialogOpen] = useState(false)

  const { data: item, isLoading, isError, error } = useInventoryItem(id)
  const { data: movements, isLoading: isLoadingMovements } = useInventoryMovements(id)
  const { data: lots, isLoading: isLoadingLots } = useInventoryLots(id)

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  if (isError || !item) {
    return (
      <Alert variant="destructive">
        <AlertTitle>No se pudo cargar el insumo</AlertTitle>
        <AlertDescription>{getErrorMessage(error)}</AlertDescription>
      </Alert>
    )
  }

  const isLowStock = item.stock <= item.minStock

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" onClick={() => navigate("/inventario")} className="mb-2 -ml-2">
          <ArrowLeft />
          Volver a inventario
        </Button>
        <PageHeader
          title={item.name}
          description={item.category}
          actions={
            <>
              <Button variant="outline" onClick={() => navigate(`/inventario/${item.id}/editar`)}>
                <Pencil />
                Editar
              </Button>
              <Button onClick={() => setMovementDialogOpen(true)}>
                <Plus />
                Registrar movimiento
              </Button>
            </>
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Stock actual</p>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-semibold">
                {item.stock} <span className="text-sm font-normal text-muted-foreground">{item.unit}</span>
              </p>
              {isLowStock && <Badge variant="destructive">Bajo mínimo</Badge>}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Stock mínimo</p>
            <p className="text-2xl font-semibold">
              {item.minStock} <span className="text-sm font-normal text-muted-foreground">{item.unit}</span>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Costo unitario</p>
            <p className="text-2xl font-semibold">${item.unitCost.toFixed(2)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lotes</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingLots ? (
            <Skeleton className="h-32 w-full" />
          ) : lots && lots.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Recibido</TableHead>
                  <TableHead>Cantidad restante</TableHead>
                  <TableHead>Vencimiento</TableHead>
                  <TableHead>Origen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lots.map((lot) => (
                  <TableRow key={lot.id} className={lot.quantity === 0 ? "text-muted-foreground" : undefined}>
                    <TableCell>
                      {formatDateTime(lot.receivedAt, { year: "numeric", month: "short", day: "2-digit" })}
                    </TableCell>
                    <TableCell>
                      {lot.quantity} {item.unit}
                    </TableCell>
                    <TableCell>
                      {lot.expirationDate
                        ? formatDateOnly(lot.expirationDate, { year: "numeric", month: "short", day: "2-digit" })
                        : "Sin vencimiento"}
                    </TableCell>
                    <TableCell>{lot.purchaseOrderId ? "Compra" : "Manual"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Sin lotes registrados todavía.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Historial de movimientos</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingMovements ? (
            <Skeleton className="h-32 w-full" />
          ) : movements && movements.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Cantidad</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Fecha</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movements.map((movement) => (
                  <TableRow key={movement.id}>
                    <TableCell>
                      <span className="flex items-center gap-1.5">
                        {movement.type === "entrada" ? (
                          <ArrowUpCircle className="size-4 text-emerald-600" />
                        ) : (
                          <ArrowDownCircle className="size-4 text-destructive" />
                        )}
                        {movement.type === "entrada" ? "Entrada" : "Salida"}
                      </span>
                    </TableCell>
                    <TableCell>
                      {movement.quantity} {item.unit}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{movement.reason}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDateTime(movement.createdAt, {
                        year: "numeric",
                        month: "short",
                        day: "2-digit",
                      })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Sin movimientos registrados todavía.
            </p>
          )}
        </CardContent>
      </Card>

      <RegisterMovementDialog
        itemId={item.id}
        itemName={item.name}
        currentStock={item.stock}
        unit={item.unit}
        open={movementDialogOpen}
        onOpenChange={setMovementDialogOpen}
      />
    </div>
  )
}
