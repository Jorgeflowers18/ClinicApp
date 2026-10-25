import { useEffect, useState, type ReactElement } from "react"
import { Link, NavLink, Outlet, useLocation } from "react-router-dom"
import { Building2, LogOut, Menu, MoonStar, SunMedium, UserRound } from "lucide-react"
import { useTheme } from "next-themes"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { useLogout } from "@/modules/auth/api/auth.queries"
import { useAuthStore } from "@/modules/auth/store/auth-store"
import { BrandLogo } from "@/shared/components/brand-logo"

import { navItems, type NavItem } from "../nav-config"

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  recepcion: "Recepcion",
  medico: "Personal medico",
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

export function AppLayout() {
  const user = useAuthStore((state) => state.user)
  const logout = useLogout()
  const { pathname } = useLocation()
  const { resolvedTheme, setTheme } = useTheme()
  const isDarkTheme = resolvedTheme === "dark"
  const isLoggingOut = logout.isPending
  const [isMobileViewport, setIsMobileViewport] = useState(
    () => window.matchMedia("(max-width: 1023px)").matches
  )
  const [hasHoverPointer, setHasHoverPointer] = useState(
    () => window.matchMedia("(hover: hover) and (pointer: fine)").matches
  )
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(
    () => !window.matchMedia("(max-width: 1023px)").matches
  )

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 1023px)")
    const updateViewport = (event: MediaQueryListEvent) => {
      setIsMobileViewport(event.matches)
      setIsSidebarExpanded(!event.matches)
    }
    mediaQuery.addEventListener("change", updateViewport)
    const pointerQuery = window.matchMedia("(hover: hover) and (pointer: fine)")
    const updatePointer = (event: MediaQueryListEvent) => setHasHoverPointer(event.matches)
    pointerQuery.addEventListener("change", updatePointer)
    return () => {
      mediaQuery.removeEventListener("change", updateViewport)
      pointerQuery.removeEventListener("change", updatePointer)
    }
  }, [])

  const handleLogout = () => {
    if (!isLoggingOut) {
      logout.mutate()
    }
  }

  const visibleItems = navItems.filter(
    (item) => !item.roles || (user && item.roles.includes(user.role))
  )
  const isClinicalRoute = pathname.startsWith("/historial-clinico")
  const isPilotRoute = pathname === "/" || pathname === "/pacientes" || pathname.startsWith("/pacientes/")
  const isAdminVisualRoute = !isClinicalRoute
  const currentSection = pathname === "/"
    ? navItems[0]
    : navItems.find((item) => pathname === item.to || pathname.startsWith(`${item.to}/`))
  const currentSectionLabel =
    pathname === "/perfil-institucion"
      ? "Perfil institucional"
      : pathname === "/perfil-usuario"
        ? "Mi perfil"
        : currentSection?.label ?? "Página no encontrada"

  // Keep the existing first-login setup independent of the application chrome.
  // ProtectedRoute still owns the same setup condition and redirects.
  if (pathname === "/perfil-usuario" && (!user?.profile || !user.profile.fullName?.trim())) {
    return <Outlet />
  }

  return (
    <div
      className={cn(
        "clinic-app-shell grid h-dvh min-h-0 min-w-0 grid-cols-[minmax(0,1fr)] overflow-hidden transition-[grid-template-columns] duration-200 lg:grid-cols-[72px_minmax(0,1fr)]",
        isAdminVisualRoute && "clinic-admin-shell",
        isClinicalRoute && "clinic-clinical-shell",
        isPilotRoute && "clinic-pilot-shell",
        isSidebarExpanded && !isMobileViewport && "lg:grid-cols-[256px_minmax(0,1fr)]"
      )}
    >
      <aside className={cn("clinic-app-sidebar hidden min-h-0 min-w-0 flex-col overflow-hidden border-r bg-sidebar lg:flex", isAdminVisualRoute && "clinic-admin-sidebar")}>
        <SidebarContent
          visibleItems={visibleItems}
          isAdmin={user?.role === "admin"}
          isDarkTheme={isDarkTheme}
          isCollapsed={!isSidebarExpanded}
          isMobile={isMobileViewport}
          canShowTooltips={hasHoverPointer}
          onToggleSidebar={() => setIsSidebarExpanded((expanded) => !expanded)}
          onToggleTheme={() => setTheme(isDarkTheme ? "light" : "dark")}
          onNavigate={() => {
            if (isMobileViewport) setIsSidebarExpanded(false)
          }}
          onLogout={handleLogout}
          isLoggingOut={isLoggingOut}
        />
      </aside>

      <Sheet
        open={isMobileViewport && isSidebarExpanded}
        onOpenChange={(open) => setIsSidebarExpanded(open)}
      >
        <SheetContent
          side="left"
          showCloseButton={false}
          className={cn("clinic-app-sidebar-panel w-[min(16rem,85vw)] max-w-none gap-0 overflow-hidden p-0 data-[side=left]:w-[min(16rem,85vw)]", isAdminVisualRoute && "clinic-admin-sidebar-panel")}
        >
          <SheetTitle className="sr-only">Navegación principal</SheetTitle>
          <SidebarContent
            visibleItems={visibleItems}
            isAdmin={user?.role === "admin"}
            isDarkTheme={isDarkTheme}
            isCollapsed={false}
            isMobile
            canShowTooltips={hasHoverPointer}
            onToggleSidebar={() => setIsSidebarExpanded(false)}
            onToggleTheme={() => setTheme(isDarkTheme ? "light" : "dark")}
            onNavigate={() => setIsSidebarExpanded(false)}
            onLogout={() => {
              setIsSidebarExpanded(false)
              handleLogout()
            }}
            isLoggingOut={isLoggingOut}
          />
        </SheetContent>
      </Sheet>

      <div className="flex min-h-0 min-w-0 flex-col">
        <header className={cn("clinic-app-header flex h-16 min-w-0 shrink-0 items-center justify-between gap-2 border-b px-3 sm:gap-3 sm:px-4 md:px-6", isAdminVisualRoute && "clinic-admin-header")}>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0 lg:hidden"
            aria-label="Abrir menú"
            aria-haspopup="dialog"
            aria-expanded={isMobileViewport && isSidebarExpanded}
            onClick={() => setIsSidebarExpanded(true)}
          >
            <Menu aria-hidden="true" />
          </Button>
          <nav aria-label="Migas de pan" className="min-w-0 flex-1 overflow-hidden">
            <ol className="flex min-w-0 items-center gap-2 text-sm">
              <li className="shrink-0">
                <Link to="/" className="text-muted-foreground transition-colors hover:text-foreground">
                  Inicio
                </Link>
              </li>
              <li aria-hidden="true" className="shrink-0 text-muted-foreground/60">/</li>
              <li aria-current="page" className="truncate font-medium text-foreground">
                {currentSectionLabel}
              </li>
            </ol>
          </nav>

          <div
            role="group"
            aria-label={user ? `Usuario autenticado: ${user.name}, ${ROLE_LABELS[user.role]}` : "Usuario autenticado"}
            className="flex min-h-11 min-w-11 shrink-0 items-center gap-2.5 rounded-lg px-1 py-1 sm:px-2"
          >
            <Avatar className="size-8">
              {user?.profile?.avatarImage ? (
                <img src={user.profile.avatarImage} alt="" className="size-full rounded-full object-cover" />
              ) : (
                <AvatarFallback>{user ? getInitials(user.name) : "?"}</AvatarFallback>
              )}
            </Avatar>
            <div className="max-w-24 text-left sm:max-w-44">
              <p className="truncate text-sm font-medium leading-4">{user?.name}</p>
              <p className="truncate text-xs leading-4 text-muted-foreground">
                {user ? ROLE_LABELS[user.role] : ""}
              </p>
            </div>
          </div>
        </header>

        <main className={cn("clinic-app-canvas min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto p-4 sm:p-6", isAdminVisualRoute && "clinic-admin-canvas", isClinicalRoute && "clinic-clinical-canvas", isPilotRoute && "clinic-pilot-canvas")}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}

