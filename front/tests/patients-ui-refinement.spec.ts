import { setAccessTheme } from "./helpers/access-theme"
import { expect, test, type Page } from "@playwright/test"

test.use({ timezoneId: "America/Guayaquil" })
const widths = [320, 375, 390, 430, 768, 1024, 1280, 1440, 1920]
async function login(page: Page, theme: string, role = "admin") {
  await page.goto("/login")
  await setAccessTheme(page, theme === "light" ? "light" : "dark")
  await page.locator("#email").fill(`${role}@clinica.com`)
  await page.locator("#password").fill(`${role}123`)
  await page.getByRole("button", { name: "Ingresar", exact: true }).click()
  await page.getByRole("button", { name: "Continuar", exact: true }).click()
  await expect(page).toHaveURL(/\/$/)
}

async function selectTab(page: Page, name: string) {
  await expect(page.locator(".patient-detail-tabs")).toBeVisible()
  // Let fonts, container queries and AdaptiveTabs' ResizeObserver settle after resizing.
  await page.evaluate(async () => {
    await document.fonts.ready
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
  })
  const tab = page.getByRole("tab", { name, exact: true })
  const directlyVisible = await tab.count() > 0 && await tab.evaluate(node => !node.classList.contains("sr-only"))
  if (directlyVisible) await tab.click()
  else {
    await page.getByRole("button", { name: /^Más pestañas/ }).click()
    const item = page.getByRole("menuitemradio", { name, exact: true })
    await expect.poll(async () => await item.isVisible() || await tab.count() > 0 && await tab.evaluate(node => !node.classList.contains("sr-only"))).toBe(true)
    if (await item.isVisible()) await item.click()
    else { await page.keyboard.press("Escape"); await tab.click() }
  }
  await expect(page.getByRole("tabpanel")).toBeVisible()
  await expect(page.getByRole("menu", { name: /^Más pestañas/ })).not.toBeVisible()
}

