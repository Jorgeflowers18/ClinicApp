import { useLocation, useNavigate } from "react-router-dom"
import { Building2, DoorOpen, Settings2, Stethoscope } from "lucide-react"
import { AdaptiveTabs } from "@/components/ui/adaptive-tabs"
import { TabsContent } from "@/components/ui/tabs"
import { PageHeader } from "@/shared/components/page-header"
import { RoomsAdmin } from "@/modules/appointments/components/agenda-catalogs-admin"
import { InstitutionBranchesAdmin } from "@/modules/institution/components/institution-branches-admin"
import { AccessCatalogManagement } from "@/modules/saas/components/access-catalog-management"
import { SpecialtyManagement, SpecialtyEditor } from "@/modules/saas/components/specialties"
import { useStaffInstitution } from "@/modules/saas/lib/institution-scope"
import type { Specialty } from "@/modules/saas/types"
import { useState } from "react"

export function AdministrationPage() {
  const location = useLocation(), navigate = useNavigate(), { organizationId } = useStaffInstitution()
  const requested = location.pathname.split("/")[2] || "sedes"
  const tab = ["sedes", "roles-tipos", "especialidades", "consultorios"].includes(requested) ? requested : "sedes"
  const [specialtyEditor, setSpecialtyEditor] = useState<Specialty | null | undefined>()
  return <div className="saas-scope saas-stack">
    <PageHeader title="Administración" description="Configura las sedes y los catálogos de tu institución." />
    <AdaptiveTabs value={tab} onValueChange={value => navigate("/administracion/" + value)} variant="line" items={[
      { value: "sedes", label: <><Building2 aria-hidden="true" />Sedes</>, accessibleLabel: "Sedes" },
      { value: "roles-tipos", label: <><Settings2 aria-hidden="true" />Roles y tipos de profesionales</>, accessibleLabel: "Roles y tipos de profesionales" },
      { value: "especialidades", label: <><Stethoscope aria-hidden="true" />Especialidades</>, accessibleLabel: "Especialidades" },
      { value: "consultorios", label: <><DoorOpen aria-hidden="true" />Consultorios</>, accessibleLabel: "Consultorios" },
    ]}>
      <TabsContent value="sedes"><InstitutionBranchesAdmin /></TabsContent>
      <TabsContent value="roles-tipos"><AccessCatalogManagement /></TabsContent>
      <TabsContent value="especialidades"><SpecialtySection onNew={() => setSpecialtyEditor(null)} onEdit={setSpecialtyEditor} /></TabsContent>
      <TabsContent value="consultorios"><RoomsAdmin /></TabsContent>
    </AdaptiveTabs>
    {specialtyEditor !== undefined && <SpecialtyEditor specialty={specialtyEditor} organizationId={organizationId} onClose={() => setSpecialtyEditor(undefined)} />}
  </div>
}
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
function SpecialtySection({ onNew, onEdit }: { onNew: () => void; onEdit: (item: Specialty) => void }) {
  return <div className="saas-stack"><div className="saas-actions"><Button onClick={onNew}><Plus />Nueva especialidad</Button></div><SpecialtyManagement onEdit={onEdit} /></div>
}
