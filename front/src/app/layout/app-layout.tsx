import { useEffect, useState, type ReactElement } from "react"
import { Link, NavLink, Outlet, useLocation } from "react-router-dom"
import { Menu, X } from "lucide-react"
import { Dialog as NavigationDialog } from "@base-ui/react/dialog"

import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { GlobalNotificationCenter } from "@/modules/notifications/components/global-notification-center"
import { MessagingDraftProvider } from "@/modules/notifications/components/messaging-draft-provider"
import { InstitutionSidebarBrand } from "@/modules/institution/components/institution-brand"
import { navItems, type NavItem } from "../nav-config"
import { HeaderThemeSwitch } from "./header-theme-switch"
import { HeaderUserMenu } from "./header-user-menu"
import { useDemoContext,useSessionUser,useSaasData } from "@/modules/saas/state"
import { canViewNavigationItem } from "@/modules/saas/lib/navigation-visibility"
import { DemoSidebarIdentity,OrganizationSelector } from "@/modules/saas/components/context-selector"
import { SaasScopeBoundary } from "@/modules/saas/components/scope-boundary"
import "@/modules/saas/saas.css"

const navigationGroups = [
  { label: "General", paths: ["/"] },
  { label: "Atención clínica", paths: ["/pacientes", "/citas", "/historial-clinico", "/tratamientos"] },
  { label: "Gestión", paths: ["/inventario", "/finanzas", "/reportes"] },
  { label: "Accesos", paths: ["/accesos", "/accesos/roles", "/accesos/solicitudes"] },
  { label: "Comunicación", paths: ["/notificaciones"] },
]

export function AppLayout() {
  const user = useSessionUser()
  const demo = useDemoContext(state=>state.userId)
  const saas = useSaasData(), member = saas.users.find(item => item.id === demo)
  const { pathname } = useLocation()
  const [isMobileViewport, setIsMobileViewport] = useState(() => window.matchMedia("(max-width: 767px)").matches)
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(() => window.matchMedia("(min-width: 1024px)").matches)
  const [mobileNavigationHandle] = useState(() => NavigationDialog.createHandle())

  useEffect(() => {
    const mobile = window.matchMedia("(max-width: 767px)")
    const desktop = window.matchMedia("(min-width: 1024px)")
    const updateViewport = () => {
      setIsMobileViewport(mobile.matches)
      setIsSidebarExpanded(desktop.matches)
    }
    mobile.addEventListener("change", updateViewport)
    desktop.addEventListener("change", updateViewport)
    return () => {
      mobile.removeEventListener("change", updateViewport)
      desktop.removeEventListener("change", updateViewport)
    }
  }, [])

  const visibleItems = navItems.filter(item => item.placement !== "profile" && canViewNavigationItem(item, {
    user, member, data: saas, organizationId: member ? useDemoContext.getState().organizationId : "frontend-institution-current",
  }))
  const isClinicalRoute = pathname.startsWith("/historial-clinico")
  const isPilotRoute = pathname === "/" || pathname === "/pacientes" || pathname.startsWith("/pacientes/")
  const isAdminVisualRoute = !isClinicalRoute
  const currentSection = pathname === "/" ? navItems[0] : [...navItems].sort((a,b) => b.to.length-a.to.length).find((item) => pathname === item.to || pathname.startsWith(`${item.to}/`))
  const currentSectionLabel = pathname === "/perfil-institucion" ? "Perfil institucional"
    : pathname === "/perfil-usuario" ? "Mi perfil" : pathname.startsWith("/administracion") ? "Administración" : currentSection?.label ?? "Página no encontrada"

  // Preserve ProtectedRoute's existing first-login setup and redirects.
  if (pathname === "/perfil-usuario" && (!user?.profile || !user.profile.fullName?.trim())) return <Outlet />

  const navigationButton = <Button variant="ghost" size="icon" className="clinic-header-icon clinic-sidebar-toggle"
    aria-label={isSidebarExpanded ? "Cerrar menú" : "Abrir menú"}
    aria-expanded={isSidebarExpanded} aria-controls={isMobileViewport ? "mobile-sidebar" : "desktop-sidebar"}
    data-sidebar-toggle="" data-state={isSidebarExpanded ? "open" : "closed"}
    onClick={isMobileViewport ? undefined : () => setIsSidebarExpanded((expanded) => !expanded)}>
    <span className="clinic-navigation-toggle-icons" aria-hidden="true">
      <Menu className="clinic-navigation-menu-icon" strokeWidth={2} />
      <X className="clinic-navigation-close-icon" strokeWidth={2} />
    </span>
  </Button>

  return (
    <MessagingDraftProvider><div className={cn("clinic-app-shell", isAdminVisualRoute && "clinic-admin-shell", isClinicalRoute && "clinic-clinical-shell", isPilotRoute && "clinic-pilot-shell")}
      data-sidebar-expanded={!isMobileViewport && isSidebarExpanded} data-mobile-navigation-open={isMobileViewport && isSidebarExpanded}>
      <aside id="desktop-sidebar" className={cn("clinic-app-sidebar", isAdminVisualRoute && "clinic-admin-sidebar")}>
        <SidebarContent visibleItems={visibleItems} isCollapsed={!isSidebarExpanded} />
      </aside>
      <Sheet handle={mobileNavigationHandle} modal={false} open={isMobileViewport && isSidebarExpanded} onOpenChange={setIsSidebarExpanded}>
        <SheetContent id="mobile-sidebar" side="left" showCloseButton={false}
          className={cn("clinic-app-sidebar-panel", isAdminVisualRoute && "clinic-admin-sidebar-panel")}>
          <SheetTitle className="sr-only">Navegación principal</SheetTitle>
          <SidebarContent visibleItems={visibleItems} isCollapsed={false} onNavigate={() => setIsSidebarExpanded(false)} />
        </SheetContent>
      </Sheet>
      <div className="flex min-h-0 min-w-0 flex-col">
        <header className={cn("clinic-app-header", isAdminVisualRoute && "clinic-admin-header")}>
          <div className="clinic-header-navigation">
            <Tooltip>
              <TooltipTrigger render={isMobileViewport ? <SheetTrigger handle={mobileNavigationHandle} render={navigationButton} /> : navigationButton} />
              <TooltipContent side="bottom">{isSidebarExpanded ? "Contraer navegación" : "Abrir navegación"}</TooltipContent>
            </Tooltip>
            <nav aria-label="Migas de pan" className="clinic-header-breadcrumb">
              <ol>
                <li className="clinic-breadcrumb-home"><Link to="/">Inicio</Link></li>
                <li aria-hidden="true" className="clinic-breadcrumb-home">/</li>
                <li aria-current="page">{currentSectionLabel}</li>
              </ol>
            </nav>
          </div>
          <div className="clinic-header-tools">
            <OrganizationSelector />
            <HeaderThemeSwitch />
            {user && <GlobalNotificationCenter key={user.id} userId={user.id} role={user.role} />}
            <HeaderUserMenu />
          </div>
        </header>
        <main className={cn("clinic-app-canvas min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto p-4 sm:p-6", isAdminVisualRoute && "clinic-admin-canvas", isClinicalRoute && "clinic-clinical-canvas", isPilotRoute && "clinic-pilot-canvas")}>
          <SaasScopeBoundary />
        </main>
      </div>
    </div></MessagingDraftProvider>
  )
}

