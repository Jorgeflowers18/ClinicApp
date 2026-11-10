import { expect, test, type Page } from "@playwright/test"

async function login(page: Page, theme: "light" | "dark") {
  await page.goto("/login")
  await page.getByRole("button", { name: theme === "dark" ? "Tema oscuro" : "Tema claro", exact: true }).click()
  await page.locator("#email").fill("admin@clinica.com")
  await page.locator("#password").fill("admin123")
  await page.getByRole("button", { name: "Ingresar", exact: true }).click()
  await page.getByRole("button", { name: "Continuar", exact: true }).click()
  await expect(page).toHaveURL(/\/$/)
}

async function selectTab(page: Page, name: string) {
  const tab = page.getByRole("tab", { name, exact: true })
  if (await tab.isVisible()) {
    await tab.click()
  } else {
    await page.getByRole("button", { name: /^Más pestañas/ }).click()
    await page.getByRole("menuitemradio", { name, exact: true }).click()
  }
  await expect(page.getByRole("tab", { name, exact: true })).toHaveAttribute("aria-selected", "true")
}

for (const theme of ["light", "dark"] as const) {
  test(`sidebar, focus and stable theme geometry in ${theme}`, async ({ page }) => {
    await login(page, theme)
    await page.setViewportSize({ width: 390, height: 844 })
    const open = page.getByRole("button", { name: "Abrir menú", exact: true })
    await open.focus()
    await open.press("Enter")
    const menu = page.locator(".clinic-app-sidebar-panel")
    await expect(menu).toBeVisible()
    for (const item of ["Panel", "Pacientes", "Citas", "Historial clínico", "Tratamientos", "Inventario", "Notificaciones", "Finanzas", "Reportes", "Mi perfil", "Perfil institucional"]) {
      await expect(menu.getByRole("link", { name: item, exact: true })).toBeVisible()
    }
    async function checkMark(mark: ReturnType<Page["locator"]>) {
      await expect(mark).toHaveCSS("background-color", theme === "light" ? "rgb(83, 80, 204)" : "rgb(228, 242, 34)")
      await expect(mark).toHaveCSS("color", theme === "light" ? "rgb(255, 255, 255)" : "rgb(8, 9, 10)")
      await expect.poll(async () => {
        const rect = await mark.boundingBox()
        return Boolean(rect && rect.x >= 0 && rect.x + rect.width <= page.viewportSize()!.width)
      }).toBe(true)
      const rect = await mark.boundingBox()
      expect(rect!.width).toBeCloseTo(36, 2)
      expect(rect!.height).toBeCloseTo(36, 2)
      expect(rect!.x).toBeGreaterThanOrEqual(0)
      expect(rect!.x + rect!.width).toBeLessThanOrEqual(page.viewportSize()!.width)
    }
    for (const width of [320, 360, 375, 390, 430, 600, 768]) {
      await page.setViewportSize({ width, height: 1000 })
      await checkMark(menu.locator('[data-slot="brand-logo"]'))
    }
    await page.keyboard.press("Escape")
    await expect(menu).toBeHidden()
    await expect(open).toBeFocused()
    for (const width of [1024, 1280, 1440, 1920]) {
      await page.setViewportSize({ width, height: 1000 })
      await expect(page.locator(".clinic-app-sidebar")).toHaveCSS("width", "256px")
      await checkMark(page.locator('.clinic-app-sidebar [data-slot="brand-logo"]'))
      await page.getByRole("button", { name: "Cerrar menú", exact: true }).click()
      await expect(page.locator(".clinic-app-sidebar")).toHaveCSS("width", "72px")
      await checkMark(page.locator('.clinic-app-sidebar [data-slot="brand-logo"]'))
      await page.getByRole("button", { name: "Abrir menú", exact: true }).click()
      await expect(page.locator(".clinic-app-sidebar")).toHaveCSS("width", "256px")
    }
    const selectors = [".clinic-app-header", ".clinic-app-sidebar", ".clinic-app-canvas", '[data-slot="page-header"]', '.clinic-app-sidebar [data-slot="brand-logo"]']
    const bounds = async () => page.evaluate((values) => values.map((selector) => {
      const rect = document.querySelector(selector)!.getBoundingClientRect()
      return [rect.x, rect.y, rect.width, rect.height]
    }), selectors)
    const before = await bounds()
    await page.getByRole("button", { name: theme === "dark" ? "Modo oscuro" : "Modo claro", exact: true }).click()
    expect(await bounds()).toEqual(before)
    await expect(page.locator(".clinic-brand-mark")).toHaveCSS("background-color", theme === "dark" ? "rgb(83, 80, 204)" : "rgb(228, 242, 34)")
  })

  test(`calendar views, filters and date picker stay available in ${theme}`, async ({ page }) => {
    await login(page, theme)
    await page.setViewportSize({ width: 320, height: 900 })
    await page.goto("/citas")
    await expect(page.getByLabel("Vista", { exact: true })).toContainText("Semana")
    await page.getByLabel("Vista", { exact: true }).click()
    await page.getByRole("option", { name: "Mes", exact: true }).click()
    await expect(page.locator(".rbc-month-view")).toBeVisible()
    const month = await page.locator(".rbc-toolbar-label").innerText()
    await page.setViewportSize({ width: 1440, height: 1000 })
    await expect(page.locator(".rbc-month-view")).toBeVisible()
    await expect(page.locator(".rbc-toolbar-label")).toHaveText(month)
    await page.getByRole("button", { name: "Día", exact: true }).click()
    await page.setViewportSize({ width: 320, height: 900 })
    await expect(page.getByLabel("Vista", { exact: true })).toContainText("Día")
    await page.locator('button:has(.lucide-calendar-days)').click()
    const picker = page.locator('[data-slot="popover-content"]')
    await expect(picker).toBeVisible()
    const pickerBounds = await picker.boundingBox()
    expect(pickerBounds!.x).toBeGreaterThanOrEqual(0)
    expect(pickerBounds!.x + pickerBounds!.width).toBeLessThanOrEqual(320)
    await page.keyboard.press("Escape")
    await page.getByRole("button", { name: "Filtros", exact: true }).click()
    const filters = page.getByRole("dialog")
    await filters.getByLabel("Profesional", { exact: true }).click()
    await page.getByRole("option", { name: /Carla Ríos/ }).click()
    await filters.getByRole("button", { name: "Listo", exact: true }).click()
    await expect(page.getByRole("button", { name: "Filtros, 1 filtro activo", exact: true })).toBeVisible()
    await expect(page.getByRole("button", { name: "Nueva cita", exact: true })).toBeVisible()
    await expect(page.getByRole("button", { name: "Bloquear horario", exact: true })).toBeVisible()
  })

  test(`dialogs preserve entered values across sizes and a reduced keyboard viewport in ${theme}`, async ({ page }) => {
    await login(page, theme)
    await page.goto("/citas")
    const trigger = page.getByRole("button", { name: "Nueva cita", exact: true })
    await trigger.click()
    const dialog = page.getByRole("dialog")
    await dialog.getByLabel("Notas", { exact: true }).fill("Prueba visual sin enviar")
    for (const [width, height] of [[320, 720], [360, 800], [390, 360], [600, 900], [768, 1024], [1024, 768], [1440, 1000], [1920, 1080]]) {
      await page.setViewportSize({ width, height })
      const rect = await dialog.boundingBox()
      expect(rect!.x).toBeGreaterThanOrEqual(0)
      expect(rect!.y).toBeGreaterThanOrEqual(0)
      expect(rect!.x + rect!.width).toBeLessThanOrEqual(width)
      expect(rect!.y + rect!.height).toBeLessThanOrEqual(height + 1)
      await expect(dialog.getByLabel("Notas", { exact: true })).toHaveValue("Prueba visual sin enviar")
      await dialog.getByRole("button", { name: "Agendar cita", exact: true }).scrollIntoViewIfNeeded()
      await expect(dialog.getByRole("button", { name: "Agendar cita", exact: true })).toBeInViewport()
    }
    await page.keyboard.press("Tab")
    expect(await page.evaluate(() => Boolean(document.activeElement?.closest('[role="dialog"]')))).toBe(true)
    await page.keyboard.press("Escape")
    await expect(dialog).toBeHidden()
    await expect(trigger).toBeFocused()
  })

  test(`all overflow tabs, landscape and 200 percent CSS zoom remain usable in ${theme}`, async ({ page }) => {
    await login(page, theme)
    for (const [route, tabs] of [
      ["/inventario", ["Insumos", "Compras", "Proveedores", "Esterilización", "Stock crítico"]],
      ["/reportes", ["Agenda", "Productividad", "Tratamientos", "Inventario"]],
    ] as const) {
      await page.goto(route)
      for (const width of [320, 768, 1440]) {
        await page.setViewportSize({ width, height: 1000 })
        for (const tab of tabs) await selectTab(page, tab)
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
      }
    }
    await page.goto("/pacientes")
    await page.emulateMedia({ reducedMotion: "reduce" })
    await page.setViewportSize({ width: 844, height: 390 })
    await expect(page.getByRole("button", { name: "Nuevo paciente", exact: true })).toBeInViewport()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(844)
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.evaluate(() => { document.documentElement.style.zoom = "2" })
    await expect(page.getByRole("heading", { name: "Pacientes", exact: true })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1440)
    await expect(page.getByRole("textbox", { name: "Buscar pacientes", exact: true })).toBeVisible()
  })
}
