import { setAccessTheme } from "./helpers/access-theme"
import { test, expect, type Page } from "@playwright/test"
import { selectRecordSection, clinicalNavigation } from "./helpers/clinical-navigation"
import { settleCalendarLayout } from "./helpers/calendar-layout"

test.use({ timezoneId: "America/Guayaquil", reducedMotion: "reduce" })
const sections = ["Datos del paciente", "Antecedentes", "Plan de tratamiento", "Consentimiento y declaración", "Fotos y documentos", "Atenciones", "Tratamientos", "Citas", "Evolución periodontal"]
const root = (page: Page) => page.locator(".clinic-history-workspace")
const kpi = (page: Page, label: string) => page.locator(".clinic-clinical-kpis .clinic-kpi-card").filter({ has: page.locator(".clinic-kpi-label", { hasText: label }) })
async function login(page: Page, theme: string, patient = "pat_5") {
  await page.clock.install({ time: new Date("2026-11-15T17:00:00Z") })
  await page.goto("/login")
  await setAccessTheme(page, theme === "light" ? "light" : "dark")
  await page.locator("#email").fill("admin@clinica.com")
  await page.locator("#password").fill("admin123")
  await page.getByRole("button", { name: "Ingresar", exact: true }).click()
  await page.getByRole("button", { name: "Continuar", exact: true }).click()
  await expect(page).toHaveURL(/\/$/)
  await page.goto(`/historial-clinico/paciente/${patient}`)
  await expect(page.frameLocator("iframe").locator("#toothGrid")).toBeVisible()
  await expect(page.getByRole("button", { name: "Registrar atención", exact: true })).toBeEnabled()
}
async function stored(page: Page) {
  return page.evaluate(() => new Promise<unknown>((resolve, reject) => {
    const request = indexedDB.open("clinicapp-dental-v1")
    request.onsuccess = () => {
      const db = request.result, tx = db.transaction(["records", "files"])
      const records = tx.objectStore("records").getAll(), files = tx.objectStore("files").getAll()
      tx.oncomplete = () => { resolve(JSON.parse(JSON.stringify({ records: records.result, files: files.result }))); db.close() }
      tx.onerror = () => { reject(tx.error); db.close() }
    }
    request.onerror = () => reject(request.error)
  }))
}

test("periodontal presentation distinguishes unmeasured, valid zero and real counts without changing indicators", async ({ page }) => {
  await login(page, "light")
  const result = await page.evaluate(async () => {
    const adapter = "/src/modules/clinical-history/components/periodontal-indicator-presentation.ts"
    const calculator = "/src/modules/clinical-history/lib/chart-indicators.ts"
    const [{ evaluatedPocketCount, pocketCountHint, evolutionPocketReading }, { computeChartIndicators }] = await Promise.all([import(adapter), import(calculator)])
    const calculate = (pd: Record<string, unknown>, bop: string[] = []) => computeChartIndicators({ payload: { teeth: { 11: { perio: { pd, bop } } } } })
    const empty = calculate({ mb: null, b: undefined, db: "", ml: 0, l: "invalid" })
    const zero = calculate({ mb: 1, b: 2, db: 3 }, ["mb"])
    const pockets = calculate({ mb: 3, b: 4, db: 5, ml: 6, l: 2, dl: 3 }, ["mb", "b"])
    const before = JSON.stringify([empty, zero, pockets])
    const values = [null, undefined, empty, zero, pockets].map(value => ({ count: evaluatedPocketCount(value), hint: pocketCountHint(value) }))
    const readings = [empty, zero, pockets].map(indicators => evolutionPocketReading(indicators) ?? null)
    return { values, readings, unchanged: JSON.stringify([empty, zero, pockets]) === before, bleeding: [empty.bleedingPercent, zero.bleedingPercent, pockets.bleedingPercent] }
  })
  expect(result.values.map(item => item.count)).toEqual([null, null, null, 0, 3])
  expect(result.values[2].hint).toBe("Bolsas ≥ 4 mm: Sin evaluar")
  expect(result.values[3].hint).toBe("Bolsas ≥ 4 mm: 0 sitios")
  expect(result.values[4].hint).toBe("Bolsas ≥ 4 mm: 3 sitios")
  expect(result.bleeding).toEqual([null, 33, 33])
  expect(result.readings).toEqual([null, 0, 3])
  expect(result.unchanged).toBe(true)
})

