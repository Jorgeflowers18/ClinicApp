import { Badge } from "@/components/ui/badge"

export function TreatmentStatus({ active }: { active: boolean }) {
  return <Badge variant="outline" className="treatment-status" data-active={active}>{active ? "Activo" : "Inactivo"}</Badge>
}
