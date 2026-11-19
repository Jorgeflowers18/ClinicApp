import { AlertTriangle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

export function ReportError() {
  return <Alert variant="destructive"><AlertTriangle aria-hidden="true" /><AlertDescription>No se pudo cargar este reporte. Vuelve a intentarlo más tarde.</AlertDescription></Alert>
}
