import { expect, test, type Page } from "@playwright/test"
import { clinicalNavigation, expectRecordSection, selectRecordSection } from "./helpers/clinical-navigation"

const names = [
  "Datos del paciente", "Antecedentes", "Odontograma y periodontograma", "Plan de tratamiento",
  "Consentimiento y declaración", "Fotos y documentos", "Atenciones", "Tratamientos", "Citas", "Evolución periodontal",
]
const widths = [320, 360, 375, 390, 430, 600, 768, 1024, 1280, 1440, 1920]
const editorOf = (page: Page) => page.frameLocator('iframe[title="Odontograma y periodontograma del paciente"]')
const pending = (page: Page) => page.getByRole("region", { name: "Cambios sin guardar", exact: true })
const previous = (page: Page) => page.getByRole("button", { name: "Anterior", exact: true, includeHidden: true })
const next = (page: Page) => page.getByRole("button", { name: "Siguiente", exact: true, includeHidden: true })

async function login(page: Page, theme: "light" | "dark", patient = "pat_5", role = "admin") {
  await page.goto("/login")
  await page.getByRole("button", { name: theme === "dark" ? "Tema oscuro" : "Tema claro", exact: true }).click()
  await page.locator("#email").fill(`${role}@clinica.com`)
  await page.locator("#password").fill(`${role}123`)
  await page.getByRole("button", { name: "Ingresar", exact: true }).click()
  await page.getByRole("button", { name: "Continuar", exact: true }).click()
  await expect(page).toHaveURL(/\/$/)
  await page.goto(`/historial-clinico/paciente/${patient}`)
  await expect(editorOf(page).locator("#toothGrid")).toBeVisible()
  await expect(page.getByRole("button", { name: "Registrar atención", exact: true })).toBeEnabled()
}

async function fits(page: Page) {
  return page.evaluate(() => {
    const visible = (node: Element) => node.getClientRects().length && getComputedStyle(node).visibility !== "hidden"
    const nodes = [...document.querySelectorAll<HTMLElement>('[data-slot="clinical-navigation"] button, [data-slot="clinical-navigation-footer"] button, [data-slot="dropdown-menu-content"]')].filter(visible)
    return {
      overflow: document.documentElement.scrollWidth > innerWidth,
      outside: nodes.filter((node) => {
        const rect = node.getBoundingClientRect()
        return rect.left < -1 || rect.right > innerWidth + 1 || node.scrollWidth > node.clientWidth + 2
      }).map((node) => node.textContent?.trim()),
      shortTargets: nodes.filter((node) => node.matches("button") && node.getBoundingClientRect().height < (innerWidth < 1024 || matchMedia("(pointer: coarse)").matches ? 44 : 36)).map((node) => node.textContent?.trim()),
    }
  })
}

async function storedHistory(page: Page) {
  return page.evaluate(() => new Promise<unknown>((resolve, reject) => {
    const request = indexedDB.open("clinicapp-dental-v1", 1)
    request.onsuccess = () => {
      const db = request.result
      const record = db.transaction("records").objectStore("records").get("pat_5")
      record.onsuccess = () => { resolve(record.result ?? null); db.close() }
      record.onerror = () => { reject(record.error); db.close() }
    }
    request.onerror = () => reject(request.error)
  }))
}

