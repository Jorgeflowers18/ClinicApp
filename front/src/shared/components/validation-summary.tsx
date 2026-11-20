import { CircleAlert } from "lucide-react"
import { Button } from "@/components/ui/button"

export function ValidationSummary({ count, onFirst, children }: { count: number; onFirst?: () => void; children?: React.ReactNode }) {
  if (!count) return null
  return <div role="alert" className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-destructive" data-validation-summary>
    <CircleAlert aria-hidden="true" className="size-4 shrink-0" />
    <span>{count === 1 ? "Hay un campo que requiere atención." : `Hay ${count} campos que requieren atención.`}</span>
    {onFirst && <Button type="button" variant="link" size="sm" className="h-auto min-h-0 p-0 text-xs text-destructive" onClick={onFirst}>Ir al primer error</Button>}
    {children}
  </div>
}
