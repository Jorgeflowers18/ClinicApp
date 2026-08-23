import { Link } from "react-router-dom"

import { Button } from "@/components/ui/button"

export function NotFoundPage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-3 text-center">
      <p className="text-6xl font-semibold text-muted-foreground">404</p>
      <h1 className="text-xl font-semibold">Página no encontrada</h1>
      <p className="text-sm text-muted-foreground">La página que buscas no existe o fue movida.</p>
      <Button nativeButton={false} render={<Link to="/" />}>
        Volver al panel
      </Button>
    </div>
  )
}
