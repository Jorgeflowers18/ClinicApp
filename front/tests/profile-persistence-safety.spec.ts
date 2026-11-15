import { logoutFromHeader, navigateUserMenu, openUserMenu } from "./helpers/app-navigation"
import { expect, test, type Page } from "@playwright/test"

const savedPhoto = `data:image/svg+xml;base64,${Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="purple"/></svg>').toString("base64")}`
const profile = { fullName: "Fernando Padilla", title: "Director", specialty: "Odontología", bio: "Perfil anterior", avatarImage: savedPhoto, avatarColor: "#7c3aed" }

async function enter(page: Page) {
  await page.goto("/login")
  await page.locator("#email").fill("admin@clinica.com")
  await page.locator("#password").fill("admin123")
  await page.getByRole("button", { name: "Ingresar", exact: true }).click()
}

test("a session-cache write failure cannot roll back a committed photo or lose it at the next login", async ({ page }) => {
  await page.goto("/login")
  await page.evaluate((value) => localStorage.setItem("clinicapp.mock-profile.usr_1", JSON.stringify(value)), profile)
  await enter(page)
  await expect(page).toHaveURL(/\/$/)
  await navigateUserMenu(page)
  const image = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><circle cx="40" cy="40" r="40" fill="teal"/></svg>')
  await page.locator('input[type="file"]').setInputFiles({ name: "next.svg", mimeType: "image/svg+xml", buffer: image })
  const preview = page.getByRole("dialog", { name: "Vista previa de fotografía", exact: true })
  await expect(preview.getByRole("button", { name: "Confirmar fotografía", exact: true })).toBeEnabled()
  await page.evaluate(() => {
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = function (key, value) { if (this === sessionStorage) throw new DOMException("Cache unavailable", "QuotaExceededError"); original.call(this, key, value) }
  })
  await preview.getByRole("button", { name: "Confirmar fotografía", exact: true }).click()
  await expect(preview).toHaveCount(0)
  const expected = `data:image/svg+xml;base64,${image.toString("base64")}`
  for (const where of ["profile", "header"]) await expect(page.locator(`[data-user-avatar="${where}"] img`)).toHaveAttribute("src", expected)
  await openUserMenu(page)
  await expect(page.locator('[data-user-avatar="menu"] img')).toHaveAttribute("src", expected)
  await page.keyboard.press("Escape")
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("clinicapp.mock-profile.usr_1")!))).toEqual({ ...profile, avatarImage: expected })
  await page.reload()
  await expect(page).toHaveURL(/\/login$/)
  await enter(page)
  await expect(page.locator(".clinic-app-header")).toBeVisible()
  await expect(page.locator('[data-user-avatar="header"] img')).toHaveAttribute("src", expected)
})

test("legacy session-only photos are preserved before logout and a failed migration never discards them", async ({ page }) => {
  await enter(page)
  await page.getByRole("button", { name: "Continuar", exact: true }).click()
  await expect(page).toHaveURL(/\/$/)
  await page.evaluate((value) => {
    const session = JSON.parse(sessionStorage.getItem("clinicapp.mock-session")!)
    localStorage.removeItem("clinicapp.mock-profile.usr_1")
    session.user.profile = value
    sessionStorage.setItem("clinicapp.mock-session", JSON.stringify(session))
  }, profile)
  await page.reload()
  await expect(page.locator('[data-user-avatar="header"] img')).toHaveAttribute("src", savedPhoto)
  await page.evaluate(() => {
    const original = Storage.prototype.setItem
    Object.defineProperty(window, "restoreProfileStorage", { configurable: true, value: () => { Storage.prototype.setItem = original } })
    Storage.prototype.setItem = function (key, value) { if (key.startsWith("clinicapp.mock-profile.")) throw new DOMException("Full", "QuotaExceededError"); original.call(this, key, value) }
  })
  await logoutFromHeader(page)
  await expect(page.locator('[data-sonner-toast]').filter({ hasText: "No se pudo guardar" })).toBeVisible()
  await expect(page).toHaveURL(/\/$/)
  expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem("clinicapp.mock-session")!).user.profile)).toEqual(profile)
  await page.evaluate(() => (window as unknown as { restoreProfileStorage: () => void }).restoreProfileStorage())
  await logoutFromHeader(page)
  await expect(page).toHaveURL(/\/login$/)
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("clinicapp.mock-profile.usr_1")!))).toEqual(profile)
  await enter(page)
  await expect(page.locator('[data-user-avatar="header"] img')).toHaveAttribute("src", savedPhoto)
})

test("an unreadable persisted profile blocks replacement instead of silently resetting stored photos", async ({ page }) => {
  await page.goto("/login")
  const unreadable = '{"avatarImage":"existing-photo","fullName":'
  await page.evaluate((raw) => localStorage.setItem("clinicapp.mock-profile.usr_1", raw), unreadable)
  await enter(page)
  await expect(page.getByRole("alert")).toContainText("No se pudo leer el perfil guardado")
  await expect(page).toHaveURL(/\/login$/)
  expect(await page.evaluate(() => localStorage.getItem("clinicapp.mock-profile.usr_1"))).toBe(unreadable)
})
