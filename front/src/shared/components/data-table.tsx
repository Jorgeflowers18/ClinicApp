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
  mobileTitleKey?: string
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
  mobileTitleKey,
}: DataTableProps<T>) {
  const titleColumn = columns.find((column) => column.key === mobileTitleKey) ?? columns[0]
  const detailColumns = columns.filter((column) => column !== titleColumn && column.header)
  const actionColumns = columns.filter((column) => !column.header)

  return (
    <div className="@container min-w-0">
      <div className="hidden rounded-lg border @md:block">
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
                  <EmptyState title={emptyTitle} description={emptyDescription} />
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

      <div className="space-y-3 @md:hidden">
        {isLoading &&
          Array.from({ length: 3 }).map((_, index) => (
            <div key={`card-skeleton-${index}`} className="space-y-3 rounded-lg border p-4">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-4 w-full max-w-52" />
              <Skeleton className="h-4 w-full max-w-40" />
            </div>
          ))}

        {!isLoading && isError && (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertTitle>No se pudo cargar la información</AlertTitle>
            <AlertDescription>
              {errorMessage ?? "Intenta nuevamente en unos momentos."}
            </AlertDescription>
          </Alert>
        )}

        {!isLoading && !isError && data.length === 0 && (
          <div className="rounded-lg border py-8">
            <EmptyState title={emptyTitle} description={emptyDescription} />
          </div>
        )}

        {!isLoading &&
          !isError &&
          data.map((row) => {
            const cardContent = (
              <div className="min-w-0 space-y-3 text-left">
                {titleColumn && (
                  <div className="min-w-0 text-sm font-semibold text-foreground">
                    {titleColumn.cell(row)}
                  </div>
                )}
                {detailColumns.length > 0 && (
                  <dl className="grid min-w-0 grid-cols-1 gap-x-4 gap-y-3 text-sm @md:grid-cols-2">
                    {detailColumns.map((column) => (
                      <div key={column.key} className="min-w-0 space-y-1">
                        <dt className="text-xs font-medium text-muted-foreground">{column.header}</dt>
                        <dd className="min-w-0 break-words text-foreground">{column.cell(row)}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </div>
            )

            return (
              <article
                key={getRowId(row)}
                className="min-w-0 space-y-3 rounded-lg border bg-card p-4 shadow-sm"
              >
                {onRowClick ? (
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => onRowClick(row)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault()
                        onRowClick(row)
                      }
                    }}
                    className="block w-full cursor-pointer rounded text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {cardContent}
                  </div>
                ) : cardContent}
                {actionColumns.length > 0 && (
                  <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-3">
                    {actionColumns.map((column) => (
                      <div key={column.key} className="flex items-center">
                        {column.cell(row)}
                      </div>
                    ))}
                  </div>
                )}
              </article>
            )
          })}
      </div>
    </div>
  )
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col items-center gap-2 text-center text-muted-foreground">
      <Inbox className="size-8" />
      <p className="font-medium text-foreground">{title}</p>
      <p className="text-sm">{description}</p>
    </div>
  )
}
