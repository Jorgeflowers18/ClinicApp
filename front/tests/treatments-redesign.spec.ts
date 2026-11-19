import { expect, test, type Page } from "@playwright/test"
import { settleCalendarLayout } from "./helpers/calendar-layout"

test.use({ reducedMotion: "reduce", timezoneId: "America/Guayaquil" })
test.describe.configure({ mode: "parallel" })
const editor = (page: Page) => page.locator('.treatment-dialog[role="dialog"]')
async function login(page: Page, theme: string) {
  await page.clock.install({ time: new Date("2026-11-18T17:00:00Z") })
  await page.goto("/login")
  await page.getByRole("button", { name: theme === "light" ? "Tema claro" : "Tema oscuro", exact: true }).click()
  await page.locator("#email").fill("admin@clinica.com")
  await page.locator("#password").fill("admin123")
  await page.getByRole("button", { name: "Ingresar", exact: true }).click()
  await page.getByRole("button", { name: "Continuar", exact: true }).click()
  await expect(page).toHaveURL(/\/$/)
}
async function catalog(page: Page) {
  await page.getByRole("link", { name: "Tratamientos", exact: true }).click()
  await expect(page.getByRole("row", { name: /^Ver tratamiento:/ }).first()).toBeVisible()
}
async function group(page: Page, name: "general" | "consumption") {
  const section = editor(page).locator(`[data-treatment-section="${name}"]`)
  const button = section.locator(".treatment-section-trigger")
  if (await button.getAttribute("aria-expanded") !== "true") await button.click()
  await expect(button).toHaveAttribute("aria-expanded", "true")
  await expect(section.locator(".treatment-section-panel")).not.toHaveAttribute("hidden", "")
  await section.locator(".treatment-section-panel").evaluate(async panel => {
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
    await Promise.allSettled(panel.getAnimations().map(animation => animation.finished))
  })
  await expect(editor(page).locator('.treatment-section-trigger[aria-expanded="true"]')).toHaveCount(1)
}
async function fillGeneral(page: Page, name = "Tratamiento de prueba") {
  await group(page, "general")
  await editor(page).getByLabel("Nombre", { exact: true }).fill(name)
  await editor(page).getByLabel("Categoría", { exact: true }).fill("Odontología general")
  await editor(page).getByLabel("Precio (USD)", { exact: true }).fill("61.25")
}
async function supply(page: Page, index = 0) {
  await group(page, "consumption")
  const add = editor(page).getByRole("button", { name: "Agregar insumo", exact: true })
  await expect(add).toBeEnabled()
  await add.click()
  await editor(page).getByLabel("Insumo", { exact: true }).nth(index).click()
  await page.getByRole("option", { name: "Guantes de nitrilo (caja x100)", exact: true }).click()
  await editor(page).getByLabel("Cantidad", { exact: true }).nth(index).fill("2")
}
async function snapshot(page: Page) {
  return page.evaluate(async () => {
    const a = "/src/modules/treatments/api/treatments.mock-data.ts", b = "/src/modules/inventory/api/inventory.api.ts", c = "/src/modules/finance/api/finance.api.ts"
    const [{ mockTreatmentAssignments }, { inventoryApi }, { financeApi }] = await Promise.all([import(a), import(b), import(c)])
    return JSON.parse(JSON.stringify({ assignments: mockTreatmentAssignments, inventory: await inventoryApi.list({ page: 1, pageSize: 1000 }), finance: await financeApi.getTreatmentSummary("trt_2") }))
  })
}
async function close(page: Page) {
  await editor(page).getByRole("button", { name: "Cerrar formulario de tratamiento", exact: true }).click()
  if (await page.getByRole("alertdialog").count()) await page.getByRole("alertdialog").getByRole("button", { name: "Descartar cambios", exact: true }).click()
  await expect(editor(page)).toHaveCount(0)
}