for (const theme of ["light", "dark"]) {
  test(`periodontal cards display absence, zero and positive counts independently of bleeding in ${theme}`, async ({ page }) => {
    await login(page, theme)
    const before = await stored(page)
    const cases = [
      { pd: {}, bop: [], count: null, bleeding: "Sin registro" },
      { pd: { mb: 1, b: 2, db: 3 }, bop: ["mb"], count: 0, bleeding: "33%" },
      { pd: { mb: 3, b: 4, db: 5, ml: 6, l: 2, dl: 3 }, bop: ["mb", "b"], count: 3, bleeding: "33%" },
    ]
    for (const data of cases) {
      // Enter demo measurements through the existing editor in this isolated context; never save them.
      await selectRecordSection(page, "Odontograma y periodontograma")
      const editor = page.frameLocator("iframe")
      if (!await editor.locator("#perioInlinePanel").isVisible()) await editor.locator("#appViewDentalChart").click()
      for (const [index, value] of Object.values(data.pd).entries()) {
        const measurement = editor.locator('input[data-perio$=":pd"]').nth(index)
        await measurement.fill(String(value))
        await measurement.press("Tab")
        const key = (await measurement.getAttribute("data-perio"))!
        const bop = editor.locator(`input[data-perio="${key.replace(":pd", ":bop")}"]`)
        await bop.setChecked(index < data.bop.length)
      }
      const reading = kpi(page, "Sangrado al sondaje")
      await expect(reading.locator(".clinic-kpi-value")).toHaveText(data.bleeding)
      await expect(reading.locator(".clinic-kpi-hint")).toHaveText(data.count === null ? "Bolsas ≥ 4 mm: Sin evaluar" : `Bolsas ≥ 4 mm: ${data.count} sitios`)
      await selectRecordSection(page, "Evolución periodontal")
      const pocket = page.locator(".clinic-periodontal-stats > div").filter({ has: page.getByText("Sitios con bolsa ≥ 4 mm", { exact: true }) })
      await expect(pocket.locator("dd").first()).toHaveText(data.count === null ? "Sin evaluar" : String(data.count))
    }
    expect(await stored(page)).toEqual(before)
  })

  test(`compact plan, legal information, empty states and exports retain their actions in ${theme}`, async ({ page }) => {
    await login(page, theme)
    const before = await stored(page)
    await selectRecordSection(page, "Plan de tratamiento")
    const form = page.getByRole("form", { name: "Agregar tratamiento propuesto" })
    for (const name of ["Tratamiento del catálogo", "Pieza / zona", "Fase", "Fecha prevista"]) await expect(form.getByLabel(name, { exact: true })).toBeVisible()
    await form.getByRole("button", { name: "Agregar", exact: true }).click()
    await expect(form.getByText("Selecciona un tratamiento del catálogo", { exact: true })).toBeVisible()
    await form.getByLabel("Tratamiento del catálogo", { exact: true }).click()
    await page.getByRole("option", { name: /^Limpieza dental/ }).click()
    await form.getByLabel("Pieza / zona", { exact: true }).fill("General")
    await form.getByLabel("Fase", { exact: true }).click()
    await page.getByRole("option", { name: "Higiénica / periodontal básica", exact: true }).click()
    await form.getByLabel("Fecha prevista", { exact: true }).fill("2026-11-16")
    await form.getByRole("button", { name: "Agregar", exact: true }).click()
    await expect(page.getByRole("table", { name: "Tratamientos propuestos" })).toContainText("Limpieza dental")
    await expect(page.getByLabel("Fecha prevista de Limpieza dental", { exact: true })).toHaveValue("2026-11-16")
    await selectRecordSection(page, "Consentimiento y declaración")
    await expect(page.locator("blockquote")).not.toBeEmpty()
    await expect(page.getByRole("checkbox", { name: "El paciente acepta la declaración", exact: true })).not.toBeChecked()
    await selectRecordSection(page, "Fotos y documentos")
    await expect(page.getByRole("button", { name: "Adjuntar archivos", exact: true })).toBeEnabled()
    await expect(page.getByText("Todavía no hay archivos en la historia del paciente.", { exact: true })).toBeVisible()
    const exports = page.locator(".clinic-history-export")
    await expect(exports.getByRole("button")).toHaveCount(3)
    for (const button of await exports.getByRole("button").all()) await expect(button).toBeEnabled()
    await expect(exports).toContainText("Las fotos y los documentos originales se descargan desde su ficha.")
    await expect(exports).toContainText("Historia completa JSON» sirve de respaldo.")
    await selectRecordSection(page, "Plan de tratamiento")
    await expect(page.getByRole("table", { name: "Tratamientos propuestos" })).toContainText("Limpieza dental")
    await page.getByRole("button", { name: "Quitar Limpieza dental de los propuestos", exact: true }).click()
    await expect(page.getByText("No hay tratamientos propuestos. Agrégalos desde el catálogo.", { exact: true })).toBeVisible()
    expect(await stored(page)).toEqual(before)
  })

  test(`medical background and habits retain selection, detail and no-answer states at mobile width in ${theme}`, async ({ page }) => {
    await login(page, theme)
    const before = await stored(page)
    await page.setViewportSize({ width: 375, height: 900 })
    await selectRecordSection(page, "Antecedentes")
    await expect(page.locator(".clinic-history-condition-label").first()).toBeVisible()
    const personal = page.getByRole("checkbox", { name: "Hipertensión arterial: personal", exact: true })
    const familiar = page.getByRole("checkbox", { name: "Hipertensión arterial: familiar", exact: true })
    await personal.check()
    await expect(personal).toBeChecked()
    await expect(familiar).not.toBeChecked()
    const tobacco = page.getByRole("radiogroup", { name: "Tabaco / vapeo", exact: true })
    await expect(tobacco.locator('[aria-checked="true"]')).toHaveCount(0)
    await tobacco.getByRole("radio", { name: "Sí", exact: true }).click()
    await page.getByLabel("Tipo, cantidad y años", { exact: true }).fill("Detalle de prueba")
    await selectRecordSection(page, "Datos del paciente")
    await page.getByLabel("Ocupación", { exact: true }).fill("Ocupación de prueba")
    await selectRecordSection(page, "Antecedentes")
    await expect(personal).toBeChecked()
    await expect(page.getByLabel("Tipo, cantidad y años", { exact: true })).toHaveValue("Detalle de prueba")
    await selectRecordSection(page, "Datos del paciente")
    await expect(page.getByLabel("Ocupación", { exact: true })).toHaveValue("Ocupación de prueba")
    expect(await stored(page)).toEqual(before)
  })

  test(`clinical sections and equal indicator tracks fit eleven widths and both sidebar states in ${theme}`, async ({ page }, testInfo) => {
    test.setTimeout(240000)
    await login(page, theme)
    const before = await stored(page), matrix = []
    for (const width of [320, 360, 375, 390, 430, 600, 768, 1024, 1280, 1440, 1920]) {
      await page.setViewportSize({ width, height: 1000 })
      await settleCalendarLayout(page)
      for (const collapsed of width >= 768 ? [false, true] : [false]) {
        const toggle = page.locator('.clinic-app-header [data-sidebar-toggle]')
        if (width >= 768 && await toggle.getAttribute("aria-expanded") === String(collapsed)) await toggle.click()
        await settleCalendarLayout(page)
        const cards = await page.locator(".clinic-clinical-kpis .clinic-kpi-card").evaluateAll(nodes => nodes.map(n => {
          const box = n.getBoundingClientRect(), top = (selector: string) => n.querySelector(selector)!.getBoundingClientRect().top
          return { y: box.y, height: box.height, label: top(".clinic-kpi-label"), value: top(".clinic-kpi-value"), icon: top(".clinic-summary-icon") }
        }))
        for (const a of cards) for (const b of cards) if (Math.abs(a.y - b.y) < 1) {
          expect(Math.abs(a.height - b.height)).toBeLessThan(1)
          for (const key of ["label", "value", "icon"] as const) expect(Math.abs(a[key] - b[key])).toBeLessThan(1)
        }
        for (const section of sections) {
          await selectRecordSection(page, section)
          const measurement = await root(page).evaluate(node => {
            const active = node.querySelector('[data-slot="tabs-content"]:not([inert])')!
            const controls = [...active.querySelectorAll<HTMLElement>('input:not([aria-hidden="true"]):not([type="hidden"]):not(.sr-only),textarea,[data-slot="select-trigger"],button')]
              .filter(n => !n.closest('[data-slot="table-container"]') && n.getClientRects().length && getComputedStyle(n).visibility !== "hidden")
            const outside = controls.filter(n => { const b = n.getBoundingClientRect(); return b.width > 1 && (b.left < -1 || b.right > innerWidth + 1) }).map(n => n.id || n.getAttribute("aria-label") || n.textContent)
            return { scroll: document.documentElement.scrollWidth, outside, short: controls.filter(n => n.getBoundingClientRect().height < (innerWidth < 1024 ? 44 : 38)).map(n => n.id || n.textContent) }
          })
          expect(measurement.scroll).toBeLessThanOrEqual(width)
          expect(measurement.outside).toEqual([])
          expect(measurement.short).toEqual([])
          await expect(clinicalNavigation(page).getByRole("button", { name: "Ver secciones", exact: true })).toHaveCount(1)
          matrix.push({ width, collapsed, section, ...measurement })
        }
      }
    }
    expect(await stored(page)).toEqual(before)
    await testInfo.attach("clinical-responsive-matrix", { body: JSON.stringify(matrix), contentType: "application/json" })
  })
}