function SidebarContent({ visibleItems, isCollapsed, onNavigate }: {
  visibleItems: NavItem[]; isCollapsed: boolean; onNavigate?: () => void
}) {
  const demo=useDemoContext(state=>state.userId)
  return (
    <div className="clinic-sidebar-content" data-collapsed={isCollapsed}>
      {demo?<DemoSidebarIdentity collapsed={isCollapsed}/>:<InstitutionSidebarBrand collapsed={isCollapsed} />}
      <nav aria-label="Navegación principal" className="clinic-sidebar-navigation">
        {navigationGroups.map((group) => {
          const items = group.paths.flatMap((path) => visibleItems.filter((item) => item.to === path))
          if (!items.length) return null
          return <section key={group.label} aria-label={group.label} className="clinic-sidebar-group">
            <h2 className={isCollapsed ? "sr-only" : "clinic-sidebar-group-label"}>{group.label}</h2>
            {items.map((item) => {
              const link = <NavLink to={item.to} end={item.to === "/" || item.to === "/accesos"} onClick={onNavigate} aria-label={item.label}
                className="clinic-sidebar-link" key={item.to}>
                <item.icon aria-hidden="true" strokeWidth={2} />{!isCollapsed && <span>{item.label}</span>}
              </NavLink>
              return isCollapsed ? <SidebarTooltip key={item.to} label={item.label}>{link}</SidebarTooltip> : link
            })}
          </section>
        })}
      </nav>
    </div>
  )
}

function SidebarTooltip({ label, children }: { label: string; children: ReactElement }) {
  return <Tooltip><TooltipTrigger render={children} /><TooltipContent side="right" sideOffset={8}>{label}</TooltipContent></Tooltip>
}
