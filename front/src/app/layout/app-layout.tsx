import { NavLink, Outlet, useNavigate } from "react-router-dom"
import { LogOut, MoonStar, SunMedium } from "lucide-react"
import { useTheme } from "next-themes"

import { readInstitutionProfile } from "@/modules/institution/types/institution.types"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { useLogout } from "@/modules/auth/api/auth.queries"
import { useAuthStore } from "@/modules/auth/store/auth-store"

import { navItems } from "../nav-config"

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
  const navigate = useNavigate()
  const { theme, setTheme } = useTheme()
  const isLoggingOut = logout.isPending
  const institutionProfile = readInstitutionProfile()

  const handleLogout = () => {
    if (!isLoggingOut) {
      logout.mutate()
    }
  }

  const visibleItems = navItems.filter(
    (item) => !item.roles || (user && item.roles.includes(user.role))
  )

  return (
    <div className="grid min-h-svh grid-cols-[224px_1fr]">
      <aside className="flex flex-col border-r bg-muted/20">
        <div className="flex items-center gap-2 border-b px-4 py-4">
          {institutionProfile.logoImage ? (
            <img src={institutionProfile.logoImage} alt="Logo de la clínica" className="size-8 rounded-lg object-cover" />
          ) : (
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground">
              {institutionProfile.logoText || "CA"}
            </div>
          )}
          <span className="font-semibold">{institutionProfile.name}</span>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {visibleItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                  isActive && "bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary"
                )
              }
            >
              <item.icon className="size-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t p-3">
          <Button
            variant="ghost"
            className="w-full justify-start gap-2.5 text-muted-foreground hover:text-foreground"
            onClick={handleLogout}
            disabled={isLoggingOut}
          >
            <LogOut className="size-4" />
            {isLoggingOut ? "Saliendo..." : "Salir"}
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="flex items-center justify-end gap-3 border-b px-6 py-3">
          <button
            type="button"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="inline-flex size-9 items-center justify-center rounded-md border bg-background text-muted-foreground hover:text-foreground"
            aria-label="Cambiar tema"
          >
            {theme === "dark" ? <SunMedium className="size-4" /> : <MoonStar className="size-4" />}
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-muted">
              <Avatar className="size-8">
                {user?.profile?.avatarImage ? (
                  <img src={user.profile.avatarImage} alt="Avatar del usuario" className="size-full rounded-full object-cover" />
                ) : (
                  <AvatarFallback>{user ? getInitials(user.name) : "?"}</AvatarFallback>
                )}
              </Avatar>
              <div className="text-left">
                <p className="text-sm font-medium leading-none">{user?.name}</p>
                <p className="text-xs text-muted-foreground">
                  {user ? ROLE_LABELS[user.role] : ""}
                </p>
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="px-2 py-1.5 text-sm text-muted-foreground">{user?.email}</div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate("/perfil-usuario")}>Mi perfil</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleLogout}
                disabled={isLoggingOut}
                variant="destructive"
              >
                <LogOut />
                {isLoggingOut ? "Saliendo..." : "Cerrar sesion"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
