import { expect, test, type Page } from "@playwright/test"

test.use({ timezoneId: "America/Guayaquil" })
test.describe.configure({ mode: "parallel" })
const triggerOf = (page: Page) => page.getByRole("button", { name: /^Elegir fecha:/ })
const popupOf = (page: Page) => page.locator('[data-slot="popover-content"]')

async function login(page: Page, theme: "light" | "dark", route = "/citas") {
  await page.clock.install({ time: new Date("2026-11-11T17:00:00Z") })
  await page.goto("/login")
  await page.getByRole("button", { name: theme === "light" ? "Tema claro" : "Tema oscuro", exact: true }).click()
  await page.locator("#email").fill("admin@clinica.com")
  await page.locator("#password").fill("admin123")
  await page.getByRole("button", { name: "Ingresar", exact: true }).click()
  await page.getByRole("button", { name: "Continuar", exact: true }).click()
  await expect(page).toHaveURL(/\/$/)
  await page.goto(route)
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible()
  await expect(page.locator('[data-slot="skeleton"]')).toHaveCount(0)
}

for (const theme of ["light", "dark"] as const) {
  test(`cross-year week labels stay accurate in the grid and compact agenda in ${theme}`, async ({ page }) => {
    await login(page, theme)
    await triggerOf(page).click()
    await browse(page, "2026", "diciembre")
    await popupOf(page).getByRole("button", { name: "Mes siguiente", exact: true }).click()
    await expect(popupOf(page).getByLabel("Mes", { exact: true })).toContainText("enero")
    await expect(popupOf(page).getByLabel("Año", { exact: true })).toHaveValue("2027")
    await popupOf(page).getByRole("button", { name: "Mes anterior", exact: true }).click()
    await expect(popupOf(page).getByLabel("Año", { exact: true })).toHaveValue("2026")
    await popupOf(page).locator('button[data-day="31/12/2026"]').click()
    await expect(triggerOf(page)).toContainText("2026–2027")
    await triggerOf(page).click()
    await expect(popupOf(page).locator('button[data-day="31/12/2026"]')).toHaveAttribute("data-selected-single", "true")
    await page.keyboard.press("Escape")
    await page.setViewportSize({ width: 390, height: 844 })
    await expect(triggerOf(page)).toContainText("2026")
    await expect(triggerOf(page)).toContainText("2027")
    await expect(page.getByLabel("Vista", { exact: true })).toContainText("Semana")
  })
}

async function browse(page: Page, year: string, month: string) {
  await popupOf(page).getByLabel("Año", { exact: true }).fill(year)
  await popupOf(page).getByLabel("Mes", { exact: true }).click()
  await expect(page.getByRole("option")).toHaveCount(12)
  await page.getByRole("option", { name: month, exact: true }).click()
}

