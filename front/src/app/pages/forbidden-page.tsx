import { Link } from "react-router-dom"
import { ShieldAlert } from "lucide-react"

import { Button } from "@/components/ui/button"

export function ForbiddenPage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-3 text-center">
      <ShieldAlert className="size-10 text-muted-foreground" />
      <h1 className="text-xl font-semibold">Acceso restringido</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        Tu rol no tiene permisos para ver esta sección.
      </p>
      <Button nativeButton={false} render={<Link to="/" />}>
        Volver al panel
      </Button>
    </div>
  )
}
