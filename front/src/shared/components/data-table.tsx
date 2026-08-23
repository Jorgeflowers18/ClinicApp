import type { ReactNode } from "react"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle, Inbox } from "lucide-react"

export interface DataTableColumn<T> {
  key: string
  header: string
  cell: (row: T) => ReactNode
  className?: string
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[]
  data: T[]
  getRowId: (row: T) => string
  isLoading?: boolean
  isError?: boolean
  errorMessage?: string
  emptyTitle?: string
  emptyDescription?: string
  onRowClick?: (row: T) => void
}

export function DataTable<T>({
  columns,
  data,
  getRowId,
  isLoading,
  isError,
  errorMessage,
  emptyTitle = "Sin resultados",
  emptyDescription = "No se encontraron registros con los criterios actuales.",
  onRowClick,
}: DataTableProps<T>) {
  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((column) => (
              <TableHead key={column.key} className={column.className}>
                {column.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading &&
            Array.from({ length: 5 }).map((_, index) => (
              <TableRow key={`skeleton-${index}`}>
                {columns.map((column) => (
                  <TableCell key={column.key}>
                    <Skeleton className="h-5 w-full max-w-40" />
                  </TableCell>
                ))}
              </TableRow>
            ))}

          {!isLoading && isError && (
            <TableRow>
              <TableCell colSpan={columns.length} className="py-8">
                <Alert variant="destructive" className="mx-auto max-w-md">
                  <AlertCircle className="size-4" />
                  <AlertTitle>No se pudo cargar la información</AlertTitle>
                  <AlertDescription>
                    {errorMessage ?? "Intenta nuevamente en unos momentos."}
                  </AlertDescription>
                </Alert>
              </TableCell>
            </TableRow>
          )}

          {!isLoading && !isError && data.length === 0 && (
            <TableRow>
              <TableCell colSpan={columns.length} className="py-12">
                <div className="flex flex-col items-center gap-2 text-center text-muted-foreground">
                  <Inbox className="size-8" />
                  <p className="font-medium text-foreground">{emptyTitle}</p>
                  <p className="text-sm">{emptyDescription}</p>
                </div>
              </TableCell>
            </TableRow>
          )}

          {!isLoading &&
            !isError &&
            data.map((row) => (
              <TableRow
                key={getRowId(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={onRowClick ? "cursor-pointer" : undefined}
              >
                {columns.map((column) => (
                  <TableCell key={column.key} className={column.className}>
                    {column.cell(row)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
        </TableBody>
      </Table>
    </div>
  )
}