for (const theme of ["light", "dark"] as const) {
  for (const view of ["Mes", "Semana", "Día"]) {
    test(`direct date jump preserves ${view}, events and temporal navigation in ${theme}`, async ({ page }) => {
      await login(page, theme)
      const toolbar = page.locator(".rbc-toolbar")
      await toolbar.getByRole("button", { name: view, exact: true }).click()
      await expect(page.locator(".rbc-event").filter({ hasText: "María González" }).first()).toBeVisible()
      const originalLabel = await toolbar.locator(".rbc-toolbar-label").innerText()
      const eventTitles = () => page.locator(".rbc-event").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("title")).sort())
      const originalEvents = await eventTitles()
      await triggerOf(page).click()
      await expect(popupOf(page).getByText("Ir a una fecha", { exact: true })).toBeVisible()
      const selected = popupOf(page).locator('button[data-selected-single="true"]')
      await expect(selected).toHaveCSS("background-color", theme === "dark" ? "rgb(228, 242, 34)" : "rgb(83, 80, 204)")
      await browse(page, "2027", "marzo")
      // Browsing month/year is a draft; the underlying calendar has not moved yet.
      await expect(toolbar.locator(".rbc-toolbar-label")).toHaveText(originalLabel)
      await popupOf(page).locator('button[data-day="15/3/2027"]').click()
      await expect(popupOf(page)).toHaveCount(0)
      await expect(triggerOf(page)).toBeFocused()
      await expect(toolbar.getByRole("button", { name: view, exact: true })).toHaveAttribute("aria-pressed", "true")
      await expect(toolbar.locator(".rbc-toolbar-label")).toContainText(view === "Día" ? "mar" : "marzo")
      await expect(toolbar.locator(".rbc-toolbar-label")).toContainText("2027")
      await triggerOf(page).click()
      await expect(popupOf(page).locator('button[data-day="15/3/2027"]')).toHaveAttribute("data-selected-single", "true")
      await page.keyboard.press("Escape")
      if (view === "Día") {
        const slot = page.locator(".rbc-day-slot .rbc-time-slot").nth(18)
        await slot.scrollIntoViewIfNeeded()
        const box = await slot.boundingBox()
        await page.mouse.click(box!.x + box!.width / 2, box!.y + 2)
        const form = page.getByRole("dialog", { name: "Nueva cita", exact: true })
        await expect(form.getByLabel("Fecha", { exact: true })).toHaveValue("2027-03-15")
        await expect(form.getByLabel("Inicio", { exact: true })).toHaveValue("09:00")
        await form.getByRole("button", { name: "Cancelar", exact: true }).click()
      }
      const targetLabel = await toolbar.locator(".rbc-toolbar-label").innerText()
      await toolbar.getByRole("button", { name: "Sig.", exact: true }).click()
      await expect(toolbar.locator(".rbc-toolbar-label")).not.toHaveText(targetLabel)
      await toolbar.getByRole("button", { name: "Ant.", exact: true }).click()
      await expect(toolbar.locator(".rbc-toolbar-label")).toHaveText(targetLabel)
      await toolbar.getByRole("button", { name: "Hoy", exact: true }).click()
      await expect(toolbar.locator(".rbc-toolbar-label")).toHaveText(originalLabel)
      await expect.poll(eventTitles).toEqual(originalEvents)
    })
  }

  test(`date navigation supports distant years, leap days, invalid drafts and keyboard in ${theme}`, async ({ page }) => {
    await login(page, theme)
    await page.locator(".rbc-toolbar").getByRole("button", { name: "Día", exact: true }).click()
    const label = await triggerOf(page).innerText()
    await triggerOf(page).focus()
    await page.keyboard.press("Enter")
    await popupOf(page).getByLabel("Año", { exact: true }).fill("")
    await expect(popupOf(page).getByRole("alert")).toContainText("año válido")
    await expect(triggerOf(page)).toHaveText(label)
    await browse(page, "2400", "febrero")
    const day = popupOf(page).locator('button[data-day="29/2/2400"]')
    await day.focus()
    await page.keyboard.press("Enter")
    await expect(popupOf(page)).toHaveCount(0)
    await expect(triggerOf(page)).toBeFocused()
    await expect(triggerOf(page)).toContainText("2400")
    await expect(triggerOf(page)).toContainText("29")
    await expect(page.locator(".rbc-toolbar").getByRole("button", { name: "Día", exact: true })).toHaveAttribute("aria-pressed", "true")
    await triggerOf(page).click()
    await expect(popupOf(page).locator('button[data-day="29/2/2400"]')).toHaveAttribute("data-selected-single", "true")
    await page.keyboard.press("Escape")
  })

  test(`date picker fits every width, both calendar presentations and landscape in ${theme}`, async ({ page }, testInfo) => {
    await login(page, theme)
    const measurements = []
    for (const width of [320, 360, 375, 390, 430, 600, 768, 1024, 1280, 1440, 1920]) {
      await page.setViewportSize({ width, height: 1000 })
      for (const view of ["month", "week", "day"]) {
        const compactView = page.getByLabel("Vista", { exact: true })
        if (await compactView.isVisible()) {
          await compactView.click()
          await page.getByRole("option", { name: { month: "Mes", week: "Semana", day: "Día" }[view], exact: true }).click()
        } else {
          await page.locator(".rbc-toolbar").getByRole("button", { name: { month: "Mes", week: "Semana", day: "Día" }[view], exact: true }).click()
        }
        await expect(triggerOf(page)).toHaveCount(1)
        await triggerOf(page).click()
        const popup = popupOf(page)
        await expect(popup.getByLabel("Año", { exact: true })).toBeVisible()
        const box = await popup.boundingBox()
        expect(box!.x).toBeGreaterThanOrEqual(-1)
        expect(box!.x + box!.width).toBeLessThanOrEqual(width + 1)
        expect(box!.y).toBeGreaterThanOrEqual(-1)
        expect(box!.y + box!.height).toBeLessThanOrEqual(1001)
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
        measurements.push({ width, view, box })
        if (width === 390 && view === "week" || width === 1440 && view === "week") await page.screenshot({ path: testInfo.outputPath(`date-picker-${theme}-${width}.png`), animations: "disabled" })
        await page.keyboard.press("Escape")
      }
    }
    await page.setViewportSize({ width: 844, height: 390 })
    await triggerOf(page).click()
    await popupOf(page).getByLabel("Año", { exact: true }).fill("2027")
    await popupOf(page).locator('button[data-day]').first().scrollIntoViewIfNeeded()
    await expect(popupOf(page).locator('button[data-day]').first()).toBeInViewport()
    await page.keyboard.press("Escape")
    await testInfo.attach("date-picker-responsive", { body: JSON.stringify(measurements, null, 2), contentType: "application/json" })
  })

  test(`notifications preserve variable insertion, preview, dirty state and save in ${theme}`, async ({ page }) => {
    await login(page, theme, "/notificaciones")
    const save = page.getByRole("button", { name: "Guardar plantilla", exact: true })
    await expect(save).toBeDisabled()
    const message = page.getByLabel("Mensaje", { exact: true })
    await message.fill("Hola , confirma tu cita.")
    await message.evaluate((node: HTMLTextAreaElement) => { node.focus(); node.setSelectionRange(5, 5) })
    await page.getByRole("group", { name: "Insertar variable", exact: true }).getByRole("button", { name: "Nombre del cliente", exact: true }).click()
    await expect(message).toHaveValue("Hola [nombre del cliente], confirma tu cita.")
    await expect(message).toBeFocused()
    await expect(page.getByRole("region", { name: "Vista previa del mensaje", exact: true })).toContainText("Hola María González, confirma tu cita.")
    await expect(save).toBeEnabled()
    await expect(save).toHaveCSS("background-color", theme === "dark" ? "rgb(228, 242, 34)" : "rgb(83, 80, 204)")
    await save.click()
    await expect(page.getByText("Plantilla de notificación actualizada", { exact: true })).toBeVisible()
    await expect(save).toBeDisabled()
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 1000 })
      await expect(message).toHaveValue("Hola [nombre del cliente], confirma tu cita.")
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
    }
  })

  test(`inventory keeps numeric values, warning status, selection accent and actions in ${theme}`, async ({ page }) => {
    await login(page, theme, "/inventario")
    const table = page.getByRole("table").first()
    await expect(table.locator('[data-column="unitCost"]').first()).toHaveCSS("text-align", "right")
    await expect(table.locator('[data-column="stock"]').first()).toHaveCSS("font-variant-numeric", "tabular-nums")
    await expect(table.getByText("Bajo mínimo", { exact: true }).first()).toBeVisible()
    const tab = page.getByRole("tab", { name: "Insumos", exact: true })
    await expect(tab).toHaveAttribute("aria-selected", "true")
    await expect(tab).toHaveCSS("box-shadow", theme === "dark" ? "rgb(228, 242, 34) 0px -2px 0px 0px inset" : "rgb(83, 80, 204) 0px -2px 0px 0px inset")
    await table.getByRole("button", { name: /^Acciones del insumo/ }).first().click()
    for (const name of ["Ver detalle", "Editar", "Eliminar"]) await expect(page.getByRole("menuitem", { name, exact: true })).toBeVisible()
  })

  test(`theme switch reflects the actual theme and preserves the existing preference in ${theme}`, async ({ page }) => {
    await login(page, theme, "/")
    const control = page.getByRole("switch", { name: "Modo oscuro", exact: true })
    await expect(control).toHaveAttribute("aria-checked", String(theme === "dark"))
    await control.click()
    await expect(control).toHaveAttribute("aria-checked", String(theme === "light"))
    await page.reload()
    await expect(page.locator("html")).toHaveClass(theme === "light" ? /dark/ : /^(?!.*dark)/)
    await expect(control).toHaveAttribute("aria-checked", String(theme === "light"))
  })
}
