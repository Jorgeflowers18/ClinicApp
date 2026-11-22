import { setAccessTheme } from "./helpers/access-theme"
import { expect, test, type Page } from "@playwright/test"
import { logoutFromHeader, navigateUserMenu, openUserMenu } from "./helpers/app-navigation"

const widths = [320, 360, 375, 390, 430, 600, 768, 1024, 1280, 1440, 1920]
const allLinks = ["Panel", "Pacientes", "Citas", "Historial clínico", "Tratamientos", "Inventario", "Finanzas", "Reportes", "Mensajería"]
test.use({ timezoneId: "America/Guayaquil" })

async function login(page: Page, theme: "light" | "dark", role = "admin") {
  await page.goto("/login")
  await setAccessTheme(page, theme === "light" ? "light" : "dark")
  await page.locator("#email").fill(`${role}@clinica.com`)
  await page.locator("#password").fill(`${role}123`)
  await page.getByRole("button", { name: "Ingresar", exact: true }).click()
  await page.getByRole("button", { name: "Continuar", exact: true }).click()
  await expect(page.locator(".clinic-app-header")).toBeVisible()
}
const bell = (page: Page) => page.getByRole("button", { name: /^Notificaciones:/ })
const panel = (page: Page) => page.getByRole("dialog", { name: "Notificaciones", exact: true })

async function seedAlertSources(page: Page, expectedUnread = 6) {
  await expect(bell(page)).toHaveAttribute("aria-label", /\d+ sin leer/)
  await page.evaluate(async () => {
    const load = async (path: string) => {
      const resource = performance.getEntriesByType("resource").findLast((entry) => new URL(entry.name).pathname === path)
      return import(/* @vite-ignore */ resource?.name ?? path)
    }
    const [{ mockPatients }, { mockInventoryItems }, { mockAppointments }, { mockNotifications }] = await Promise.all([
      load("/src/modules/patients/api/patients.mock-data.ts"), load("/src/modules/inventory/api/inventory.mock-data.ts"),
      load("/src/modules/appointments/api/appointments.mock-data.ts"), load("/src/modules/notifications/api/notifications.mock-data.ts"),
    ])
    const now = new Date(), day = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
    const patient = { ...mockPatients[0], id: "fixture-patient", firstName: "Paciente", lastName: "Real", birthDate: `1990-${day.slice(5)}` }
    mockPatients.splice(0, mockPatients.length, patient)
    const item = { ...mockInventoryItems[0], id: "fixture-item", name: "Guantes de prueba", stock: 0, minStock: 10 }
    mockInventoryItems.splice(0, mockInventoryItems.length, item, { ...item, id: "fixture-low", name: "Resina de prueba", stock: 2 })
    const appointment = { ...mockAppointments[0], id: "fixture-appointment", patientId: patient.id, start: `${day}T09:00:00-05:00`, end: `${day}T09:30:00-05:00`, status: "programada" }
    mockAppointments.splice(0, mockAppointments.length, appointment, { ...appointment, id: "fixture-confirmed", status: "confirmada" }, { ...appointment, id: "fixture-canceled", status: "cancelada" }, { ...appointment, id: "fixture-completed", status: "completada" })
    const log = { ...mockNotifications[0], id: "fixture-log", patientId: patient.id, status: "fallida", sentAt: `${day}T08:00:00-05:00` }
    mockNotifications.splice(0, mockNotifications.length, log, { ...log, id: "fixture-sent", status: "enviada" })
  })
  await bell(page).click()
  await panel(page).getByRole("button", { name: "Actualizar notificaciones", exact: true }).click()
  await expect(bell(page)).toHaveAttribute("aria-label", `Notificaciones: ${expectedUnread} sin leer${expectedUnread ? ", hay notificaciones importantes" : ""}`)
}

