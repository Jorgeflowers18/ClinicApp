import { useState } from "react"
import { Navigate, useLocation } from "react-router-dom"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/shared/components/page-header"
import { SectionNavigationTabs, SectionNavigationPanel } from "@/shared/components/section-navigation"
import { useSectionQueryState } from "@/shared/hooks/use-section-query-state"
import { RoomsAdmin } from "@/modules/appointments/components/agenda-catalogs-admin"
import { InstitutionBranchesAdmin } from "@/modules/institution/components/institution-branches-admin"
import { CatalogManagement } from "@/modules/saas/components/access-catalog-management"
import { SpecialtyManagement, SpecialtyEditor } from "@/modules/saas/components/specialties"
import { useStaffInstitution } from "@/modules/saas/lib/institution-scope"
import type { Specialty } from "@/modules/saas/types"
import { useDemoContext, useSaasData, useSessionUser } from "@/modules/saas/state"
import { canViewNavigationItem } from "@/modules/saas/lib/navigation-visibility"
import { navItems } from "../nav-config"
import styles from "./administration-page.module.css"

const descriptions: Record<string, string> = {
  sedes: "Ubicaciones, contacto y horarios",
  consultorios: "Espacios de atención de tus sedes",
  especialidades: "Áreas de especialización clínica",
  "tipos-profesionales": "Clasificación del personal profesional",
}

export function AdministrationPage() {
  const location = useLocation()
  const requested = location.pathname.split("/")[2]
  // Existing bookmarks open the same workspace, with the requested tab selected.
  if (requested) {
    const params = new URLSearchParams(location.search)
    const section = requested === "roles-tipos" ? "tipos-profesionales" : requested
    if (Object.hasOwn(descriptions, section)) params.set("seccion", section)
    return <Navigate replace to={{ pathname: "/administracion", search: params.toString(), hash: location.hash }} />
  }
  return <AdministrationWorkspace />
}

function AdministrationWorkspace() {
  const { organizationId } = useStaffInstitution()
  return <AdministrationSections key={organizationId} organizationId={organizationId} />
}

function AdministrationSections({ organizationId }: { organizationId: string }) {
  const user = useSessionUser(), data = useSaasData(), demo = useDemoContext()
  const member = data.users.find(item => item.id === demo.userId)
  const items = navItems.filter(item => item.placement === "profile").map(item => ({
    value: item.to.split("/")[2], title: item.label, icon: item.icon,
    description: descriptions[item.to.split("/")[2]],
    permitted: canViewNavigationItem(item, { user, member, data, organizationId }),
  }))
  const [section, setSection] = useSectionQueryState(items, "sedes")
  return <div className={styles.home}>
    <PageHeader title="Administración" description="Configura las sedes, consultorios y catálogos de tu institución" />
    <SectionNavigationTabs label="Secciones de Administración" items={items} value={section} onValueChange={setSection}>
      <SectionNavigationPanel value="sedes" className={styles.panel}><InstitutionBranchesAdmin standalone /></SectionNavigationPanel>
      <SectionNavigationPanel value="consultorios" className={styles.panel}>
        <div className="saas-scope saas-stack"><PageHeader headingLevel={2} title="Consultorios" description="Gestiona los espacios de atención de tu clínica." /><RoomsAdmin /></div>
      </SectionNavigationPanel>
      <SectionNavigationPanel value="especialidades" className={styles.panel}><SpecialtiesSection organizationId={organizationId} /></SectionNavigationPanel>
      <SectionNavigationPanel value="tipos-profesionales" className={styles.panel}>
        <div className="saas-scope saas-stack"><CatalogManagement kind="type" heading={{ title: "Tipos de profesionales", description: "Administra los tipos de profesionales de tu institución.", headingLevel: 2 }} /></div>
      </SectionNavigationPanel>
    </SectionNavigationTabs>
  </div>
}

function SpecialtiesSection({ organizationId }: { organizationId: string }) {
  const [editor, setEditor] = useState<Specialty | null | undefined>()
  return <div className="saas-scope saas-stack">
    <PageHeader headingLevel={2} title="Especialidades" description="Gestiona las especialidades y sus tipos profesionales compatibles." actions={<Button onClick={() => setEditor(null)}><Plus/>Nueva especialidad</Button>}/>
    <SpecialtyManagement onEdit={setEditor}/>
    {editor !== undefined && <SpecialtyEditor key={editor?.id ?? "new"} specialty={editor} organizationId={organizationId} onClose={() => setEditor(undefined)}/>}
  </div>
}
