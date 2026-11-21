import { setAccessTheme } from "./helpers/access-theme"
import { logoutFromHeader, navigateUserMenu, openUserMenu } from "./helpers/app-navigation"
import { expect, test, type Page } from "@playwright/test"

test.use({ timezoneId: "America/Guayaquil" })
test.describe.configure({ mode: "parallel" })
const widths = [320, 360, 375, 390, 430, 600, 768, 1024, 1280, 1440, 1920]
const photo = (color: string) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"><rect width="128" height="128" fill="${color}"/><circle cx="64" cy="42" r="25" fill="white"/></svg>`)
const originalImage = `data:image/svg+xml;base64,${photo("#5350cc").toString("base64")}`
const replacement = photo("#007384")
const newImage = `data:image/svg+xml;base64,${replacement.toString("base64")}`
const avatar = (page: Page, where = "profile") => page.locator(`[data-user-avatar="${where}"]`)
const preview = (page: Page) => page.getByRole("dialog", { name: "Vista previa de fotografía", exact: true })
const deletion = (page: Page) => page.getByRole("alertdialog", { name: "Eliminar fotografía", exact: true })

async function login(page: Page, theme: "light" | "dark", role = "admin", setup = true) {
  await page.goto("/login")
  await setAccessTheme(page, theme === "light" ? "light" : "dark")
  await page.locator("#email").fill(`${role}@clinica.com`)
  await page.locator("#password").fill(`${role}123`)
  await page.getByRole("button", { name: "Ingresar", exact: true }).click()
  if (setup) await expect(page.getByRole("heading", { name: "Completa tu perfil", exact: true })).toBeVisible()
  else {
    await expect(page.locator(".clinic-app-header")).toBeVisible()
    await expect(page.getByRole("heading", { name: "Completa tu perfil", exact: true })).toHaveCount(0)
  }
}

async function state(page: Page) {
  return page.evaluate(() => {
    const raw = sessionStorage.getItem("clinicapp.mock-session")
    const current = raw ? JSON.parse(raw) : null
    return { profile: current?.user?.profile, canonical: localStorage.getItem(`clinicapp.mock-profile.${current?.user?.id}`), session: raw }
  })
}

async function existing(page: Page, theme: "light" | "dark", image: string | null = originalImage) {
  await page.goto("/login")
  // A previously persisted profile with a custom legacy color; no UI operation is mocked.
  await page.evaluate(({ image }) => {
    localStorage.setItem("clinicapp.mock-profile.usr_1", JSON.stringify({ fullName: "Ana Morales", avatarImage: image, avatarColor: "#7c3aed", title: "Directora", specialty: "Odontología", bio: "Biografía conservada" }))
  }, { image })
  await login(page, theme, "admin", false)
  await navigateUserMenu(page)
  await expect(page.getByRole("heading", { name: "Mi perfil", exact: true })).toBeVisible()
}

async function chooseImage(page: Page, buffer = replacement) {
  await page.locator('input[type="file"]').setInputFiles({ name: "avatar.svg", mimeType: "image/svg+xml", buffer })
  await expect(preview(page).getByRole("button", { name: "Confirmar fotografía", exact: true })).toBeEnabled()
}

async function openDelete(page: Page) {
  await page.getByRole("button", { name: "Opciones de fotografía", exact: true }).click()
  await page.getByRole("menuitem", { name: "Eliminar fotografía", exact: true }).click()
  await expect(deletion(page)).toBeVisible()
}

async function failProfileWrites(page: Page) {
  await page.evaluate(() => {
    const original = Storage.prototype.setItem
    Object.defineProperty(window, "restoreProfileWrites", { configurable: true, value: () => { Storage.prototype.setItem = original } })
    Storage.prototype.setItem = function (key, value) {
      if (key.startsWith("clinicapp.mock-profile.")) throw new DOMException("Storage quota exceeded", "QuotaExceededError")
      original.call(this, key, value)
    }
  })
}

