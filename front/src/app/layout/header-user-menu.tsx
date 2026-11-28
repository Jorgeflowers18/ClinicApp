import { Building2, ChevronDown, LogOut, Settings2, UserRound } from "lucide-react"
import { NavLink, useLocation } from "react-router-dom"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useLogout } from "@/modules/auth/api/auth.queries"
import { UserAvatar } from "@/modules/auth/components/user-avatar"
import { userDisplayName } from "@/modules/auth/components/user-identity"
import { useDemoContext,useSessionUser,useSaasData } from "@/modules/saas/state"
import { canViewNavigationItem } from "@/modules/saas/lib/navigation-visibility"
import { navItems } from "../nav-config"
import { roleLabels } from "@/modules/auth/types/user-admin.types"
import styles from "./header-user-menu.module.css"


export function HeaderUserMenu() {
  const user = useSessionUser()
  const data=useSaasData(),username=[...data.identities,...data.users].find(item=>item.id===user?.id)?.username
  const demo = useDemoContext(), member = data.users.find(item => item.id === demo.userId)
  const visibility = { user, member, data, organizationId: member ? demo.organizationId : "frontend-institution-current" }
  const administrationItems = navItems.filter(item => item.placement === "profile" && canViewNavigationItem(item, visibility))
  const institutionVisible = canViewNavigationItem({ to: "/perfil-institucion", roles: ["admin"] }, visibility)
  const name = userDisplayName(user) || "Usuario"
  const logout = useLogout()
  const { pathname } = useLocation()
  const [menu, setMenu] = useState({ open: false, path: pathname })
  const closeMenu = () => setMenu({ open: false, path: pathname })
  const role = user ? roleLabels[user.role] : ""
  const link = (to: string, label: string, icon: React.ReactNode) => <DropdownMenuItem render={<NavLink to={to} />} onClick={closeMenu}>
    {icon}{label}
  </DropdownMenuItem>

  return <DropdownMenu modal={false} open={menu.open && menu.path === pathname} onOpenChange={(open) => setMenu({ open, path: pathname })}>
    <DropdownMenuTrigger render={<Button variant="ghost" className={styles.trigger} aria-label={`Menú de usuario: ${name}`} title="Menú de usuario" />}>
      <UserAvatar name={name} image={user?.profile?.avatarImage ?? null} location="header" />
      <span className={styles.identity}><span>{name}</span><span className={styles.role}>{role}</span></span>
      <ChevronDown aria-hidden="true" className={styles.chevron} />
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" className={styles.menu} aria-label="Opciones de usuario">
      <div className={styles.summary}>
        <UserAvatar name={name} image={user?.profile?.avatarImage ?? null} location="menu" />
        <div><p>{name}</p><p className={styles.role}>{role}{username?` · ${username}`:""}</p></div>
      </div>
      <DropdownMenuSeparator />
      {link("/perfil-usuario", "Mi perfil", <UserRound />)}
      {institutionVisible && link("/perfil-institucion", "Perfil institucional", <Building2 />)}
      {administrationItems.length > 0 && link("/administracion", "Administración", <Settings2 />)}
      <DropdownMenuSeparator />
      <DropdownMenuItem disabled={logout.isPending} onClick={() => { if (!logout.isPending) logout.mutate() }}>
        <LogOut />{logout.isPending ? "Cerrando sesión…" : "Cerrar sesión"}
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
}