for (const theme of ["light", "dark"] as const) {
  test(`navigation groups, header controls and overlays fit eleven widths in ${theme}`, async ({ page }, testInfo) => {
    await login(page, theme)
    const measurements = []
    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 })
      const header = page.locator(".clinic-app-header"), sidebar = page.locator(".clinic-app-sidebar")
      await expect(header).toHaveCSS("height", "64px")
      await expect(page.getByRole("switch", { name: "Modo oscuro", exact: true })).toHaveCount(1)
      await expect(header.getByRole("switch")).toHaveAttribute("aria-checked", String(theme === "dark"))
      const themeControl = header.getByRole("switch")
      await expect.poll(async () => {
        const control = (await themeControl.boundingBox())!
        const thumb = (await themeControl.locator('[data-slot="switch-thumb"]').boundingBox())!
        return Math.round(thumb.x - control.x)
      }).toBe(theme === "dark" ? 34 : 6)
      await expect(bell(page)).toHaveCount(1)
      if (width < 768) {
        await expect(sidebar).toBeHidden()
        await header.getByRole("button", { name: "Abrir menú", exact: true }).click()
        const drawer = page.locator(".clinic-app-sidebar-panel")
        await expect(drawer).toBeVisible()
        await expect(drawer.getByRole("navigation").getByRole("link")).toHaveText(allLinks)
        await expect(drawer.getByRole("switch")).toHaveCount(0)
        await expect(drawer.getByRole("link", { name: /Mi perfil|Perfil institucional/ })).toHaveCount(0)
        await expect(drawer.getByRole("button", { name: /Salir|Cerrar sesión/ })).toHaveCount(0)
        await drawer.getByRole("link", { name: "Citas", exact: true }).click()
        await expect(drawer).not.toBeVisible()
        await expect(page).toHaveURL(/\/citas$/)
      } else {
        await expect(sidebar).toBeVisible()
        await expect(sidebar).toHaveCSS("width", width < 1024 ? "72px" : "268px")
        await expect(sidebar.getByRole("navigation").getByRole("link")).toHaveCount(9)
        await expect(sidebar.getByRole("region")).toHaveCount(4)
        await expect(sidebar.getByRole("switch")).toHaveCount(0)
        await expect(sidebar.getByRole("link", { name: /Mi perfil|Perfil institucional/ })).toHaveCount(0)
        if (width >= 1024) {
          await header.getByRole("button", { name: "Cerrar menú", exact: true }).click()
          await expect(sidebar).toHaveCSS("width", "72px")
          await sidebar.getByRole("link", { name: "Pacientes", exact: true }).hover()
          await expect(page.locator('[data-slot="tooltip-content"]').filter({ hasText: "Pacientes" })).toBeVisible()
          await header.getByRole("button", { name: "Abrir menú", exact: true }).click()
          await expect(sidebar).toHaveCSS("width", "268px")
        }
      }
      await bell(page).click()
      await expect(panel(page)).toBeVisible()
      const alertBox = (await panel(page).boundingBox())!
      expect(alertBox.x).toBeGreaterThanOrEqual(0)
      expect(alertBox.x + alertBox.width).toBeLessThanOrEqual(width)
      expect(alertBox.y + alertBox.height).toBeLessThanOrEqual(900)
      await page.keyboard.press("Escape")
      await expect(bell(page)).toBeFocused()
      const menu = await openUserMenu(page)
      await expect(menu.getByRole("menuitem")).toHaveText(["Mi perfil", "Perfil institucional", "Cerrar sesión"])
      const menuBox = (await menu.boundingBox())!
      expect(menuBox.x).toBeGreaterThanOrEqual(0)
      expect(menuBox.x + menuBox.width).toBeLessThanOrEqual(width)
      await page.keyboard.press("Escape")
      await expect(header.getByRole("button", { name: /^Menú de usuario:/ })).toBeFocused()
      const geometry = await page.evaluate(() => ({ viewport: innerWidth, scroll: document.documentElement.scrollWidth, bodyScroll: document.body.scrollWidth }))
      expect(geometry.scroll).toBeLessThanOrEqual(width)
      expect(geometry.bodyScroll).toBeLessThanOrEqual(width)
      measurements.push({ width, ...geometry, panelWidth: alertBox.width })
      if ([320, 768, 1440].includes(width)) await page.screenshot({ path: testInfo.outputPath(`shell-${theme}-${width}.png`), animations: "disabled" })
    }
    await testInfo.attach("responsive.json", { body: JSON.stringify(measurements, null, 2), contentType: "application/json" })
  })

  test(`header theme uses the existing persisted theme and tracks other tabs in ${theme}`, async ({ page, context }) => {
    await login(page, theme)
    const control = page.getByRole("switch", { name: "Modo oscuro", exact: true })
    await control.focus()
    await page.keyboard.press("Space")
    await expect(control).toHaveAttribute("aria-checked", String(theme === "light"))
    await expect.poll(() => page.evaluate(() => localStorage.getItem("theme"))).toBe(theme === "light" ? "dark" : "light")
    await page.reload()
    await expect(control).toHaveAttribute("aria-checked", String(theme === "light"))
    const other = await context.newPage()
    await other.goto("/login")
    await setAccessTheme(other, theme === "light" ? "light" : "dark")
    await expect(control).toHaveAttribute("aria-checked", String(theme === "dark"))
    await expect.poll(() => page.locator("html").evaluate((node) => node.classList.contains("dark"))).toBe(theme === "dark")
    await other.close()
  })

  test(`user menu supports keyboard, route selection, outside clicks and logout in ${theme}`, async ({ page }) => {
    await login(page, theme)
    const toast = page.locator('[data-sonner-toast]').first()
    await expect(toast).toBeVisible()
    await expect.poll(async () => (await toast.boundingBox())!.y).toBeGreaterThanOrEqual(64)
    const trigger = page.getByRole("button", { name: /^Menú de usuario:/ })
    await trigger.focus()
    await page.keyboard.press("Enter")
    const menu = page.getByRole("menu", { name: /^Menú de usuario:/ })
    await expect(menu).toContainText("Ana Morales")
    await expect(menu).toContainText("Administrador")
    await page.keyboard.press("Escape")
    await expect(trigger).toBeFocused()
    await openUserMenu(page)
    await page.locator("main h1").click()
    await expect(menu).not.toBeVisible()
    await navigateUserMenu(page)
    await expect(page).toHaveURL(/\/perfil-usuario$/)
    const active = await openUserMenu(page)
    await expect(active.getByRole("menuitem", { name: "Mi perfil", exact: true })).toHaveAttribute("aria-current", "page")
    await active.getByRole("menuitem", { name: "Perfil institucional", exact: true }).click()
    await expect(page).toHaveURL(/\/perfil-institucion$/)
    await logoutFromHeader(page)
    await expect(page).toHaveURL(/\/login$/)
  })

  test(`global alerts derive real source states, filter and persist local read receipts in ${theme}`, async ({ page }) => {
    await login(page, theme)
    await seedAlertSources(page)
    const center = panel(page)
    await expect(center.locator("[data-alert-kind]")).toHaveCount(6)
    await expect(center.locator('[data-alert-kind="inventory"]')).toHaveCount(2)
    await expect(center.locator('[data-alert-kind="appointment"]')).toHaveCount(2)
    await expect(center.locator('[data-alert-kind="birthday"]')).toHaveCount(1)
    await expect(center.locator('[data-alert-kind="delivery"]')).toHaveCount(1)
    await center.getByRole("button", { name: "Importantes", exact: true }).click()
    await expect(center.locator("[data-alert-kind]")).toHaveCount(3)
    await center.getByLabel("Tipo de notificación", { exact: true }).click(); await page.getByRole("option", { name: "Inventario", exact: true }).click()
    await expect(center.locator("[data-alert-kind]")).toHaveCount(2)
    await center.getByLabel("Tipo de notificación", { exact: true }).click(); await page.getByRole("option", { name: "Todos los tipos", exact: true }).click()
    await center.getByRole("button", { name: "No leídas", exact: true }).click()
    await center.getByRole("button", { name: /^Marcar como leída:/ }).first().click()
    await expect(bell(page)).toHaveAttribute("aria-label", /5 sin leer/)
    await center.getByRole("button", { name: "Marcar todas como leídas", exact: true }).click()
    await expect(bell(page)).toHaveAttribute("aria-label", "Notificaciones: 0 sin leer")
    await expect(center.getByText("No tienes notificaciones sin leer", { exact: true })).toBeVisible()
    await center.getByRole("button", { name: "Todas", exact: true }).click()
    await expect(center.locator('[data-alert-read="true"]')).toHaveCount(6)
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("clinicapp.global-alert-reads.usr_1")!).length)).toBe(6)
    await page.reload()
    await seedAlertSources(page, 0)
    await expect(bell(page)).toHaveAttribute("aria-label", "Notificaciones: 0 sin leer")
    await panel(page).getByRole("link", { name: "Ir a Mensajería", exact: true }).click()
    await expect(page).toHaveURL(/\/notificaciones$/)
    await page.getByRole("tab", { name: "Plantillas de mensajes", exact: true }).click(); await expect(page.getByRole("button", { name: /Guardar plantilla/ })).toBeVisible()
  })

  test(`read-write failures keep the real unread count and allow retry in ${theme}`, async ({ page }) => {
    await login(page, theme)
    await seedAlertSources(page)
    await page.evaluate(() => {
      const original = Storage.prototype.setItem
      Object.assign(window, { restoreReads: () => { Storage.prototype.setItem = original } })
      Storage.prototype.setItem = function (key, value) { if (key.startsWith("clinicapp.global-alert-reads.")) throw new DOMException("Full", "QuotaExceededError"); original.call(this, key, value) }
    })
    await panel(page).getByRole("button", { name: "Marcar todas como leídas", exact: true }).click()
    await expect(panel(page).getByRole("alert")).toContainText("Las alertas siguen sin leer")
    await expect(bell(page)).toHaveAttribute("aria-label", /6 sin leer/)
    await expect(panel(page).locator('[data-alert-read="false"]')).toHaveCount(6)
    expect(await page.evaluate(() => localStorage.getItem("clinicapp.global-alert-reads.usr_1"))).toBeNull()
    await page.evaluate(() => (window as unknown as { restoreReads: () => void }).restoreReads())
    await panel(page).getByRole("button", { name: "Marcar todas como leídas", exact: true }).click()
    await expect(bell(page)).toHaveAttribute("aria-label", "Notificaciones: 0 sin leer")
  })

  test(`unavailable alert sources never report a false zero and recover in ${theme}`, async ({ page }) => {
    await login(page, theme)
    await expect(bell(page)).toHaveAttribute("aria-label", /\d+ sin leer/)
    await page.evaluate(async () => {
      const resource = performance.getEntriesByType("resource").findLast((entry) => new URL(entry.name).pathname === "/src/modules/inventory/api/inventory.api.ts")
      // El búfer de Resource Timing guarda 250 entradas: si el módulo no aparece, se importa por su ruta.
      const { inventoryApi } = await import(/* @vite-ignore */ resource?.name ?? "/src/modules/inventory/api/inventory.api.ts")
      const original = inventoryApi.list
      Object.assign(window, { restoreAlertSource: () => { inventoryApi.list = original } })
      inventoryApi.list = async () => { throw new Error("Source unavailable") }
    })
    await bell(page).click()
    await panel(page).getByRole("button", { name: "Actualizar notificaciones", exact: true }).click()
    await expect(bell(page)).toHaveAttribute("aria-label", "Notificaciones: consulta incompleta")
    await expect(panel(page).getByRole("alert")).toContainText("No se pudieron consultar todas las notificaciones")
    await expect(panel(page).getByRole("button", { name: "Marcar todas como leídas", exact: true })).toBeDisabled()
    await page.evaluate(() => (window as unknown as { restoreAlertSource: () => void }).restoreAlertSource())
    await panel(page).getByRole("button", { name: "Actualizar notificaciones", exact: true }).click()
    await expect(bell(page)).toHaveAttribute("aria-label", /\d+ sin leer/)
    await expect(panel(page).getByRole("alert")).toHaveCount(0)
  })

  test(`corrupt local read state is explicit and read receipts stay separate per user in ${theme}`, async ({ page }) => {
    await page.goto("/login")
    await page.evaluate(() => localStorage.setItem("clinicapp.global-alert-reads.usr_1", "{broken"))
    await login(page, theme)
    await expect(bell(page)).toHaveAttribute("aria-label", "Notificaciones: consulta incompleta")
    await bell(page).click()
    await expect(panel(page).getByRole("alert")).toContainText("No se pudo recuperar el estado de lectura")
    await page.evaluate(() => localStorage.setItem("clinicapp.global-alert-reads.usr_1", "[]"))
    await panel(page).getByRole("button", { name: "Reintentar lectura", exact: true }).click()
    await expect(bell(page)).toHaveAttribute("aria-label", /[1-9]\d* sin leer/)
    await panel(page).getByRole("button", { name: "Marcar todas como leídas", exact: true }).click()
    await expect(bell(page)).toHaveAttribute("aria-label", "Notificaciones: 0 sin leer")
    await page.keyboard.press("Escape")
    await logoutFromHeader(page)
    await expect(page).toHaveURL(/\/login$/)
    await login(page, theme, "recepcion")
    await expect(bell(page)).toHaveAttribute("aria-label", /[1-9]\d* sin leer/)
    expect(await page.evaluate(() => localStorage.getItem("clinicapp.global-alert-reads.usr_3"))).toBeNull()
  })
}