for (const theme of ["light", "dark"]) {
  test(`patient profile tabs and genuine financial movements fit all viewports in ${theme}`, async ({ page }, testInfo) => {
    const errors: string[] = []
    page.on("pageerror", error => errors.push(error.message))
    await login(page, theme)
    await page.goto("/pacientes/pat_5")
    const before = await page.evaluate(async () => {
      const paths = ["/src/modules/patients/api/patients.api.ts", "/src/modules/finance/api/finance.api.ts", "/src/modules/clinical-history/api/clinical-history.api.ts"]
      const [{ patientsApi }, { financeApi }, { clinicalHistoryApi }] = await Promise.all(paths.map(path => import(path)))
      // Persist this empty history fixture first: the existing API creates fresh
      // timestamps on every read of an unsaved revision-zero history.
      const initialHistory = await clinicalHistoryApi.getRecord("pat_5")
      await clinicalHistoryApi.saveRecord(initialHistory.record)
      return { patient: await patientsApi.get("pat_5"), finance: await financeApi.getPatientSummary("pat_5"), history: await clinicalHistoryApi.getRecord("pat_5"), treatment: await financeApi.getTreatmentSummary("trt_4", "pat_5") }
    })
    await expect(page.locator(".patient-information-grid").getByText("No registrado", { exact: true }).first()).toBeVisible()
    await page.getByRole("button", { name: "Editar información de contacto", exact: true }).click()
    await expect(page).toHaveURL(/\/pacientes\/pat_5$/)
    await expect(page.getByRole("dialog", { name: "Editar paciente", exact: true })).toBeVisible()
    await expect(page.locator("#patient-section-contact [data-patient-section-trigger]")).toHaveAttribute("aria-expanded", "true")
    await expect(page.locator("#email")).toHaveValue(before.patient.email)
    await page.getByRole("button", { name: "Cancelar", exact: true }).click()
    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 })
      for (const name of ["Citas", "Historial clínico", "Tratamientos", "Finanzas", "Archivo clínico", "Resumen"]) {
        await selectTab(page, name)
        const panel = page.getByRole("tabpanel")
        await expect(panel.locator('[data-slot="skeleton"]')).toHaveCount(0)
        if (name === "Finanzas") {
          const values = panel.locator(".patient-financial-summary dd")
          const actual = await page.evaluate(async value => { const path = "/src/shared/lib/number.ts"; const { formatCurrency } = await import(path); return formatCurrency(value) }, before.finance.totalPaid)
          await expect(values.nth(1)).toHaveText(actual)
          // This patient has no assignments in the existing source. Do not infer
          // a financial total from an unlinked mock payment or invent a movement.
          await expect(panel).toContainText("Sin movimientos asociados")
          await expect(panel.locator(".patient-ledger")).toHaveCount(0)
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
        const outside = await panel.locator("button").evaluateAll(nodes => nodes.filter(node => node.getClientRects().length && getComputedStyle(node).visibility !== "hidden").filter(node => { const box = node.getBoundingClientRect(); return box.x < -1 || box.right > innerWidth + 1 }).map(node => node.textContent))
        expect(outside).toEqual([])
        if ([375, 1440].includes(width)) await page.screenshot({ path: `test-results/patients-ui-refinement/after/tab-${name}-${theme}-${width}.png` })
      }
    }
    const after = await page.evaluate(async () => {
      const paths = ["/src/modules/patients/api/patients.api.ts", "/src/modules/finance/api/finance.api.ts", "/src/modules/clinical-history/api/clinical-history.api.ts"]
      const [{ patientsApi }, { financeApi }, { clinicalHistoryApi }] = await Promise.all(paths.map(path => import(path)))
      return { patient: await patientsApi.get("pat_5"), finance: await financeApi.getPatientSummary("pat_5"), history: await clinicalHistoryApi.getRecord("pat_5"), treatment: await financeApi.getTreatmentSummary("trt_4", "pat_5") }
    })
    expect(after).toEqual(before)
    await page.goto("/pacientes/pat_4")
    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 })
      await selectTab(page, "Finanzas")
      const panel = page.getByRole("tabpanel")
      const details = panel.locator(".patient-ledger").first()
      await expect(details).toBeVisible()
      if (!await details.evaluate((node: HTMLDetailsElement) => node.open)) await details.locator("summary").click()
      await expect(details).toContainText("TC-8791")
      await expect(details).toContainText("Parcial")
      await expect(details).toContainText("001-001-000123")
      await expect(details).toContainText("Autorizada")
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
      if ([375, 1440].includes(width)) await page.screenshot({ path: `test-results/patients-ui-refinement/after/finances-${theme}-${width}.png` })
    }
    expect(errors).toEqual([])
    await testInfo.attach("unchanged-data", { body: JSON.stringify({ before, after }), contentType: "application/json" })
  })

  test(`patient forms use natural page scrolling and a wide responsive layout in ${theme}`, async ({ page }) => {
    await login(page, theme)
    for (const route of ["/pacientes/nuevo", "/pacientes/pat_5/editar"]) {
      await page.goto(route)
      await expect(page.locator("#firstName")).toBeVisible()
      for (const width of widths) {
        await page.setViewportSize({ width, height: 900 })
        for (const name of ["contact", "emergency", "preferences"]) {
          const trigger = page.locator(`#patient-section-${name} [data-patient-section-trigger]`)
          if (await trigger.getAttribute("aria-expanded") !== "true") await trigger.click()
          await expect(trigger).toHaveAttribute("aria-expanded", "true")
          await expect.poll(() => page.locator(`#patient-section-${name} .patient-section-panel`).evaluate(node => node.getAnimations().filter(animation => animation.playState === "running").length)).toBe(0)
        }
        expect(await page.locator(".patient-form-sections").evaluate(node => getComputedStyle(node).overflowY)).toBe("visible")
        expect(await page.locator(".patient-editor").evaluate(node => node.getBoundingClientRect().width)).toBeLessThanOrEqual(1280)
        if (width === 1920) await expect(page.locator(".patient-editor")).toHaveCSS("width", "1280px")
        const main = page.locator("main")
        await main.evaluate(node => node.scrollTop = 0)
        await page.locator("#notes").focus()
        await expect(page.locator('[data-patient-section-trigger][aria-expanded="true"]')).toHaveCount(1)
        const notes = (await page.locator("#notes").boundingBox())!
        const footer = (await page.locator(".patient-form-footer").boundingBox())!
        expect(notes.y + notes.height).toBeLessThanOrEqual(footer.y + 1)
        await expect(page.locator(".patient-form-footer")).toHaveCSS("position", "static")
        await page.locator(".patient-form-footer button").last().scrollIntoViewIfNeeded()
        const visibleFooter = (await page.locator(".patient-form-footer").boundingBox())!
        expect(visibleFooter.y + visibleFooter.height).toBeLessThanOrEqual(901)
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
      }
    }
    await page.goto("/pacientes/pat_5/editar?seccion=emergency")
    await expect(page.locator("#patient-section-emergency [data-patient-section-trigger]")).toHaveAttribute("aria-expanded", "true")
    await expect(page.locator("#patient-section-emergency [data-patient-section-trigger]")).toBeFocused()
    await expect(page.locator("#emergencyContactName")).toHaveValue("Ricardo Suárez")
  })

  test(`shared patient menus fit every viewport, use one line and keep portal, Escape and focus behavior in ${theme}`, async ({ page }, testInfo) => {
    await login(page, theme)
    const measurements = []
    for (const route of ["/pacientes", "/pacientes/pat_5"]) {
      await page.goto(route)
      for (const width of widths) {
        await page.setViewportSize({ width, height: 900 })
        const trigger = page.getByRole("button", { name: "Acciones del paciente Valentina Suárez", exact: true })
        await trigger.click()
        const menu = page.getByRole("menu", { name: "Acciones del paciente Valentina Suárez", exact: true })
        await expect(menu).toBeVisible()
        await expect(menu).toHaveCSS("width", "280px")
        // La ficha suma "Dar de baja" (admin y recepción); la lista no.
        await expect(menu.getByRole("menuitem")).toHaveCount(route === "/pacientes" ? 5 : 6)
        await expect(menu.getByRole("separator")).toHaveCount(1)
        expect(await menu.evaluate(node => !!node.closest('[data-slot="table-container"], article, .patient-information-card'))).toBe(false)
        for (const item of await menu.getByRole("menuitem").all()) {
          await expect(item).toHaveCSS("min-height", "44px")
          await expect(item.locator("svg")).toHaveCSS("width", "20px")
          await expect(item.locator("span")).toHaveCSS("white-space", "nowrap")
          expect(await item.locator("span").evaluate(node => node.scrollWidth > node.clientWidth + 1 || node.scrollHeight > 24)).toBe(false)
        }
        const box = (await menu.boundingBox())!
        expect(box.x).toBeGreaterThanOrEqual(-1)
        expect(box.x + box.width).toBeLessThanOrEqual(width + 1)
        expect(box.y).toBeGreaterThanOrEqual(-1)
        expect(box.y + box.height).toBeLessThanOrEqual(901)
        await page.keyboard.press("ArrowDown")
        await page.keyboard.press("Escape")
        await expect(menu).not.toBeVisible()
        await expect(trigger).toBeFocused()
        await trigger.click()
        await page.mouse.click(width / 2, 3)
        await expect(menu).not.toBeVisible()
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
        measurements.push({ route, width, box })
      }
    }
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.goto("/pacientes")
    await page.getByRole("button", { name: "Acciones del paciente María González", exact: true }).click()
    await page.getByRole("button", { name: "Acciones del paciente Valentina Suárez", exact: true }).click()
    await expect(page.locator('.patient-action-menu[data-open]')).toHaveCount(1)
    await expect(page.getByRole("menu", { name: "Acciones del paciente Valentina Suárez", exact: true })).toBeVisible()
    await page.keyboard.press("Escape")
    await page.setViewportSize({ width: 1440, height: 390 })
    await page.getByRole("button", { name: "Acciones del paciente Valentina Suárez", exact: true }).click()
    const box = (await page.getByRole("menu", { name: "Acciones del paciente Valentina Suárez", exact: true }).boundingBox())!
    expect(box.y).toBeGreaterThanOrEqual(-1)
    expect(box.y + box.height).toBeLessThanOrEqual(391)
    await testInfo.attach("shared-menu-matrix", { body: JSON.stringify(measurements, null, 2), contentType: "application/json" })
  })
}

