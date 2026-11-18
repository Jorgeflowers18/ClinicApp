import { expect, type Page } from "@playwright/test"

export async function openUserMenu(page: Page) {
  const trigger = page.getByRole("button", { name: /^Menú de usuario:/ })
  if (await trigger.getAttribute("aria-expanded") !== "true") await trigger.click()
  const menu = page.getByRole("menu", { name: /^Menú de usuario:/ })
  await expect(menu).toBeVisible()
  return menu
}

export async function navigateUserMenu(page: Page, name = "Mi perfil") {
  const menu = await openUserMenu(page)
  await menu.getByRole("menuitem", { name, exact: true }).click()
  await expect(menu).not.toBeVisible()
}

export async function logoutFromHeader(page: Page) {
  await navigateUserMenu(page, "Cerrar sesión")
}