function AnimatedMenuIcon({ isOpen }: { isOpen: boolean }) {
  return (
    <span aria-hidden="true" className="relative block size-5">
      <span
        className={cn(
          "absolute left-0 h-0.5 w-5 rounded-full bg-current transition-[top,transform] duration-[225ms] ease-in-out",
          isOpen ? "top-[9px] rotate-45" : "top-[3px]"
        )}
      />
      <span
        className={cn(
          "absolute left-0 top-[9px] h-0.5 w-5 rounded-full bg-current transition-[transform,opacity] duration-[225ms] ease-in-out",
          isOpen ? "scale-x-0 opacity-0" : "scale-x-100 opacity-100"
        )}
      />
      <span
        className={cn(
          "absolute left-0 h-0.5 w-5 rounded-full bg-current transition-[top,transform] duration-[225ms] ease-in-out",
          isOpen ? "top-[9px] -rotate-45" : "top-[15px]"
        )}
      />
    </span>
  )
}

interface SidebarContentProps {
  visibleItems: NavItem[]
  isAdmin: boolean
  isDarkTheme: boolean
  isCollapsed: boolean
  isMobile: boolean
  canShowTooltips: boolean
  onToggleSidebar: () => void
  onToggleTheme: () => void
  onNavigate: () => void
  onLogout: () => void
  isLoggingOut: boolean
}