test("patient documents preserve stored bytes, real metadata and separate consent states", async ({ page }) => {
  await login(page, "dark")
  await page.goto("/pacientes/pat_5")
  await page.evaluate(async () => {
    const apiPath = "/src/modules/clinical-history/api/clinical-history.api.ts", clientPath = "/src/shared/lib/query-client.ts"
    const [{ clinicalHistoryApi }, { queryClient }] = await Promise.all([import(apiPath), import(clientPath)])
    const history = await clinicalHistoryApi.getRecord("pat_5")
    const file = new File(["%PDF-1.4\nPatient document bytes\n%%EOF"], "consent-test.pdf", { type: "application/pdf" })
    const metadata = await clinicalHistoryApi.uploadAttachment({ patientId: "pat_5", kind: "consentimiento", file })
    await clinicalHistoryApi.saveRecord({ ...history.record, attachments: [...history.record.attachments, metadata] })
    await queryClient.invalidateQueries({ queryKey: ["clinical-history"] })
  })
  await selectTab(page, "Archivo clínico")
  const file = page.locator("[data-file-id]")
  await expect(file).toContainText("consent-test.pdf")
  await expect(file).toContainText("Consentimiento")
  await expect(file).not.toContainText("Firmado")
  await expect(page.getByRole("tabpanel")).toContainText("Pendiente")
  const download = page.waitForEvent("download")
  await page.getByRole("button", { name: "Acciones de consent-test.pdf", exact: true }).click()
  await page.getByRole("menuitem", { name: "Descargar original", exact: true }).click()
  const downloaded = await download
  expect(downloaded.suggestedFilename()).toBe("consent-test.pdf")
  const stream = await downloaded.createReadStream()
  const chunks = []
  for await (const chunk of stream!) chunks.push(chunk)
  expect(Buffer.concat(chunks).toString()).toBe("%PDF-1.4\nPatient document bytes\n%%EOF")
  await page.reload()
  await selectTab(page, "Archivo clínico")
  await expect(file).toContainText("consent-test.pdf")
})

for (const role of ["medico", "recepcion"]) {
  test(`financial detail respects existing role boundaries for ${role}`, async ({ page }) => {
    await login(page, "dark", role)
    await page.goto("/pacientes/pat_5")
    await selectTab(page, "Finanzas")
    await expect(page.locator(".patient-financial-summary dd")).toHaveCount(4)
    await expect(page.getByRole("button", { name: "Ver cartera financiera", exact: true })).toHaveCount(role === "recepcion" ? 1 : 0)
    await expect(page.locator(".patient-movements")).toHaveCount(role === "recepcion" ? 1 : 0)
    await selectTab(page, "Tratamientos")
    if (role === "recepcion") {
      const keys = await page.evaluate(async () => { const path = "/src/shared/lib/query-client.ts"; const { queryClient } = await import(path); return queryClient.getQueryCache().getAll().map((item: { queryKey: unknown }) => item.queryKey) })
      // The existing last-visit hook registers a disabled query with an empty id.
      // A reception user must never load/register the patient's clinical query.
      expect(keys.some((key: unknown[]) => key[0] === "clinical-history" && key.includes("pat_5"))).toBe(false)
    }
  })
}
