import { LoaderCircle } from "lucide-react"

/** Mientras se confirma la sesión al recargar con la API (`POST /auth/refresh`). */
export function SessionChecking() {
  return (
    <div role="status" aria-live="polite" className="flex min-h-svh items-center justify-center gap-2 text-sm text-muted-foreground">
      <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
      Comprobando la sesión…
    </div>
  )
}
