import { expect, test, type Page } from "@playwright/test"
import { clinicalNavigation, selectRecordSection } from "./helpers/clinical-navigation"
import { activeEncounterStep, encounterStepNames, encounterStepSelector, openEncounterGroup, selectEncounterStep } from "./helpers/encounter-navigation"
import { settleCalendarLayout } from "./helpers/calendar-layout"

test.use({ timezoneId: "America/Guayaquil", reducedMotion: "reduce" })
const dialog = (page: Page) => page.getByRole("dialog", { name: "Registrar atención", exact: true })
const radio = (page: Page, group: string, name: string) => activeEncounterStep(page).getByRole("radiogroup", { name: group, exact: true }).getByRole("radio", { name, exact: true })
async function login(page: Page, theme: string) {
  await page.clock.install({ time: new Date("2026-11-15T17:00:00Z") })
  await page.goto("/login")
  await page.getByRole("button", { name: theme === "light" ? "Tema claro" : "Tema oscuro", exact: true }).click()
  await page.locator("#email").fill("admin@clinica.com")
  await page.locator("#password").fill("admin123")
  await page.getByRole("button", { name: "Ingresar", exact: true }).click()
  await page.getByRole("button", { name: "Continuar", exact: true }).click()
  await expect(page).toHaveURL(/\/$/)
  await page.goto("/historial-clinico/paciente/pat_5")
  await expect(page.frameLocator("iframe").locator("#toothGrid")).toBeVisible()
}
async function open(page: Page) {
  await page.getByRole("button", { name: "Registrar atención", exact: true }).click()
  await expect(dialog(page)).toBeVisible()
}
async function stored(page: Page) {
  return page.evaluate(() => new Promise<unknown>((resolve, reject) => {
    const request = indexedDB.open("clinicapp-dental-v1", 1)
    request.onsuccess = () => {
      const db = request.result, tx = db.transaction(["records", "files"])
      const records = tx.objectStore("records").getAll(), files = tx.objectStore("files").getAll()
      tx.oncomplete = () => { resolve(JSON.parse(JSON.stringify({ records: records.result, files: files.result }))); db.close() }
      tx.onerror = () => { reject(tx.error); db.close() }
    }
    request.onerror = () => reject(request.error)
  }))
}
async function reason(page: Page) {
  await selectEncounterStep(page, "Motivo")
  await page.getByLabel("Profesional", { exact: true }).click()
  await page.getByRole("option", { name: "Dra. Carla Ríos", exact: true }).click()
  await page.getByLabel("Motivo de consulta", { exact: true }).fill("Control de demostración")
}
async function diagnosis(page: Page) {
  await selectEncounterStep(page, "Diagnóstico y pronóstico")
  await openEncounterGroup(page, "diagnoses")
  await page.getByRole("button", { name: "Agregar diagnóstico", exact: true }).click()
  await page.getByLabel("Diagnóstico clínico / CIE-10", { exact: true }).fill("Diagnóstico de demostración")
}