for (const role of ["admin", "recepcion", "medico"]) {
  test(`${role} retains navigation, personal and notification permissions`, async ({ page }) => {
    await login(page, "light", role)
    const names = role === "admin" ? allLinks : role === "recepcion" ? allLinks.filter((name) => !["Historial clínico", "Reportes"].includes(name)) : allLinks.slice(0, 5)
    await expect(page.locator(".clinic-app-sidebar").getByRole("link")).toHaveText(names)
    const menu = await openUserMenu(page)
    await expect(menu.getByRole("menuitem", { name: "Perfil institucional", exact: true })).toHaveCount(role === "admin" ? 1 : 0)
    await page.keyboard.press("Escape")
    await expect(bell(page)).toHaveAttribute("aria-label", /\d+ sin leer/)
    await bell(page).click()
    await expect(panel(page).getByRole("link", { name: "Ir a Mensajería", exact: true })).toHaveCount(role === "medico" ? 0 : 1)
    if (role === "medico") {
      await panel(page).getByLabel("Tipo de notificación").click(); await expect(page.getByRole("option", {name:"Inventario",exact:true})).toHaveCount(0)
      await expect(page.getByRole("option", {name:"Mensajería",exact:true})).toHaveCount(0); await page.keyboard.press("Escape")
    }
    await page.goto("/perfil-institucion")
    await expect(page).toHaveURL(role === "admin" ? /\/perfil-institucion$/ : /\/403$/)
  })
}

test("alert aggregation covers all pages, excludes irrelevant events and respects cancellation", async ({ page }) => {
  await page.goto("/login")
  const result = await page.evaluate(async () => {
    const module = await import(/* @vite-ignore */ "/src/shared/lib/pagination.ts")
    const calls: number[] = []
    const rows = await module.fetchAllPages(async (query: { page: number }) => {
      calls.push(query.page)
      return { items: [{ id: `row-${query.page}` }, { id: "shared" }], page: query.page, pageSize: 100, totalItems: 103, totalPages: 3 }
    }, new AbortController().signal)
    const controller = new AbortController(); controller.abort()
    let aborted = false
    try { await module.fetchAllPages(() => { throw new Error("Should not fetch") }, controller.signal) } catch (error) { aborted = (error as Error).name === "AbortError" }
    return { calls, ids: rows.map((row: { id: string }) => row.id), aborted }
  })
  expect(result).toEqual({ calls: [1, 2, 3], ids: ["row-1", "shared", "row-2", "row-3"], aborted: true })
})