async function restoreWrites(page: Page) {
  await page.evaluate(() => (window as unknown as { restoreProfileWrites: () => void }).restoreProfileWrites())
}

async function allImages(page: Page, expected: string | null) {
  const blocked = await preview(page).isVisible() || await deletion(page).isVisible()
  for (const where of ["profile", "header", "menu"]) {
    if (where === "menu") {
      if (blocked) continue // A modal correctly makes the header menu unavailable.
      await openUserMenu(page)
    }
    if (expected) await expect(avatar(page, where).locator("img")).toHaveAttribute("src", expected)
    else {
      await expect(avatar(page, where).locator("img")).toHaveCount(0)
      await expect(avatar(page, where)).toHaveAttribute("data-photo-state", "absent")
    }
  }
  if (!blocked) await page.keyboard.press("Escape")
}

for (const theme of ["light", "dark"] as const) {
  test(`CA-01–07 initials, honest empty names and contextual menu keyboard in ${theme}`, async ({ page }) => {
    await login(page, theme)
    for (const [name, expected] of [["Fernando Padilla", "FP"], ["Ana Morales", "AM"], ["María del Carmen González", "MG"], ["Fernando", "FE"], ["Ana", "AN"], ["Padilla", "PA"], ["A", "A"], ["   ", ""]]) {
      await page.getByLabel("Nombre completo", { exact: true }).fill(name)
      if (expected) await expect(avatar(page).locator("[data-profile-initials]")).toHaveText(expected)
      else { await expect(avatar(page).locator("[data-profile-initials]")).toHaveCount(0); await expect(avatar(page).getByRole("img", { name: "Usuario sin nombre", exact: true })).toBeVisible() }
    }
    const trigger = page.getByRole("button", { name: "Opciones de fotografía", exact: true })
    await trigger.focus(); await page.keyboard.press("Enter")
    await expect(page.getByRole("menuitem")).toHaveCount(1)
    await expect(page.getByRole("menuitem", { name: "Subir fotografía", exact: true })).toBeVisible()
    await page.keyboard.press("Escape"); await expect(page.getByRole("menu")).toHaveCount(0); await expect(trigger).toBeFocused()
    await trigger.locator("svg").last().click()
    const outside = await page.locator("h1").boundingBox()
    await page.mouse.click(outside!.x + 4, outside!.y + 4)
    await expect(page.getByRole("menu")).toHaveCount(0)
  })

  test(`CA-08–11 confirmed first photo is persisted without completing setup or saving text drafts in ${theme}`, async ({ page }) => {
    await login(page, theme)
    await page.getByLabel("Nombre completo", { exact: true }).fill("Fernando Padilla")
    const before = await state(page)
    await page.getByRole("button", { name: "Opciones de fotografía", exact: true }).click()
    const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.getByRole("menuitem", { name: "Subir fotografía", exact: true }).click()])
    await chooser.setFiles({ name: "avatar.svg", mimeType: "image/svg+xml", buffer: replacement })
    await expect(preview(page).getByRole("img", { name: "Vista previa de fotografía", exact: true })).toHaveAttribute("src", newImage)
    expect(await state(page)).toEqual(before)
    await expect(avatar(page).locator("img")).toHaveCount(0)
    await preview(page).getByRole("button", { name: "Confirmar fotografía", exact: true }).click()
    await expect(preview(page)).toHaveCount(0)
    const saved = await state(page)
    expect(saved.profile.avatarImage).toBe(newImage)
    expect(saved.profile.fullName).toBe("")
    expect(saved.profile.avatarColor).toBe("#1f2937")
    expect(JSON.parse(saved.canonical!).avatarImage).toBe(newImage)
    await expect(page.getByRole("heading", { name: "Completa tu perfil", exact: true })).toBeVisible()
    await expect(page.getByLabel("Nombre completo", { exact: true })).toHaveValue("Fernando Padilla")
    await page.getByRole("button", { name: "Continuar", exact: true }).click()
    await expect(avatar(page, "header").locator("img")).toHaveAttribute("src", newImage)
    await openUserMenu(page)
    await expect(avatar(page, "menu").locator("img")).toHaveAttribute("src", newImage)
    await page.keyboard.press("Escape")
  })

  test(`CA-10,14,15 native selection cancellation and preview cancellation preserve the previous photo in ${theme}`, async ({ page }) => {
    await existing(page, theme)
    const before = await state(page)
    const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.getByRole("button", { name: "Cambiar foto", exact: true }).click()])
    await chooser.setFiles([])
    expect(await state(page)).toEqual(before)
    await chooseImage(page)
    await allImages(page, originalImage)
    await preview(page).getByRole("button", { name: "Cancelar", exact: true }).click()
    await expect(preview(page)).toHaveCount(0)
    await expect(page.getByRole("button", { name: "Opciones de fotografía", exact: true })).toBeFocused()
    await allImages(page, originalImage)
    expect(await state(page)).toEqual(before)
  })

  test(`CA-11,18,20,26–29 photos, names and deletion stay synchronized through later saves, reload and login in ${theme}`, async ({ page }, testInfo) => {
    await existing(page, theme)
    await page.getByLabel("Nombre completo", { exact: true }).fill("María del Carmen González")
    await page.getByLabel("Cargo", { exact: true }).fill("  Directora clínica  ")
    await page.getByLabel("Especialidad", { exact: true }).fill("  Ortodoncia  ")
    const bio = `Primera línea\n${"Atención clínica integral. ".repeat(20)}`
    await page.getByLabel("Biografía breve", { exact: true }).fill(bio)
    await chooseImage(page)
    await allImages(page, originalImage)
    await preview(page).getByRole("button", { name: "Confirmar fotografía", exact: true }).click()
    await allImages(page, newImage)
    await page.screenshot({ path: testInfo.outputPath(`photo-saved-${theme}.png`), fullPage: true, animations: "disabled" })
    await page.locator(".clinic-app-header").getByRole("button", { name: "Cerrar menú", exact: true }).click()
    await openUserMenu(page)
    await expect(avatar(page, "menu").locator("img")).toHaveAttribute("src", newImage)
    await page.keyboard.press("Escape")
    await page.locator(".clinic-app-header").getByRole("button", { name: "Abrir menú", exact: true }).click()
    expect((await state(page)).profile.fullName).toBe("Ana Morales")
    expect((await state(page)).profile.avatarColor).toBe("#7c3aed")
    await expect(page.getByLabel("Nombre completo", { exact: true })).toHaveValue("María del Carmen González")
    await page.getByRole("button", { name: "Guardar cambios", exact: true }).click()
    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByRole("heading", { name: "Hola, María", exact: true })).toBeVisible()
    await navigateUserMenu(page)
    await allImages(page, newImage)
    await expect(page.locator(".clinic-app-header")).toContainText("María del Carmen González")
    await openDelete(page)
    await deletion(page).getByRole("button", { name: "Eliminar fotografía", exact: true }).click()
    await expect(deletion(page)).toHaveCount(0)
    await allImages(page, null)
    for (const where of ["profile", "header"]) await expect(avatar(page, where).locator("[data-profile-initials]")).toHaveText("MG")
    await page.setViewportSize({ width: 390, height: 1000 })
    await openUserMenu(page)
    await expect(avatar(page, "menu").locator("img")).toHaveCount(0)
    await expect(avatar(page, "menu").locator("[data-profile-initials]")).toHaveText("MG")
    await page.screenshot({ path: testInfo.outputPath(`deleted-mobile-user-menu-${theme}.png`), animations: "disabled" })
    await page.keyboard.press("Escape")
    await page.setViewportSize({ width: 1440, height: 1000 })
    expect((await state(page)).profile.avatarColor).toBe("#7c3aed")
    // A later metadata save must never resurrect an image from the old local draft.
    await page.getByLabel("Cargo", { exact: true }).fill("Directora general")
    await page.getByRole("button", { name: "Guardar cambios", exact: true }).click()
    await page.reload()
    await navigateUserMenu(page)
    await allImages(page, null)
    await logoutFromHeader(page)
    await expect(page).toHaveURL(/\/login$/)
    await login(page, theme, "admin", false)
    await navigateUserMenu(page)
    const recovered = (await state(page)).profile
    expect(recovered).toEqual({ fullName: "María del Carmen González", title: "Directora general", specialty: "Ortodoncia", bio: bio.trim(), avatarImage: null, avatarColor: "#7c3aed" })
    await allImages(page, null)
    await page.screenshot({ path: testInfo.outputPath(`synchronized-${theme}.png`), fullPage: true, animations: "disabled" })
  })

  test(`CA-12 read failure and storage failure never publish a candidate or announce success in ${theme}`, async ({ page }) => {
    await existing(page, theme)
    const before = await state(page)
    await page.locator('input[type="file"]').setInputFiles({ name: "broken.png", mimeType: "image/png", buffer: Buffer.from("not an image") })
    await expect(preview(page).getByRole("alert")).toContainText("No se pudo leer")
    await expect(preview(page).getByRole("button", { name: "Confirmar fotografía", exact: true })).toBeDisabled()
    expect(await state(page)).toEqual(before)
    await preview(page).getByRole("button", { name: "Cancelar", exact: true }).click()
    await chooseImage(page)
    await failProfileWrites(page)
    await preview(page).getByRole("button", { name: "Confirmar fotografía", exact: true }).click()
    await expect(preview(page).getByRole("alert")).toContainText("No se pudo guardar")
    await allImages(page, originalImage)
    expect(await state(page)).toEqual(before)
    await expect(page.locator('[data-sonner-toast]').filter({ hasText: "Fotografía guardada" })).toHaveCount(0)
    await restoreWrites(page)
    await preview(page).getByRole("button", { name: "Confirmar fotografía", exact: true }).click()
    await expect(preview(page)).toHaveCount(0)
    await allImages(page, newImage)
  })

  test(`CA-16–19 cancel and failed deletion keep the real stored image and color in ${theme}`, async ({ page }) => {
    await existing(page, theme)
    const before = await state(page)
    await openDelete(page)
    await expect(deletion(page)).toContainText("iniciales")
    await deletion(page).getByRole("button", { name: "Cancelar", exact: true }).click()
    expect(await state(page)).toEqual(before)
    await openDelete(page)
    await failProfileWrites(page)
    await deletion(page).getByRole("button", { name: "Eliminar fotografía", exact: true }).click()
    await expect(deletion(page).getByRole("alert")).toContainText("No se pudo guardar")
    await allImages(page, originalImage)
    expect(await state(page)).toEqual(before)
    await expect(page.locator('[data-sonner-toast]').filter({ hasText: "Fotografía eliminada" })).toHaveCount(0)
    await restoreWrites(page)
    await deletion(page).getByRole("button", { name: "Eliminar fotografía", exact: true }).click()
    await expect(deletion(page)).toHaveCount(0)
    await allImages(page, null)
    expect(JSON.parse((await state(page)).canonical!).avatarImage).toBeNull()
    expect((await state(page)).profile.avatarColor).toBe("#7c3aed")
  })

  test(`CA-20–25 unsaved text cancels cleanly and failed saves preserve the persisted profile in ${theme}`, async ({ page }) => {
    await existing(page, theme, null)
    const before = await state(page)
    await page.getByLabel("Nombre completo", { exact: true }).fill("Fernando Padilla")
    await page.getByLabel("Cargo", { exact: true }).fill("Texto libre sin catálogo")
    await page.getByLabel("Especialidad", { exact: true }).fill("Especialidad personalizada")
    await page.getByLabel("Biografía breve", { exact: true }).fill("Biografía de borrador\n" + "texto ".repeat(70))
    await page.getByRole("button", { name: "Cancelar", exact: true }).click()
    await expect(page.getByLabel("Nombre completo", { exact: true })).toHaveValue("Ana Morales")
    await expect(page.getByLabel("Biografía breve", { exact: true })).toHaveValue("Biografía conservada")
    expect(await state(page)).toEqual(before)
    await page.getByLabel("Nombre completo", { exact: true }).fill("Fernando Padilla")
    await failProfileWrites(page)
    await page.getByRole("button", { name: "Guardar cambios", exact: true }).click()
    await expect(page.getByRole("alert")).toContainText("No se pudo guardar")
    await expect(page).toHaveURL(/\/perfil-usuario$/)
    await expect(page.locator(".clinic-app-header")).toContainText("Ana Morales")
    expect(await state(page)).toEqual(before)
    await restoreWrites(page)
    await page.getByRole("button", { name: "Guardar cambios", exact: true }).click()
    await expect(page).toHaveURL(/\/$/)
    await expect(avatar(page, "header").locator("[data-profile-initials]")).toHaveText("FP")
    await openUserMenu(page)
    await expect(avatar(page, "menu").locator("[data-profile-initials]")).toHaveText("FP")
    await page.keyboard.press("Escape")
  })

  test(`CA-30–31 menus, preview, confirmation and global avatars fit all eleven widths in ${theme}`, async ({ page }, testInfo) => {
    test.setTimeout(180000)
    await existing(page, theme)
    const before = await state(page)
    const measurements = []
    async function fits(kind: string, width: number) {
      const popup = kind === "menu" ? page.getByRole("menu") : kind === "preview" ? preview(page) : deletion(page)
      const bounds = await popup.boundingBox()
      expect(bounds!.x).toBeGreaterThanOrEqual(-1)
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width + 1)
      expect(bounds!.y).toBeGreaterThanOrEqual(-1)
      expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(1001)
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
      measurements.push({ kind, width, bounds })
      if ([320, 768, 1440].includes(width)) await page.screenshot({ path: testInfo.outputPath(`${kind}-${theme}-${width}.png`), animations: "disabled" })
    }
    for (const width of widths) {
      await page.setViewportSize({ width, height: 1000 })
      await page.getByRole("button", { name: "Opciones de fotografía", exact: true }).click()
      await expect(page.getByRole("menuitem")).toHaveCount(2)
      await fits("menu", width)
      await page.keyboard.press("Escape")
      await chooseImage(page)
      await fits("preview", width)
      await preview(page).getByRole("button", { name: "Cancelar", exact: true }).click()
      await openDelete(page)
      await fits("delete", width)
      await deletion(page).getByRole("button", { name: "Cancelar", exact: true }).click()
      await openUserMenu(page)
      await expect(avatar(page, "menu").locator("img")).toHaveAttribute("src", originalImage)
      await page.keyboard.press("Escape")
    }
    expect(await state(page)).toEqual(before)
    await testInfo.attach("profile-popup-responsive", { body: JSON.stringify(measurements, null, 2), contentType: "application/json" })
  })
}