function SidebarContent({
  visibleItems,
  isAdmin,
  isDarkTheme,
  isCollapsed,
  isMobile,
  canShowTooltips,
  onToggleSidebar,
  onToggleTheme,
  onNavigate,
  onLogout,
  isLoggingOut,
}: SidebarContentProps) {
  const tooltipEnabled = isCollapsed && !isMobile && canShowTooltips
  const toggleTooltipEnabled = !isMobile && canShowTooltips
  const linkClass = (active: boolean) =>
    cn(
      "flex min-h-11 w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
      "clinic-sidebar-link",
      isCollapsed && "justify-center px-0",
      active && "bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary"
    )
  const actionClass = cn(
    "min-h-11 w-full justify-start gap-2.5 text-muted-foreground hover:text-foreground",
    isCollapsed && "justify-center px-0"
  )
  const toggleButton = (
    <Button
      variant="ghost"
      className="h-10 w-10 shrink-0 justify-center rounded-full p-0 transition-colors duration-200"
      aria-label={isCollapsed ? "Abrir menú" : "Cerrar menú"}
      aria-expanded={!isCollapsed}
      onClick={onToggleSidebar}
    >
      <AnimatedMenuIcon isOpen={!isCollapsed} />
    </Button>
  )

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className={cn(
        "flex shrink-0 border-b",
        isCollapsed
          ? "flex-col items-center gap-2 px-2 py-3"
          : "min-h-16 items-center justify-between gap-2 px-2 py-2"
      )}>
        <div className={cn("flex min-w-0 items-center", isCollapsed ? "justify-center" : "gap-2")}>
          <BrandLogo />
          {!isCollapsed && (
            <span className="min-w-0 flex-1 text-sm font-semibold leading-4">
              ClinicApp Odontología
            </span>
          )}
        </div>
        {toggleTooltipEnabled ? (
          <SidebarTooltip
            label={isCollapsed ? "Menú" : "Cerrar"}
            side="top"
            delay={275}
          >
            {toggleButton}
          </SidebarTooltip>
        ) : toggleButton}
      </div>

      <nav
        aria-label="Navegación principal"
        className={cn("min-h-0 flex-1 space-y-1 overflow-x-hidden overflow-y-auto", isCollapsed ? "px-1 py-3 lg:px-2" : "p-3")}
      >
        {visibleItems.map((item) => {
          const link = (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              onClick={onNavigate}
              aria-label={isCollapsed ? item.label : undefined}
              className={({ isActive }) => linkClass(isActive)}
            >
              <item.icon className="size-4 shrink-0" />
              {!isCollapsed && <span className="truncate">{item.label}</span>}
            </NavLink>
          )
          return tooltipEnabled ? (
            <SidebarTooltip key={item.to} label={item.label}>{link}</SidebarTooltip>
          ) : link
        })}
      </nav>

      <div className={cn("shrink-0 space-y-1 border-t", isCollapsed ? "p-1 lg:p-2" : "p-3")}>
        <SidebarNavLink
          to="/perfil-usuario"
          label="Mi perfil"
          icon={<UserRound className="size-4 shrink-0" />}
          collapsed={isCollapsed}
          tooltipEnabled={tooltipEnabled}
          onNavigate={onNavigate}
          className={linkClass}
        />

        {isAdmin && (
          <SidebarNavLink
            to="/perfil-institucion"
            label="Perfil institucional"
            icon={<Building2 className="size-4 shrink-0" />}
            collapsed={isCollapsed}
            tooltipEnabled={tooltipEnabled}
            onNavigate={onNavigate}
            className={linkClass}
          />
        )}

        <SidebarAction
          label={isDarkTheme ? "Modo oscuro" : "Modo claro"}
          icon={isDarkTheme ? <MoonStar className="size-4" /> : <SunMedium className="size-4" />}
          collapsed={isCollapsed}
          tooltipEnabled={tooltipEnabled}
          className={actionClass}
          onClick={onToggleTheme}
        />

        <div className="my-2 border-t" />

        <SidebarAction
          label={isLoggingOut ? "Saliendo..." : "Salir"}
          icon={<LogOut className="size-4" />}
          collapsed={isCollapsed}
          tooltipEnabled={tooltipEnabled}
          className={actionClass}
          onClick={onLogout}
          disabled={isLoggingOut}
        />
      </div>
    </div>
  )
}