for (const theme of ["light", "dark"]) {
  test(`modal keeps patient context, traps focus and protects every close action in ${theme}`, async ({ page }) => {
    await login(page, theme)
    await selectRecordSection(page, "Antecedentes")
    const frame = page.frames().find(frame => frame.url().includes("odontogram.html"))
    const before = await stored(page)
    await open(page)
    await expect(dialog(page)).toContainText("Valentina Suárez")
    await expect(dialog(page)).toContainText("0506070809")
    await expect(dialog(page)).toContainText("HC-000005")
    await expect(page.getByRole("heading", { name: "Registrar atención", exact: true })).toBeFocused()
    await page.getByLabel("Motivo de consulta", { exact: true }).fill("Borrador conservado")
    for (const action of ["x", "escape", "cancel", "outside"]) {
      if (action === "x") await page.getByRole("button", { name: "Cerrar registro de atención", exact: true }).click()
      if (action === "escape") await page.keyboard.press("Escape")
      if (action === "cancel") await page.getByRole("button", { name: "Cancelar", exact: true }).click()
      if (action === "outside") await page.mouse.click(4, 4)
      const warning = page.getByRole("alertdialog", { name: "Salir sin guardar", exact: true })
      await expect(warning).toBeVisible()
      await warning.getByRole("button", { name: "Seguir editando", exact: true }).click()
      await expect(page.getByLabel("Motivo de consulta", { exact: true })).toHaveValue("Borrador conservado")
    }
    await encounterStepSelector(page).click()
    await expect(page.getByRole("option")).toHaveCount(6)
    await page.keyboard.press("Escape")
    await expect(page.getByRole("alertdialog")).toHaveCount(0)
    for (let i = 0; i < 18; i++) {
      await page.keyboard.press("Tab")
      expect(await dialog(page).evaluate(node => node.contains(document.activeElement))).toBe(true)
    }
    await page.getByRole("button", { name: "Cerrar registro de atención", exact: true }).click()
    await page.getByRole("alertdialog").getByRole("button", { name: "Salir sin guardar", exact: true }).click()
    await expect(dialog(page)).toHaveCount(0)
    await expect(clinicalNavigation(page).getByRole("heading", { level: 2 })).toHaveText("Antecedentes")
    await expect(page.getByRole("button", { name: "Registrar atención", exact: true })).toBeFocused()
    expect(page.frames()).toContain(frame)
    expect(await stored(page)).toEqual(before)
  })

  test(`selector, sequential navigation and exclusive groups retain clinical values in ${theme}`, async ({ page }) => {
    await login(page, theme)
    const before = await stored(page)
    await open(page)
    await reason(page)
    await page.getByLabel("Enfermedad actual", { exact: true }).fill("Narración clínica de prueba")
    await page.getByRole("button", { name: "Siguiente", exact: true }).click()
    await expect(encounterStepSelector(page)).toContainText("Signos vitales y riesgo")
    await page.getByLabel("Peso (kg)", { exact: true }).fill("70")
    await page.getByLabel("Talla (cm)", { exact: true }).fill("175")
    await expect(page.getByLabel("IMC calculado")).toHaveText("22.9")
    await openEncounterGroup(page, "asa")
    await expect(activeEncounterStep(page).locator('.clinic-encounter-group-trigger[aria-expanded="true"]')).toHaveCount(1)
    await radio(page, "Clasificación ASA", "ASA II").click()
    await openEncounterGroup(page, "risk")
    await page.getByRole("checkbox", { name: "Interconsulta requerida", exact: true }).check()
    await page.getByLabel("Especialista o motivo de la interconsulta", { exact: true }).fill("Consulta de demostración")
    await openEncounterGroup(page, "vitals")
    await expect(page.getByLabel("Peso (kg)", { exact: true })).toHaveValue("70")
    await diagnosis(page)
    await selectEncounterStep(page, "Motivo")
    await expect(page.getByLabel("Motivo de consulta", { exact: true })).toHaveValue("Control de demostración")
    await expect(page.getByLabel("Enfermedad actual", { exact: true })).toHaveValue("Narración clínica de prueba")
    await selectEncounterStep(page, "Revisión")
    const review = activeEncounterStep(page)
    for (const text of ["Control de demostración", "ASA II", "IMC 22.9", "Consulta de demostración", "Diagnóstico de demostración"]) await expect(review).toContainText(text)
    await expect(page.getByRole("button", { name: "Siguiente", exact: true })).toHaveCount(0)
    await page.getByRole("button", { name: "Anterior", exact: true }).click()
    await expect(encounterStepSelector(page)).toContainText("Tratamientos y evolución")
    expect(await stored(page)).toEqual(before)
  })

  test(`closed groups and hidden steps preserve pending catalog and examination inputs in ${theme}`, async ({ page }) => {
    await login(page, theme)
    await open(page)
    await selectEncounterStep(page, "Tratamientos y evolución")
    await openEncounterGroup(page, "performed")
    await page.getByLabel("Tratamiento del catálogo", { exact: true }).click()
    await page.getByRole("option", { name: /^Resina compuesta/ }).click()
    await page.getByLabel("Pieza / zona", { exact: true }).fill("36")
    await openEncounterGroup(page, "materials")
    await page.getByLabel("Materiales / anestesia / lote", { exact: true }).fill("Lote de prueba")
    await openEncounterGroup(page, "performed")
    await expect(page.getByLabel("Tratamiento del catálogo", { exact: true })).toContainText("Resina compuesta")
    await expect(page.getByLabel("Pieza / zona", { exact: true })).toHaveValue("36")
    await selectEncounterStep(page, "Motivo")
    await selectEncounterStep(page, "Tratamientos y evolución")
    await expect(page.getByLabel("Pieza / zona", { exact: true })).toHaveValue("36")
    await page.getByRole("button", { name: "Agregar", exact: true }).click()
    await openEncounterGroup(page, "exams")
    await page.getByLabel("Examen", { exact: true }).click()
    await page.getByRole("option", { name: "Panorámica", exact: true }).click()
    await page.getByLabel("Detalle (opcional)", { exact: true }).fill("Detalle todavía no solicitado")
    await openEncounterGroup(page, "evolution")
    const narrative = "Evolución de prueba. ".repeat(180)
    await page.getByLabel("Evolución / indicaciones", { exact: true }).fill(narrative)
    await openEncounterGroup(page, "exams")
    await expect(page.getByLabel("Examen", { exact: true })).toContainText("Panorámica")
    await expect(page.getByLabel("Detalle (opcional)", { exact: true })).toHaveValue("Detalle todavía no solicitado")
    await page.getByRole("button", { name: "Solicitar", exact: true }).click()
    await selectEncounterStep(page, "Revisión")
    await expect(activeEncounterStep(page)).toContainText("Resina compuesta (36)")
    await expect(activeEncounterStep(page)).toContainText(narrative.trim())
    await expect(activeEncounterStep(page)).toContainText("Panorámica · Detalle todavía no solicitado")
  })

  test(`validation reveals the actual step and error group without bypassing save in ${theme}`, async ({ page }) => {
    await login(page, theme)
    const before = await stored(page)
    await open(page)
    await selectEncounterStep(page, "Revisión")
    await page.getByRole("button", { name: "Guardar atención", exact: true }).click()
    await expect(encounterStepSelector(page)).toContainText("Motivo")
    await expect(page.getByRole("alertdialog")).toHaveCount(0)
    await reason(page)
    await diagnosis(page)
    await selectEncounterStep(page, "Signos vitales y riesgo")
    await openEncounterGroup(page, "risk")
    await page.getByRole("checkbox", { name: "Interconsulta requerida", exact: true }).check()
    await openEncounterGroup(page, "asa")
    await selectEncounterStep(page, "Revisión")
    await page.getByRole("button", { name: "Revisar Signos vitales y riesgo", exact: true }).click()
    await expect(activeEncounterStep(page).locator('[data-encounter-group="risk"] .clinic-encounter-group-trigger')).toHaveAttribute("aria-expanded", "true")
    await page.getByRole("button", { name: "Guardar atención", exact: true }).click()
    await expect(page.getByLabel("Especialista o motivo de la interconsulta", { exact: true })).toBeFocused()
    await expect(activeEncounterStep(page).getByText("Indica el especialista o el motivo de la interconsulta", { exact: true })).toBeVisible()
    await page.getByLabel("Especialista o motivo de la interconsulta", { exact: true }).fill("Detalle corregido")
    await selectEncounterStep(page, "Examen clínico")
    await radio(page, "ATM / ruidos / dolor", "Alterado").click()
    await openEncounterGroup(page, "pain")
    await page.getByRole("button", { name: "Siguiente", exact: true }).click()
    await expect(activeEncounterStep(page).locator('[data-encounter-group="extraoral"] .clinic-encounter-group-trigger')).toHaveAttribute("aria-expanded", "true")
    await expect(page.getByLabel("Hallazgo de ATM / ruidos / dolor", { exact: true })).toBeFocused()
    expect(await stored(page)).toEqual(before)
  })

  test(`one confirmed encounter refreshes the preserved patient workspace in ${theme}`, async ({ page }) => {
    await login(page, theme)
    await open(page)
    await reason(page)
    await diagnosis(page)
    await selectEncounterStep(page, "Revisión")
    await page.getByRole("button", { name: "Guardar atención", exact: true }).click()
    await page.getByRole("alertdialog").getByRole("button", { name: "Volver", exact: true }).click()
    await expect(dialog(page)).toBeVisible()
    await page.getByRole("button", { name: "Guardar atención", exact: true }).click()
    await page.getByRole("alertdialog").getByRole("button", { name: "Confirmar y guardar", exact: true }).click({ clickCount: 2 })
    await expect(dialog(page)).toHaveCount(0)
    await expect(page).toHaveURL(/\/historial-clinico\/paciente\/pat_5\?atencion=/)
    await expect(clinicalNavigation(page).getByRole("heading", { level: 2 })).toHaveText("Atenciones")
    await expect(page.getByRole("article", { name: /Atención del/ })).toHaveCount(1)
    await expect(page.getByRole("article")).toContainText("Diagnóstico de demostración")
    const history = await page.evaluate(async () => { const path = "/src/modules/clinical-history/api/clinical-history.api.ts"; return (await import(path)).clinicalHistoryApi.getRecord("pat_5") })
    expect(history.encounters).toHaveLength(1)
  })

  test(`exclusive panels animate sequentially with stable modal geometry in ${theme}`, async ({ page }) => {
    await login(page, theme)
    await page.emulateMedia({ reducedMotion: "no-preference" })
    await open(page)
    await selectEncounterStep(page, "Signos vitales y riesgo")
    const samples = await activeEncounterStep(page).evaluate(async root => {
      const result: { open: number; top: number; height: number }[] = []
      const trigger = root.querySelector<HTMLElement>('[data-encounter-group="asa"] .clinic-encounter-group-trigger')!
      trigger.click()
      const start = performance.now()
      while (performance.now() - start < 520) {
        result.push({ open: root.querySelectorAll('.clinic-encounter-group[data-open]').length,
          top: root.closest('[data-slot="dialog-content"]')!.getBoundingClientRect().top,
          height: root.querySelector('[data-encounter-group="vitals"] .clinic-encounter-group-panel')!.getBoundingClientRect().height })
        await new Promise(resolve => requestAnimationFrame(resolve))
      }
      return result
    })
    expect(Math.max(...samples.map(s => s.open))).toBeLessThanOrEqual(1)
    expect(Math.max(...samples.map(s => s.top)) - Math.min(...samples.map(s => s.top))).toBeLessThan(2)
    expect(new Set(samples.filter(s => s.height > 0).map(s => Math.round(s.height))).size).toBeGreaterThan(2)
    await expect(activeEncounterStep(page).locator('[data-encounter-group="asa"] .clinic-encounter-group-trigger')).toHaveAttribute("aria-expanded", "true")
    await page.emulateMedia({ reducedMotion: "reduce" })
    await openEncounterGroup(page, "risk")
    await expect(activeEncounterStep(page).locator('[data-encounter-group="risk"] .clinic-encounter-group-panel')).toHaveCSS("transition-duration", "0s")
  })

  test(`medical columns keep the full order and both selections across sections in ${theme}`, async ({ page }) => {
    await login(page, theme)
    await selectRecordSection(page, "Antecedentes")
    const names = await page.evaluate(async () => { const path = "/src/modules/clinical-history/types/background.types.ts"; return (await import(path)).medicalConditionItems.map((item: string[]) => item[1]) })
    expect(await page.locator(".clinic-history-medical-denies").evaluate(node => node.getBoundingClientRect().height)).toBeLessThanOrEqual(62)
    const controls = page.locator('.clinic-history-medical-columns [role="checkbox"]')
    expect(await controls.evaluateAll(nodes => nodes.map(n => n.getAttribute("aria-label")))).toEqual(names.flatMap((name: string) => [`${name}: personal`, `${name}: familiar`]))
    await expect(controls).toHaveCount(38)
    const tables = page.locator(".clinic-history-medical-columns > div")
    const boxes = await tables.evaluateAll(nodes => nodes.map(n => n.getBoundingClientRect().toJSON()))
    expect(Math.abs(boxes[0].y - boxes[1].y)).toBeLessThan(1)
    expect(boxes[1].x).toBeGreaterThan(boxes[0].right)
    for (const name of ["Hipertensión arterial", "Osteoporosis", "Otro"]) for (const type of ["personal", "familiar"]) await page.getByRole("checkbox", { name: `${name}: ${type}`, exact: true }).check()
    await page.getByLabel("Detalle de Otro", { exact: true }).fill("Antecedente de prueba")
    await selectRecordSection(page, "Datos del paciente")
    await selectRecordSection(page, "Antecedentes")
    await expect(page.getByRole("checkbox", { name: "Osteoporosis: familiar", exact: true })).toBeChecked()
    await expect(page.getByLabel("Detalle de Otro", { exact: true })).toHaveValue("Antecedente de prueba")
    await page.getByRole("checkbox", { name: "Niega antecedentes relevantes", exact: true }).check()
    await page.getByRole("region", { name: "Cambios sin guardar" }).getByRole("button", { name: "Guardar cambios", exact: true }).click()
    await expect(page.getByText("«Niega antecedentes relevantes» no se puede marcar junto con otros antecedentes", { exact: true })).toBeVisible()
  })

  test(`modal and groups fit eleven widths, short keyboards and both sidebar states in ${theme}`, async ({ page }, testInfo) => {
    test.setTimeout(240000)
    await login(page, theme)
    const before = await stored(page), matrix = []
    for (const width of [320, 360, 375, 390, 430, 600, 768, 1024, 1280, 1440, 1920]) {
      await page.setViewportSize({ width, height: 900 })
      await settleCalendarLayout(page)
      for (const collapsed of width >= 768 ? [false, true] : [false]) {
        const toggle = page.locator('.clinic-app-header [data-sidebar-toggle]')
        if (width >= 768 && await toggle.getAttribute("aria-expanded") === String(collapsed)) await toggle.click()
        await settleCalendarLayout(page)
        await open(page)
        const mainScroll = await page.locator("main").evaluate(node => node.scrollTop)
        await page.mouse.wheel(0, 800)
        expect(await page.locator("main").evaluate(node => node.scrollTop)).toBe(mainScroll)
        for (const name of encounterStepNames) {
          await selectEncounterStep(page, name)
          if (name === "Signos vitales y riesgo") await openEncounterGroup(page, "risk")
          if (name === "Examen clínico") await openEncounterGroup(page, "risks")
          if (name === "Diagnóstico y pronóstico") await openEncounterGroup(page, "modifiers")
          if (name === "Tratamientos y evolución") await openEncounterGroup(page, "evolution")
          const result = await dialog(page).evaluate(node => {
            const box = node.getBoundingClientRect(), active = node.querySelector('[data-encounter-step]:not([hidden])')!
            const controls = [...active.querySelectorAll<HTMLElement>('input:not([aria-hidden="true"]):not([type="hidden"]),textarea,button,[role="combobox"]')].filter(n => n.getClientRects().length && getComputedStyle(n).visibility !== "hidden" && !n.closest('[aria-hidden="true"]'))
            return { bounds: box.toJSON(), scroll: document.documentElement.scrollWidth,
              outside: controls.filter(n => { const b = n.getBoundingClientRect(); return b.width > 1 && (b.left < box.left || b.right > box.right + 1) }).map(n => n.id || n.textContent),
              short: controls.filter(n => n.getBoundingClientRect().height < (innerWidth < 1024 ? 44 : 38)).map(n => n.id || n.textContent),
              scrollRegions: [...node.querySelectorAll<HTMLElement>('*')].filter(n => getComputedStyle(n).overflowY === "auto" && n.scrollHeight > n.clientHeight + 2).length }
          })
          expect(result.scroll).toBeLessThanOrEqual(width)
          expect(result.bounds.x).toBeGreaterThanOrEqual(-1)
          expect(result.bounds.right).toBeLessThanOrEqual(width + 1)
          expect(result.outside).toEqual([])
          expect(result.short).toEqual([])
          expect(result.scrollRegions).toBeLessThanOrEqual(1)
          await page.getByRole("button", { name: "Guardar atención", exact: true }).scrollIntoViewIfNeeded()
          await expect(page.getByRole("button", { name: "Guardar atención", exact: true })).toBeInViewport()
          matrix.push({ width, collapsed, name, ...result })
        }
        await page.getByRole("button", { name: "Cerrar registro de atención", exact: true }).click()
        await expect(dialog(page)).toHaveCount(0)
      }
    }
    await page.setViewportSize({ width: 390, height: 420 })
    await open(page)
    await page.getByLabel("Motivo de consulta", { exact: true }).focus()
    await page.getByRole("button", { name: "Guardar atención", exact: true }).scrollIntoViewIfNeeded()
    await expect(page.getByRole("button", { name: "Guardar atención", exact: true })).toBeInViewport()
    expect(await stored(page)).toEqual(before)
    await testInfo.attach("encounter-modal-responsive", { body: JSON.stringify(matrix), contentType: "application/json" })
  })

  test(`touch controls and reduced workspace keep fields reachable in ${theme}`, async ({ browser }) => {
    const context = await browser.newContext({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, reducedMotion: "reduce", timezoneId: "America/Guayaquil" })
    const page = await context.newPage()
    try {
      await login(page, theme)
      await open(page)
      await selectEncounterStep(page, "Examen clínico")
      await openEncounterGroup(page, "intraoral")
      const normal = radio(page, "Oclusión", "Normal")
      await normal.tap()
      await expect(normal).toHaveAttribute("aria-checked", "true")
      expect(await normal.evaluate(node => node.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44)
      for (const viewport of [{ width: 390, height: 420 }, { width: 640, height: 360 }]) {
        // Short keyboard viewport and CSS workspace equivalent to 1280×720 at 200% zoom.
        await page.setViewportSize(viewport)
        await selectEncounterStep(page, "Tratamientos y evolución")
        await openEncounterGroup(page, "evolution")
        const input = page.getByLabel("Observaciones", { exact: true })
        await input.fill("Nota de demostración conservada")
        await input.scrollIntoViewIfNeeded()
        await input.focus()
        await expect(input).toBeInViewport()
        const save = page.getByRole("button", { name: "Guardar atención", exact: true })
        await save.scrollIntoViewIfNeeded()
        await expect(save).toBeInViewport()
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width)
      }
    } finally { await context.close() }
  })
}
