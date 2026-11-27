import { navItems } from "@/app/nav-config"
import { useDemoContext } from "../state"
import { readDemoData } from "../adapters/demo-repository"
import { demoCan, permissionModuleForPath } from "./permissions"
export function demoLandingPath() {
  const context = useDemoContext.getState(), data = readDemoData(), user = data.users.find(item => item.id === context.userId)
  if (!user) return "/login?demo=1"
  if (demoCan(user, data, "Personal y accesos", "view", context.organizationId)) return "/accesos"
  return navItems.find(item => demoCan(user, data, permissionModuleForPath(item.to) ?? "", "view", context.organizationId))?.to ?? "/403"
}