function SidebarTooltip({
  label,
  children,
  side = "right",
  delay = 0,
}: {
  label: string
  children: ReactElement
  side?: "top" | "right"
  delay?: number
}) {
  return (
    <TooltipProvider delay={delay}>
      <Tooltip>
        <TooltipTrigger render={children} />
        <TooltipContent
          side={side}
          sideOffset={8}
          className="duration-200 bg-popover text-popover-foreground [&>svg]:bg-popover [&>svg]:fill-popover"
        >
          {label}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

function SidebarNavLink({
  to,
  label,
  icon,
  collapsed,
  tooltipEnabled,
  onNavigate,
  className,
}: {
  to: string
  label: string
  icon: ReactElement
  collapsed: boolean
  tooltipEnabled: boolean
  onNavigate: () => void
  className: (active: boolean) => string
}) {
  const link = (
    <NavLink
      to={to}
      onClick={onNavigate}
      aria-label={collapsed ? label : undefined}
      className={({ isActive }) => className(isActive)}
    >
      {icon}
      {!collapsed && <span className="truncate">{label}</span>}
    </NavLink>
  )
  return tooltipEnabled ? <SidebarTooltip label={label}>{link}</SidebarTooltip> : link
}

function SidebarAction({
  label,
  icon,
  tooltipEnabled,
  collapsed,
  className,
  onClick,
  disabled,
}: {
  label: string
  icon: ReactElement
  tooltipEnabled: boolean
  collapsed: boolean
  className: string
  onClick: () => void
  disabled?: boolean
}) {
  const button = (
    <Button
      variant="ghost"
      className={className}
      onClick={onClick}
      aria-label={label}
      disabled={disabled}
    >
      {icon}
      <span className={cn("truncate", collapsed && "sr-only")}>{label}</span>
    </Button>
  )
  return tooltipEnabled ? <SidebarTooltip label={label}>{button}</SidebarTooltip> : button
}
