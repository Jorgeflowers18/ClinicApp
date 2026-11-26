import { Building2, Check } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { InstitutionIdentity } from "@/modules/institution/components/institution-brand";
import { useDemoContext, useSaasData, useSessionUser } from "../state";
export function OrganizationSelector() {
    const data = useSaasData(), context = useDemoContext(), actor = useSessionUser();
    const location = useLocation(), navigate = useNavigate();
    const member = data.users.find(user => user.id === context.userId);
    const organizations = data.organizations.filter(org => member ? member.organizationIds.includes(org.id) : actor?.role === "admin");
    const org = organizations.find(item => item.id === context.organizationId);
    const sites = (org?.branches ?? []).filter(site => !member || member.roles.includes("admin") || member.assignments.some(item => item.organizationId === org?.id && item.siteId === site.id && item.active));
    if (!context.userId && !/^\/personal-accesos/.test(location.pathname))
        return null;
    if (!org)
        return null;
    function select(orgId: string, siteId: string) {
        if (!confirm("¿Cambiar el contexto? Los formularios abiertos se cerrarán y se actualizarán los datos visibles."))
            return;
        context.select(orgId, siteId);
        navigate(location.pathname);
    }
    function firstSite(orgId: string) {
        const branches = organizations.find(item => item.id === orgId)?.branches ?? [];
        const allowed = branches.filter(site => !member || member.roles.includes("admin") || member.assignments.some(item => item.active && item.organizationId === orgId && item.siteId === site.id));
        return allowed.find(site => site.isMain)?.id ?? allowed[0]?.id ?? "";
    }
    const label = sites.find(site => site.id === context.siteId)?.name || org.name;
    if (organizations.length === 1 && sites.length <= 1)
        return <span className="saas-context-label">{label}</span>;
    return <DropdownMenu>
    <DropdownMenuTrigger render={<Button variant="outline" size="sm" className="saas-context-button" title={`${org.name} · ${label}`} aria-label="Cambiar organización o sede"/>}>
      <Building2 className="size-4"/><span>{label}</span>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="w-64 max-w-[calc(100vw-24px)]">
      <DropdownMenuGroup>
        <DropdownMenuLabel>Organizaciones · demostración</DropdownMenuLabel>
        {organizations.map(item => <DropdownMenuItem key={item.id} onClick={() => select(item.id, firstSite(item.id))}>
          {item.id === org.id && <Check />}{item.name}
        </DropdownMenuItem>)}
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuGroup>
        <DropdownMenuLabel>Sede activa</DropdownMenuLabel>
        {sites.map(site => <DropdownMenuItem key={site.id} onClick={() => select(org.id, site.id)}>
          {site.id === context.siteId && <Check />}{site.name}
        </DropdownMenuItem>)}
      </DropdownMenuGroup>
    </DropdownMenuContent>
  </DropdownMenu>;
}
export function DemoSidebarIdentity({ collapsed }: {
    collapsed: boolean;
}) {
    const data = useSaasData(), id = useDemoContext(state => state.organizationId);
    const org = data.organizations.find(item => item.id === id);
    return <div className="clinic-sidebar-brand"><InstitutionIdentity name={org?.name ?? "Demostración"} subtitle="Demostración frontend" image={org?.logo ?? null} collapsed={collapsed}/></div>;
}