async function contrastFailures(page: Page) {
  return page.evaluate(() => {
    const canvas = document.createElement("canvas").getContext("2d")!
    const luminance = (color: number[]) => {
      const linear = color.map((channel) => channel / 255).map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
      return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722
    }
    return [...document.querySelectorAll<HTMLElement>('[data-slot="clinical-navigation"] button, [data-slot="clinical-navigation"] h2, [data-slot="clinical-navigation"] p, [role="menuitemradio"]')]
      .filter((node) => node.getClientRects().length)
      .map((node) => {
        canvas.fillStyle = "white"
        canvas.fillRect(0, 0, 1, 1)
        const ancestors: HTMLElement[] = []
        for (let current: HTMLElement | null = node; current; current = current.parentElement) ancestors.unshift(current)
        for (const current of ancestors) { canvas.fillStyle = getComputedStyle(current).backgroundColor; canvas.fillRect(0, 0, 1, 1) }
        const background = [...canvas.getImageData(0, 0, 1, 1).data].slice(0, 3)
        canvas.fillStyle = getComputedStyle(node).color
        canvas.fillRect(0, 0, 1, 1)
        const foreground = [...canvas.getImageData(0, 0, 1, 1).data].slice(0, 3)
        const [higher, lower] = [luminance(background), luminance(foreground)].sort((a, b) => b - a)
        return { name: node.textContent?.trim(), ratio: (higher + 0.05) / (lower + 0.05) }
      }).filter((result) => result.ratio < 4.5)
  })
}

