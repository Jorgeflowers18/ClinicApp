import { Building2, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { InstitutionIdentity } from "@/modules/institution/components/institution-brand"
import { useDemoContext, useSaasData } from "../state"
import { useInstitutionProfile } from "@/modules/institution/hooks/use-institution-profile"

export function OrganizationSelector() {
  const context = useDemoContext(), data = useSaasData(), profile = useInstitutionProfile()
  if (!context.userId) return null
  const member = data.users.find(user => user.id === context.userId)
  const sites = profile.branches.filter(site => member?.roles.includes("admin") || member?.assignments.some(item => item.organizationId === context.organizationId && item.siteId === site.id && item.active))
  const label = sites.find(site => site.id === context.siteId)?.name || profile.name.trim() || "Institución sin configurar"
  if (!sites.length || sites.length === 1 && sites[0].id === context.siteId) return <span className="saas-context-label">{label}</span>
  return <DropdownMenu>
    <DropdownMenuTrigger render={<Button variant="outline" size="sm" className="saas-context-button" aria-label="Cambiar sede" />}><Building2 /><span>{label}</span></DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      {sites.map(site => <DropdownMenuItem key={site.id} onClick={() => {
        if (confirm("¿Cambiar de sede? Guarda o cierra primero los formularios abiertos.")) context.select(context.organizationId, site.id)
      }}>{site.id === context.siteId && <Check />}{site.name}</DropdownMenuItem>)}
    </DropdownMenuContent>
  </DropdownMenu>
}
export function DemoSidebarIdentity({ collapsed }: { collapsed: boolean }) {
  const profile = useInstitutionProfile()
  return <div className="clinic-sidebar-brand"><InstitutionIdentity name={profile.name.trim() || "Institución sin configurar"} subtitle={profile.subtitle} image={profile.logoImage} collapsed={collapsed} /></div>
}