test("CA-29 per-user records survive a new login without leaking into another account", async ({ page }) => {
  await existing(page, "light")
  await logoutFromHeader(page)
  await expect(page).toHaveURL(/\/login$/)
  await login(page, "light", "medico")
  await expect(avatar(page).locator("img")).toHaveCount(0)
  await page.getByRole("button", { name: "Continuar", exact: true }).click()
  await logoutFromHeader(page)
  await expect(page).toHaveURL(/\/login$/)
  await login(page, "light", "admin", false)
  await expect(avatar(page, "header").locator("img")).toHaveAttribute("src", originalImage)
})

test("with the API the profile is saved in the account, the session survives a reload and nothing is stored in the browser", async ({ page }) => {
  // Solo `auth` usa la API (simulada aquí con rutas de Playwright); el resto de la app sigue en demostración.
  await page.route((url) => url.pathname === "/src/shared/lib/env.ts", (route) => route.fulfill({ contentType: "application/javascript",
    body: 'export const apiModules = []; export const env = { apiBaseUrl: "http://localhost:5000/api", useMockApi: true, usesApi: (module) => module === "auth" }' }))
  let profile: Record<string, unknown> = { fullName: "Ana Morales", title: "Directora", specialty: "", bio: "", avatarColor: "#7c3aed", avatarImage: null }
  let signedIn = false
  const saved: Array<Record<string, unknown>> = []
  const user = () => ({ id: "3f7d1c52-8a4e-4f0b-9d6a-0c1e2b3a4d5f", name: "Ana Morales", email: "admin@clinica.com", role: "admin", professionalId: null, profile })
  await page.route("http://localhost:5000/api/auth/**", async (route) => {
    const request = route.request()
    const headers = { "Access-Control-Allow-Origin": request.headers().origin ?? "*", "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Headers": "authorization,content-type", "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE" }
    const reply = (status: number, body?: unknown) => route.fulfill({ status, headers, contentType: "application/json", body: body === undefined ? "" : JSON.stringify(body) })
    const path = new URL(request.url()).pathname
    if (request.method() === "OPTIONS") return reply(204)
    if (path.endsWith("/auth/login")) { signedIn = true; return reply(200, { accessToken: "token-1", expiresIn: 900, user: user() }) }
    if (path.endsWith("/auth/refresh")) return signedIn ? reply(200, { accessToken: "token-2", expiresIn: 900, user: user() }) : reply(401, { status: 401, title: "Tu sesión expiró. Inicia sesión de nuevo" })
    if (path.endsWith("/auth/logout")) { signedIn = false; return reply(204) }
    if (path.endsWith("/auth/me/profile") && request.method() === "PUT") {
      expect(request.headers().authorization).toMatch(/^Bearer token-/)
      profile = request.postDataJSON(); saved.push(profile)
      return reply(200, user())
    }
    return reply(404)
  })

  await page.goto("/login")
  await page.locator("#email").fill("admin@clinica.com")
  await page.locator("#password").fill("una-contraseña")
  await page.getByRole("button", { name: "Ingresar", exact: true }).click()
  await expect(page.locator(".clinic-app-header")).toBeVisible()
  await navigateUserMenu(page)
  await expect(page.getByText("Los cambios confirmados se guardan en tu cuenta y se ven desde cualquier equipo.")).toBeVisible()

  // El SVG no es un formato que acepte la API: se envía recodificado.
  await chooseImage(page)
  await preview(page).getByRole("button", { name: "Confirmar fotografía", exact: true }).click()
  await expect(preview(page)).toHaveCount(0)
  expect(saved).toHaveLength(1)
  expect(String(saved[0].avatarImage)).toMatch(/^data:image\/(webp|jpeg);base64,/)
  expect(saved[0]).toMatchObject({ fullName: "Ana Morales", title: "Directora", avatarColor: "#7c3aed" })
  await expect(avatar(page).locator("img")).toHaveAttribute("src", String(saved[0].avatarImage))

  // Al recargar, la sesión vuelve con `POST /auth/refresh`; el token nunca estuvo en el navegador.
  await page.reload()
  await expect(page.getByRole("heading", { name: "Mi perfil", exact: true })).toBeVisible()
  await expect(avatar(page).locator("img")).toHaveAttribute("src", String(saved[0].avatarImage))
  const storage = await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))
  expect(storage).not.toContain("token-")
  expect(storage).not.toContain("clinicapp.mock-session")
  expect(storage).not.toContain("clinicapp.mock-profile")

  // Cerrar sesión borra la cookie del servidor: al recargar ya no hay sesión.
  await logoutFromHeader(page)
  await expect(page).toHaveURL(/\/login$/)
  await page.reload()
  await expect(page.getByRole("button", { name: "Ingresar", exact: true })).toBeVisible()
})