for (const theme of ["light", "dark"] as const) {
  test(`real clinical sections allow direct access and omit unavailable directions in ${theme}`, async ({ page }) => {
    await login(page, theme)
    await expectRecordSection(page, names[2])
    await clinicalNavigation(page).getByRole("button", { name: "Ver secciones", exact: true }).click()
    for (let index = 0; index < names.length; index++) await expect(page.getByRole("menuitemradio").nth(index)).toHaveAccessibleName(index < 9 ? `${index + 1}. ${names[index]}` : names[index])
    await expect(page.getByRole("menuitemradio", { checked: true })).toHaveAccessibleName(`3. ${names[2]}`)
    await page.keyboard.press("Escape")
    await selectRecordSection(page, names[0])
    await expect(previous(page)).toHaveCount(0)
    await expect(next(page)).toHaveCount(1)
    await next(page).click()
    await expectRecordSection(page, names[1])
    await previous(page).click()
    await expectRecordSection(page, names[0])
    await selectRecordSection(page, names[1])
    await selectRecordSection(page, names[8])
    await selectRecordSection(page, names[3])
    await selectRecordSection(page, names[4])
    await expect(previous(page)).toHaveCount(1)
    await expect(next(page)).toHaveCount(1)
    await selectRecordSection(page, names[8])
    await expect(previous(page)).toHaveCount(1)
    await expect(next(page)).toHaveCount(0)
    await expect(clinicalNavigation(page)).toContainText("Sección 9 de 9")
    await selectRecordSection(page, names[9])
    await expect(previous(page)).toHaveCount(0)
    await expect(next(page)).toHaveCount(0)
    await expect(clinicalNavigation(page)).toContainText("Sección adicional")
    await selectRecordSection(page, names[0])
    await expect(pending(page)).toHaveCount(0)
    await expect(page.getByRole("progressbar")).toHaveCount(0)
    await expect(page.locator("iframe")).toHaveCount(1)
    await expect(clinicalNavigation(page)).not.toContainText(/Paso|Guardar|completad/i)
    await expect(clinicalNavigation(page)).toHaveCSS("background-color", theme === "light" ? "rgb(255, 255, 255)" : "rgb(15, 16, 17)")
    await page.getByRole("switch", { name: "Modo oscuro", exact: true }).click()
    await expectRecordSection(page, names[0])
    await expect(clinicalNavigation(page)).toHaveCSS("background-color", theme === "light" ? "rgb(15, 16, 17)" : "rgb(255, 255, 255)")
  })

  test(`clinical navigation fits all widths with one control group, full sections and open menu in ${theme}`, async ({ page }, testInfo) => {
    await login(page, theme, "pat_1")
    const measured = []
    for (const width of widths) {
      await page.setViewportSize({ width, height: 1000 })
      await clinicalNavigation(page).getByRole("button", { name: "Ver secciones", exact: true }).click()
      await expect.poll(() => fits(page)).toEqual({ overflow: false, outside: [], shortTargets: [] })
      const menu = await page.getByRole("menu").boundingBox()
      expect(menu!.y).toBeGreaterThanOrEqual(0)
      expect(menu!.y + menu!.height).toBeLessThanOrEqual(1001)
      await expect(page.getByRole("menuitemradio")).toHaveCount(names.length)
      if (width === 1440) expect(await contrastFailures(page)).toEqual([])
      if ([390, 1440].includes(width)) await page.screenshot({ path: `test-results/clinical-navigation-dynamic/${theme}-${width}.png` })
      await page.keyboard.press("Escape")
      const contentWidth = await clinicalNavigation(page).evaluate((node) => node.parentElement!.clientWidth)
      await expect(page.locator('[data-slot="clinical-navigation-footer"]')).toHaveCount(contentWidth < 896 ? 1 : 0)
      await expect(page.getByRole("group", { name: "Navegación entre secciones", includeHidden: true })).toHaveCount(1)
      await expect(previous(page)).toHaveCount(1)
      await expect(next(page)).toHaveCount(1)
      await expect(page.getByRole("complementary")).toHaveCount(width < 1024 ? 0 : 1)
      const lastSummary = page.locator('[data-slot="card"]').filter({ has: page.getByText("Sangrado al sondaje", { exact: true }) })
      const summaryBounds = await lastSummary.boundingBox()
      expect((await clinicalNavigation(page).boundingBox())!.y).toBeGreaterThanOrEqual(summaryBounds!.y + summaryBounds!.height)
      measured.push({ width, contentWidth, ...(await fits(page)) })
    }
    for (const width of [320, 1024]) {
      await page.setViewportSize({ width, height: 1000 })
      for (const name of names) {
        await selectRecordSection(page, name)
        await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
        await expect(page.locator("iframe")).toHaveCount(1)
      }
    }
    await selectRecordSection(page, names[6])
    await page.setViewportSize({ width: 1024, height: 800 })
    await expect(page.locator('[data-slot="clinical-navigation-footer"]')).toHaveCount(1)
    await page.getByRole("button", { name: "Cerrar menú", exact: true }).click()
    await expect(page.locator(".clinic-app-sidebar")).toHaveCSS("width", "72px")
    await expect(page.locator('[data-slot="clinical-navigation-footer"]')).toHaveCount(0)
    await page.getByRole("button", { name: "Abrir menú", exact: true }).click()
    await expect(page.locator(".clinic-app-sidebar")).toHaveCSS("width", "256px")
    await expect(page.locator('[data-slot="clinical-navigation-footer"]')).toHaveCount(1)
    await clinicalNavigation(page).getByRole("button", { name: "Ver secciones", exact: true }).click()
    for (const size of [{ width: 768, height: 1024 }, { width: 1024, height: 768 }, { width: 844, height: 390 }, { width: 375, height: 420 }]) {
      await page.setViewportSize(size)
      await expect(page.getByRole("menu")).toBeVisible()
      await expect.poll(() => fits(page)).toEqual({ overflow: false, outside: [], shortTargets: [] })
      await expect.poll(async () => {
        const bounds = await page.getByRole("menu").boundingBox()
        return Boolean(bounds && bounds.y >= 0 && bounds.y + bounds.height <= size.height + 1)
      }).toBe(true)
      const menu = await page.getByRole("menu").boundingBox()
      expect(menu!.y).toBeGreaterThanOrEqual(0)
      expect(menu!.y + menu!.height).toBeLessThanOrEqual(size.height + 1)
      await expect(page.getByRole("menuitemradio", { checked: true })).toHaveAccessibleName(`7. ${names[6]}`)
    }
    await page.keyboard.press("Escape")
    await expectRecordSection(page, names[6])
    await testInfo.attach("clinical-navigation-responsive", { body: JSON.stringify(measured, null, 2), contentType: "application/json" })
  })

  test(`existing save remains independent and navigation retains patient and chart edits in ${theme}`, async ({ page }) => {
    await login(page, theme)
    await selectRecordSection(page, names[0])
    await page.getByLabel("Ocupación", { exact: true }).fill("Docente independiente")
    await pending(page).getByRole("button", { name: "Guardar cambios", exact: true }).click()
    await expect(page.getByRole("alertdialog")).toContainText("Se guardarán los cambios en Datos del paciente.")
    await page.getByRole("alertdialog").getByRole("button", { name: "Guardar cambios", exact: true }).click()
    await expect(pending(page)).toHaveCount(0)
    await expectRecordSection(page, names[0])
    const originalStored = await storedHistory(page)
    const frame = page.frames().find((candidate) => candidate.url().includes("odontogram.html"))!
    await page.getByLabel("Ocupación", { exact: true }).fill("Docente con cambios")
    await next(page).click()
    await expectRecordSection(page, names[1])
    await selectRecordSection(page, names[2])
    const editor = editorOf(page)
    await editor.getByRole("option", { name: "16", exact: true }).click()
    await editor.locator("#calculusRow label").click()
    await expect(editor.locator("#calculusToggle")).toBeChecked()
    const teeth = await editor.locator("#toothGrid").evaluate(() => JSON.stringify(window.clinicChart!.snapshot().payload.teeth))
    await selectRecordSection(page, names[8])
    await selectRecordSection(page, names[3])
    await page.setViewportSize({ width: 320, height: 900 })
    await selectRecordSection(page, names[2])
    expect(page.frames()).toContain(frame)
    expect(await editor.locator("#toothGrid").evaluate(() => JSON.stringify(window.clinicChart!.snapshot().payload.teeth))).toBe(teeth)
    await selectRecordSection(page, names[0])
    await expect(page.getByLabel("Ocupación", { exact: true })).toHaveValue("Docente con cambios")
    expect(await storedHistory(page)).toEqual(originalStored)
    await expect(pending(page)).toBeVisible()
    await next(page).click()
    await previous(page).click()
    await expectRecordSection(page, names[0])
    await page.getByRole("button", { name: "Volver al paciente", exact: true }).click()
    await expect(page.getByRole("alertdialog")).toContainText("Tienes cambios sin guardar")
    await page.getByRole("alertdialog").getByRole("button", { name: "Seguir editando", exact: true }).click()
    await pending(page).getByRole("button", { name: "Guardar cambios", exact: true }).click()
    await expect(page.getByRole("alertdialog")).toContainText("Datos del paciente")
    await expect(page.getByRole("alertdialog")).toContainText("Odontograma y periodontograma")
    await page.getByRole("alertdialog").getByRole("button", { name: "Guardar cambios", exact: true }).click()
    await expect(pending(page)).toHaveCount(0)
    await expectRecordSection(page, names[0])
    expect(await storedHistory(page)).not.toEqual(originalStored)
    await page.getByRole("button", { name: "Volver al paciente", exact: true }).click()
    await expect(page).toHaveURL(/\/pacientes\/pat_5$/)
    await expect(page.getByText("Docente con cambios", { exact: true })).toBeVisible()
  })

  test(`physician can navigate directly with touch controls in ${theme}`, async ({ browser }) => {
    const context = await browser.newContext({ baseURL: process.env.CLINIC_TEST_URL || "http://127.0.0.1:5175", viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
    try {
      const page = await context.newPage()
      await login(page, theme, "pat_5", "medico")
      await clinicalNavigation(page).getByRole("button", { name: "Ver secciones", exact: true }).tap()
      await expect(page.getByRole("menuitemradio")).toHaveCount(10)
      await page.getByRole("menuitemradio").nth(7).tap()
      await expectRecordSection(page, names[7])
      await next(page).tap()
      await expectRecordSection(page, names[8])
      await expect(next(page)).toHaveCount(0)
      await expect(previous(page)).toHaveCount(1)
      await expect(pending(page)).toHaveCount(0)
      await expect.poll(() => fits(page)).toEqual({ overflow: false, outside: [], shortTargets: [] })
    } finally {
      await context.close()
    }
  })
}