for (const theme of ["light", "dark"]) {
  test(`complete catalog filters combine search, category, status and pagination in ${theme}`, async ({ page }) => {
    await login(page, theme)
    await page.evaluate(async () => {
      const source = "/src/modules/treatments/api/treatments.mock-data.ts", api = "/src/modules/treatments/api/treatments.api.ts"
      const { mockTreatments } = await import(source), { treatmentsApi } = await import(api)
      for (let i = 0; i < 121; i++) mockTreatments.push({ ...mockTreatments[0], id: `test_${i}`, name: `Prueba ${i}`, category: i >= 119 ? "Categoría distante" : "Categoría de prueba", active: i !== 120 })
      const original = treatmentsApi.list
      ;(window as unknown as { catalogReads: number }).catalogReads = 0
      treatmentsApi.list = async query => { (window as unknown as { catalogReads: number }).catalogReads++; return original(query) }
    })
    await catalog(page)
    await expect(page.locator('[data-slot="pagination-bar"]')).toContainText("de 125")
    await page.getByRole("button", { name: "Siguiente", exact: true }).click()
    await expect(page.locator('[data-slot="pagination-bar"]')).toContainText("11-20")
    await page.getByLabel("Filtrar por categoría", { exact: true }).click()
    await page.getByRole("option", { name: "Categoría distante", exact: true }).click()
    await expect(page.locator('[data-slot="pagination-bar"]')).toContainText("1-2 de 2")
    await page.getByLabel("Filtrar por estado", { exact: true }).click()
    await page.getByRole("option", { name: "Inactivo", exact: true }).click()
    await expect(page.getByRole("row", { name: "Ver tratamiento: Prueba 120", exact: true })).toBeVisible()
    await page.getByLabel("Buscar tratamientos", { exact: true }).fill("DISTANTE")
    await expect(page.locator('[data-slot="pagination-bar"]')).toContainText("1-1 de 1")
    expect(await page.evaluate(() => (window as unknown as { catalogReads: number }).catalogReads)).toBe(2)
    await page.getByRole("button", { name: "Restablecer filtros", exact: true }).click()
    await expect(page.locator('[data-slot="pagination-bar"]')).toContainText("1-10 de 125")
    await expect(page.getByLabel("Buscar tratamientos", { exact: true })).toHaveValue("")
    await expect(page.getByRole("button", { name: "Restablecer filtros", exact: true })).toBeDisabled()
  })

  test(`create retains draft and supply rows, submits once and preserves catalog context in ${theme}`, async ({ page }) => {
    await login(page, theme); await catalog(page)
    const before = await snapshot(page)
    await page.getByLabel("Buscar tratamientos", { exact: true }).fill("Resina")
    await expect(page.locator('[data-slot="pagination-bar"]')).toContainText("de 1")
    await page.getByRole("button", { name: "Nuevo tratamiento", exact: true }).click()
    await fillGeneral(page, "Resina de prueba")
    await editor(page).getByLabel("Descripción", { exact: true }).fill("Descripción conservada\nSegunda línea")
    await supply(page)
    await supply(page, 1)
    await group(page, "general")
    await expect(editor(page).getByLabel("Nombre", { exact: true })).toHaveValue("Resina de prueba")
    await expect(editor(page).getByLabel("Descripción", { exact: true })).toHaveValue("Descripción conservada\nSegunda línea")
    await group(page, "consumption")
    await expect(editor(page).getByLabel("Cantidad", { exact: true }).nth(0)).toHaveValue("2")
    await editor(page).getByRole("button", { name: "Quitar insumo 2", exact: true }).click()
    await editor(page).getByRole("button", { name: "Crear tratamiento", exact: true }).click({ clickCount: 2 })
    await expect(editor(page)).toHaveCount(0)
    await expect(page).toHaveURL(/\/tratamientos$/)
    await expect(page.getByLabel("Buscar tratamientos", { exact: true })).toHaveValue("Resina")
    await expect(page.getByRole("row", { name: "Ver tratamiento: Resina de prueba", exact: true })).toBeVisible()
    const created = await page.evaluate(async () => { const path = "/src/modules/treatments/api/treatments.mock-data.ts"; return (await import(path)).mockTreatments.filter(item => item.name === "Resina de prueba") })
    expect(created).toHaveLength(1)
    expect(created[0]).toMatchObject({ durationMinutes: 30, price: 61.25, active: true, consumption: [{ itemId: "inv_1", quantity: 2 }] })
    expect(await snapshot(page)).toEqual(before)
  })

  test(`edit from detail and catalog loads supplies and resists background refetch in ${theme}`, async ({ page }) => {
    await login(page, theme); await page.goto("/tratamientos/trt_2")
    await expect(page.getByRole("heading", { name: "Ajuste de ortodoncia", exact: true })).toBeVisible()
    const before = await snapshot(page)
    await page.getByRole("button", { name: "Editar", exact: true }).click()
    await editor(page).getByLabel("Descripción", { exact: true }).fill("Borrador estable")
    await group(page, "consumption")
    await expect(editor(page).getByLabel("Insumo", { exact: true })).toContainText("Brackets metálicos")
    await expect(editor(page).getByLabel("Cantidad", { exact: true })).toHaveValue("4")
    await page.evaluate(async () => { const path = "/src/shared/lib/query-client.ts"; await (await import(path)).queryClient.invalidateQueries({ queryKey: ["treatments", "detail", "trt_2"] }) })
    await group(page, "general")
    await expect(editor(page).getByLabel("Descripción", { exact: true })).toHaveValue("Borrador estable")
    await page.evaluate(async () => {
      const path = "/src/shared/lib/query-client.ts", { queryClient } = await import(path)
      await queryClient.fetchQuery({ queryKey: ["treatments", "detail", "trt_2"], staleTime: 0, retry: false, queryFn: async () => { throw new Error("Fallo de recarga de prueba") } }).catch(() => undefined)
      if (queryClient.getQueryState(["treatments", "detail", "trt_2"])?.status !== "error") throw new Error("La prueba debe producir un error de recarga real")
    })
    await expect(editor(page).getByLabel("Descripción", { exact: true })).toHaveValue("Borrador estable")
    await editor(page).getByRole("button", { name: "Guardar cambios", exact: true }).click()
    await expect(editor(page)).toHaveCount(0)
    await expect(page).toHaveURL(/\/tratamientos\/trt_2$/)
    await expect(page.getByText("Borrador estable", { exact: true })).toBeVisible()
    expect(await snapshot(page)).toEqual(before)
    await page.getByRole("button", { name: "Editar", exact: true }).click()
    await editor(page).getByLabel("Precio (USD)", { exact: true }).fill("74.25")
    await editor(page).getByRole("button", { name: "Guardar cambios", exact: true }).click()
    await expect(editor(page)).toHaveCount(0)
    const afterPriceEdit = await snapshot(page)
    const expectedAmounts = [afterPriceEdit.finance.totalValue, afterPriceEdit.finance.insuranceCovered, afterPriceEdit.finance.patientResponsibility, afterPriceEdit.finance.totalPaid, afterPriceEdit.finance.pendingBalance].map(value => new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" }).format(value))
    await expect(page.locator('.treatment-financial-values dd')).toHaveText(expectedAmounts)
    expect(afterPriceEdit.assignments).toEqual(before.assignments)
    expect(afterPriceEdit.inventory).toEqual(before.inventory)
    await page.getByRole("button", { name: "Volver a tratamientos", exact: true }).click()
    await page.getByLabel("Filtrar por categoría", { exact: true }).click()
    await page.getByRole("option", { name: "Ortodoncia", exact: true }).click()
    await page.getByRole("button", { name: "Acciones del tratamiento Ajuste de ortodoncia", exact: true }).click()
    await page.getByRole("menuitem", { name: "Editar", exact: true }).click()
    await expect(editor(page).getByLabel("Descripción", { exact: true })).toHaveValue("Borrador estable")
    await editor(page).getByLabel("Categoría", { exact: true }).fill("Categoría de prueba")
    await editor(page).getByRole("button", { name: "Guardar cambios", exact: true }).click()
    await expect(editor(page)).toHaveCount(0)
    await expect(page.getByLabel("Filtrar por categoría", { exact: true })).toContainText("Ortodoncia")
    await expect(page.getByRole("button", { name: "Nuevo tratamiento", exact: true })).toBeFocused()
  })

  test(`validation opens closed sections and failed saves retain the complete draft in ${theme}`, async ({ page }) => {
    await login(page, theme); await catalog(page)
    await page.getByRole("button", { name: "Nuevo tratamiento", exact: true }).click()
    await group(page, "consumption")
    await editor(page).getByRole("button", { name: "Crear tratamiento", exact: true }).click()
    await expect(editor(page).getByLabel("Nombre", { exact: true })).toBeFocused()
    await fillGeneral(page)
    await group(page, "consumption")
    await editor(page).getByRole("button", { name: "Agregar insumo", exact: true }).click()
    await group(page, "general")
    await editor(page).getByRole("button", { name: "Crear tratamiento", exact: true }).click()
    await expect(editor(page).getByLabel("Insumo", { exact: true })).toBeFocused()
    await editor(page).getByLabel("Insumo", { exact: true }).click()
    await page.getByRole("option", { name: "Guantes de nitrilo (caja x100)", exact: true }).click()
    await editor(page).getByLabel("Cantidad", { exact: true }).fill("0")
    await group(page, "general")
    await editor(page).getByRole("button", { name: "Crear tratamiento", exact: true }).click()
    await expect(editor(page).getByLabel("Cantidad", { exact: true })).toBeFocused()
    await expect(editor(page).getByText("Mínimo 1", { exact: true })).toBeVisible()
    await expect(editor(page).getByLabel("Cantidad", { exact: true })).toHaveAccessibleDescription("Mínimo 1")
    await editor(page).getByLabel("Cantidad", { exact: true }).fill("3")
    await page.evaluate(async () => {
      const apiPath = "/src/modules/treatments/api/treatments.api.ts", errorPath = "/src/shared/types/common.ts"
      const { treatmentsApi } = await import(apiPath), { ApiError } = await import(errorPath)
      const original = treatmentsApi.create
      treatmentsApi.create = async () => { treatmentsApi.create = original; throw new ApiError("Error de prueba", 400, [{ field: "name", message: "Nombre rechazado por prueba" }]) }
    })
    await editor(page).getByRole("button", { name: "Crear tratamiento", exact: true }).click()
    await expect(editor(page).getByText("Nombre rechazado por prueba", { exact: true })).toBeVisible()
    await expect(editor(page).getByLabel("Nombre", { exact: true })).toHaveAccessibleDescription("Nombre rechazado por prueba")
    await expect(editor(page).getByLabel("Nombre", { exact: true })).toHaveValue("Tratamiento de prueba")
    await editor(page).getByLabel("Nombre", { exact: true }).fill("Tratamiento reintentado")
    await editor(page).getByRole("button", { name: "Crear tratamiento", exact: true }).click()
    await expect(editor(page)).toHaveCount(0)
  })

  test(`dirty close actions preserve input, trap focus and restore the opening control in ${theme}`, async ({ page }) => {
    await login(page, theme); await catalog(page)
    const before = await snapshot(page)
    await page.getByRole("button", { name: "Nuevo tratamiento", exact: true }).click()
    const mainScroll = await page.locator("main").evaluate(node => node.scrollTop)
    await page.mouse.move(3, 3); await page.mouse.wheel(0, 800)
    expect(await page.locator("main").evaluate(node => node.scrollTop)).toBe(mainScroll)
    await editor(page).getByLabel("Nombre", { exact: true }).fill("Borrador")
    for (const action of ["x", "cancel", "escape", "outside"]) {
      if (action === "x") await editor(page).getByRole("button", { name: "Cerrar formulario de tratamiento", exact: true }).click()
      if (action === "cancel") await editor(page).getByRole("button", { name: "Cancelar", exact: true }).click()
      if (action === "escape") await page.keyboard.press("Escape")
      if (action === "outside") await page.mouse.click(3, 3)
      await expect(page.getByRole("alertdialog")).toBeVisible()
      await page.getByRole("alertdialog").getByRole("button", { name: "Continuar editando", exact: true }).click()
      await expect(editor(page).getByLabel("Nombre", { exact: true })).toHaveValue("Borrador")
    }
    for (let i = 0; i < 15; i++) { await page.keyboard.press("Tab"); await expect.poll(() => editor(page).evaluate(node => node.contains(document.activeElement))).toBe(true) }
    await close(page)
    await expect(page.getByRole("button", { name: "Nuevo tratamiento", exact: true })).toBeFocused()
    expect(await snapshot(page)).toEqual(before)
  })

  test(`financial values and real session counts remain independent from displayed progress in ${theme}`, async ({ page }) => {
    await login(page, theme); await page.goto("/tratamientos/trt_2")
    await expect(page.getByRole("heading", { name: "Ajuste de ortodoncia", exact: true })).toBeVisible()
    const before = await snapshot(page)
    const amounts = await page.evaluate(() => [...document.querySelectorAll('.treatment-financial-values dd')].map(n => n.textContent))
    const expected = [before.finance.totalValue, before.finance.insuranceCovered, before.finance.patientResponsibility, before.finance.totalPaid, before.finance.pendingBalance].map(value => new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" }).format(value))
    expect(amounts).toEqual(expected)
    await expect(page.getByRole("progressbar", { name: "Sesiones realizadas", exact: true })).toHaveAttribute("aria-valuenow", "5")
    await expect(page.getByText("5 de 12 sesiones", { exact: true }).filter({ visible: true })).toBeVisible()
    for (const sample of [{ done: 12, total: 12, valid: true }, { done: 0, total: 0, valid: false }, { done: 13, total: 12, valid: false }, { done: undefined, total: undefined, valid: false }]) {
      await page.evaluate(async sample => { const a = "/src/modules/treatments/api/treatments.mock-data.ts", b = "/src/shared/lib/query-client.ts"; const [{ mockTreatmentAssignments }, { queryClient }] = await Promise.all([import(a), import(b)]); const index = mockTreatmentAssignments.findIndex(item => item.id === "asg_1"); mockTreatmentAssignments[index] = { ...mockTreatmentAssignments[index], completedSessions: sample.done, totalSessions: sample.total }; await queryClient.invalidateQueries({ queryKey: ["treatments", "assignments", "trt_2"] }) }, sample)
      await expect(page.getByRole("progressbar")).toHaveCount(sample.valid ? 1 : 0)
      await expect(page.getByText("En progreso", { exact: true }).filter({ visible: true })).toBeVisible()
    }
  })

  test(`loading and pending writes cannot expose an empty editor or discard submitted values in ${theme}`, async ({ page }) => {
    await login(page, theme); await catalog(page)
    await page.evaluate(async () => {
      const path = "/src/modules/treatments/api/treatments.api.ts", { treatmentsApi } = await import(path), original = treatmentsApi.get
      treatmentsApi.get = async id => { treatmentsApi.get = original; return new Promise(resolve => { (window as unknown as { releaseTreatment: () => void }).releaseTreatment = () => { void original(id).then(resolve) } }) }
    })
    await page.getByRole("button", { name: "Acciones del tratamiento Ajuste de ortodoncia", exact: true }).click()
    await page.getByRole("menuitem", { name: "Editar", exact: true }).click()
    await expect(editor(page).getByLabel("Cargando tratamiento", { exact: true })).toBeVisible()
    await expect(editor(page).getByLabel("Nombre", { exact: true })).toHaveCount(0)
    await expect(editor(page).getByRole("button", { name: "Guardar cambios", exact: true })).toHaveCount(0)
    await page.evaluate(() => (window as unknown as { releaseTreatment: () => void }).releaseTreatment())
    await expect(editor(page).getByLabel("Nombre", { exact: true })).toHaveValue("Ajuste de ortodoncia")
    await editor(page).getByLabel("Nombre", { exact: true }).fill("Ajuste de prueba")
    await page.evaluate(async () => {
      const path = "/src/modules/treatments/api/treatments.api.ts", { treatmentsApi } = await import(path), original = treatmentsApi.update
      treatmentsApi.update = async (id, values) => { treatmentsApi.update = original; return new Promise((resolve, reject) => { (window as unknown as { releaseWrite: () => void }).releaseWrite = () => { void original(id, values).then(resolve, reject) } }) }
    })
    await editor(page).getByRole("button", { name: "Guardar cambios", exact: true }).click()
    await expect(editor(page).getByRole("button", { name: "Cerrar formulario de tratamiento", exact: true })).toBeDisabled()
    await expect(editor(page).getByLabel("Nombre", { exact: true })).toBeDisabled()
    expect(await page.evaluate(() => !window.dispatchEvent(new Event('beforeunload', { cancelable: true })))).toBe(true)
    await page.keyboard.press("Escape")
    await expect(editor(page)).toBeVisible()
    await expect(page.getByRole("alertdialog")).toHaveCount(0)
    await page.evaluate(() => (window as unknown as { releaseWrite: () => void }).releaseWrite())
    await expect(editor(page)).toHaveCount(0)
    await expect(page.getByRole("row", { name: "Ver tratamiento: Ajuste de prueba", exact: true })).toBeVisible()
    await page.goto('/tratamientos/no-existe/editar')
    await expect(editor(page).getByText('No se pudo cargar el tratamiento', { exact: true })).toBeVisible()
    await expect(editor(page).getByLabel('Nombre', { exact: true })).toHaveCount(0)
  })

  test(`accordion motion is sequential and respects reduced motion in ${theme}`, async ({ page }) => {
    await login(page, theme); await catalog(page)
    await page.emulateMedia({ reducedMotion: "no-preference" })
    await page.getByRole("button", { name: "Nuevo tratamiento", exact: true }).click()
    await expect(editor(page)).toBeVisible()
    const samples = await editor(page).evaluate(async root => {
      const old = root.querySelector('[data-treatment-section="general"] .treatment-section-panel')!
      const next = root.querySelector<HTMLElement>('[data-treatment-section="consumption"] .treatment-section-trigger')!
      const samples: { open: number; height: number }[] = []
      next.click(); const start = performance.now()
      while (performance.now() - start < 520) { samples.push({ open: root.querySelectorAll('.treatment-section-trigger[aria-expanded="true"]').length, height: old.getBoundingClientRect().height }); await new Promise(resolve => requestAnimationFrame(resolve)) }
      return samples
    })
    expect(Math.max(...samples.map(item => item.open))).toBeLessThanOrEqual(1)
    expect(new Set(samples.filter(item => item.height > 0).map(item => Math.round(item.height))).size).toBeGreaterThan(2)
    await page.emulateMedia({ reducedMotion: "reduce" })
    await group(page, "general")
    await expect(editor(page).locator('.treatment-section-panel').first()).toHaveCSS("transition-duration", "0s")
  })

  test(`mobile action menus support keyboard access and preserve delete cancellation in ${theme}`, async ({ page }) => {
    await login(page, theme)
    await page.setViewportSize({ width: 375, height: 568 })
    await page.goto('/tratamientos')
    const trigger = page.getByRole('button', { name: 'Acciones del tratamiento Resina compuesta', exact: true })
    await expect(trigger).toBeVisible()
    await page.locator('main').evaluate(node => node.scrollTop = node.scrollHeight)
    await trigger.focus(); await page.keyboard.press('Enter')
    const menu = page.getByRole('menu')
    await expect(menu).toBeVisible()
    expect(await menu.getByRole('menuitem').allTextContents()).toEqual(['Ver detalle', 'Editar', 'Eliminar'])
    const bounds = (await menu.boundingBox())!
    expect(bounds.y).toBeGreaterThanOrEqual(-1)
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(569)
    await menu.getByRole('menuitem', { name: 'Editar', exact: true }).focus()
    await page.keyboard.press('Enter')
    await expect(editor(page).getByLabel('Nombre', { exact: true })).toHaveValue('Resina compuesta')
    await expect(page).toHaveURL(/\/tratamientos$/)
    await close(page)
    await expect(trigger).toBeFocused()
    await page.keyboard.press('Enter')
    await page.getByRole('menuitem', { name: 'Eliminar', exact: true }).focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('alertdialog', { name: 'Eliminar tratamiento', exact: true })).toBeVisible()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Cancelar', exact: true }).click()
    await expect(trigger).toBeVisible()
    await expect(page).toHaveURL(/\/tratamientos$/)
  })

  test(`editor reflows at a viewport equivalent to 200 percent zoom in ${theme}`, async ({ page }, testInfo) => {
    await login(page, theme)
    // A 1440 x 900 workspace at 200% leaves 720 x 450 CSS pixels.
    // This checks layout reflow, not Chrome's toolbar zoom or a physical keyboard.
    await page.setViewportSize({ width: 720, height: 450 })
    await page.goto('/tratamientos')
    await expect(page.getByText('Ajuste de ortodoncia', { exact: true }).filter({ visible: true }).first()).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(720)
    await page.getByRole('button', { name: 'Nuevo tratamiento', exact: true }).click()
    await fillGeneral(page, 'Comprobación de reflow')
    for (const section of ['general', 'consumption'] as const) {
      await group(page, section)
      const actions = editor(page).locator('.treatment-form-actions')
      await actions.scrollIntoViewIfNeeded()
      await expect(actions).toBeInViewport()
      const overflow = await editor(page).evaluate(node => ({ width: node.clientWidth, scroll: node.scrollWidth, top: node.getBoundingClientRect().top, bottom: node.getBoundingClientRect().bottom }))
      expect(overflow.scroll).toBeLessThanOrEqual(overflow.width)
      expect(overflow.top).toBeGreaterThanOrEqual(-1)
      expect(overflow.bottom).toBeLessThanOrEqual(451)
    }
    await page.screenshot({ path: testInfo.outputPath(`zoom-reflow-${theme}.png`), animations: 'disabled' })
    await close(page)
    await page.getByText('Ajuste de ortodoncia', { exact: true }).filter({ visible: true }).first().click()
    await expect(page.getByRole('heading', { name: 'Ajuste de ortodoncia', exact: true })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(720)
  })

  test(`catalog, detail, menus and both editors fit eleven widths and sidebar states in ${theme}`, async ({ page }, testInfo) => {
    test.setTimeout(240000)
    await login(page, theme)
    const matrix = []
    for (const width of [320, 360, 375, 390, 430, 600, 768, 1024, 1280, 1440, 1920]) {
      await page.setViewportSize({ width, height: 900 })
      for (const collapsed of width >= 768 ? [false, true] : [false]) {
        await page.goto('/tratamientos'); await settleCalendarLayout(page)
        const toggle = page.locator('.clinic-app-header [data-sidebar-toggle]')
        if (width >= 768 && await toggle.getAttribute('aria-expanded') === String(collapsed)) await toggle.click()
        await settleCalendarLayout(page)
        await expect(page.getByText('Ajuste de ortodoncia', { exact: true }).filter({ visible: true }).first()).toBeVisible()
        const trigger = page.getByRole('button', { name: 'Acciones del tratamiento Ajuste de ortodoncia', exact: true }).filter({ visible: true })
        await trigger.click()
        const menu = page.getByRole('menu')
        await expect(menu).toBeVisible()
        const box = (await menu.boundingBox())!
        expect(box.x).toBeGreaterThanOrEqual(-1); expect(box.x + box.width).toBeLessThanOrEqual(width + 1)
        await page.keyboard.press('Escape')
        await page.evaluate(async () => { const path = "/src/modules/inventory/api/inventory.mock-data.ts"; const { mockInventoryItems } = await import(path); const index = mockInventoryItems.findIndex(item => item.id === "inv_3"); mockInventoryItems[index] = { ...mockInventoryItems[index], name: "Brackets metálicos de alta precisión para tratamientos de ortodoncia y uso clínico (presentación de prueba)" } })
        await page.getByRole('button', { name: 'Nuevo tratamiento', exact: true }).click()
        for (const section of ['general', 'consumption'] as const) {
          await group(page, section)
          const bounds = (await editor(page).boundingBox())!
          expect(bounds.x).toBeGreaterThanOrEqual(-1); expect(bounds.x + bounds.width).toBeLessThanOrEqual(width + 1)
          const actions = editor(page).locator('.treatment-form-actions')
          await actions.scrollIntoViewIfNeeded()
          await expect(actions).toBeInViewport()
          await expect(actions).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
          await expect(actions).toHaveCSS('border-top-width', '0px')
        }
        await close(page)
        await page.getByText('Ajuste de ortodoncia', { exact: true }).filter({ visible: true }).first().click()
        await expect(page.getByRole('heading', { name: 'Ajuste de ortodoncia', exact: true })).toBeVisible()
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
        await page.getByRole('button', { name: 'Editar', exact: true }).click()
        await group(page, 'consumption')
        const controls = await editor(page).locator('[data-treatment-section="consumption"] :is(input:not([type="hidden"]),[data-slot="select-trigger"],button)').evaluateAll(nodes => nodes.filter(n => n.getClientRects().length && n.getAttribute('aria-hidden') !== 'true').map(n => ({ x: n.getBoundingClientRect().x, right: n.getBoundingClientRect().right, height: n.getBoundingClientRect().height })))
        for (const control of controls) { expect(control.x).toBeGreaterThanOrEqual(-1); expect(control.right).toBeLessThanOrEqual(width + 1); expect(control.height).toBeGreaterThanOrEqual(width < 1024 ? 44 : 38) }
        await close(page)
        matrix.push({ width, collapsed, menu: box, controls })
      }
    }
    await page.setViewportSize({ width: 390, height: 380 }); await page.goto('/tratamientos/nuevo')
    await expect(editor(page).getByLabel('Nombre', { exact: true })).toBeVisible()
    await editor(page).getByLabel('Descripción', { exact: true }).fill('Prueba de teclado virtual')
    await editor(page).getByRole('button', { name: 'Crear tratamiento', exact: true }).scrollIntoViewIfNeeded()
    await expect(editor(page).getByRole('button', { name: 'Crear tratamiento', exact: true })).toBeInViewport()
    await testInfo.attach('treatment-responsive-matrix', { body: JSON.stringify(matrix), contentType: 'application/json' })
  })
}
