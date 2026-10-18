import { expect, test, type Page } from "@playwright/test"

const frameOf = (page: Page) => page.frameLocator('iframe[title="Odontograma y periodontograma del paciente"]')

async function login(page: Page) {
  await page.goto("/login")
  await page.getByLabel("Correo electrónico").fill("admin@clinica.com")
  await page.locator("#password").fill("admin123")
  await page.getByRole("button", { name: "Ingresar", exact: true }).click()
  await page.getByRole("button", { name: "Continuar", exact: true }).click()
}

test("matriz periodontal adapta la columna descriptiva sin cambiar piezas ni mediciones", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 })
  await login(page)
  await page.goto("/historial-clinico/paciente/pat_5")
  await page.getByRole("button", { name: "Nueva visita", exact: true }).click()
  await page.getByLabel("Profesional", { exact: true }).click()
  await page.getByRole("option", { name: /Dra\. Carla Ríos/ }).click()
  await page.getByRole("dialog").getByRole("button", { name: "Iniciar visita" }).click()

  const editor = frameOf(page)
  await expect(editor.locator("#toothGrid")).toBeVisible()
  await editor.locator("#appViewDentalChart").click()
  const matrix = editor.locator(".perio-fullgrid-scroll")
  await expect(matrix).toBeVisible()

  const target = editor.locator('input[data-perio="16:MB:pd"]')
  await target.fill("5")
  await target.press("Tab")
  await expect(target).toHaveValue("5")
  await expect(page.getByRole("status").filter({ hasText: "Borrador guardado" })).toBeVisible()

  const original = await editor.locator(".perio-fullgrid-scroll").evaluate((node) => {
    const payload = window.clinicChart!.snapshot().payload
    return {
      teeth: [...node.querySelectorAll<HTMLElement>("[data-perio-tooth-header]")].map((header) => header.dataset.perioToothHeader),
      pd: payload.teeth["16"].perio.pd.MB,
      serialized: JSON.stringify(payload),
    }
  })
  expect(original.teeth).toEqual([
    "18", "17", "16", "15", "14", "13", "12", "11",
    "21", "22", "23", "24", "25", "26", "27", "28",
    "48", "47", "46", "45", "44", "43", "42", "41",
    "31", "32", "33", "34", "35", "36", "37", "38",
  ])
  expect(original.pd).toBe(5)

  for (const width of [320, 375, 390, 430, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 })
    const geometry = await editor.locator(".perio-fullgrid-scroll").evaluate((node) => {
      const chart = node.closest<HTMLElement>(".chart")!
      const arch = node.querySelector<HTMLElement>(".perio-fullgrid-arch")!
      const label = node.querySelector<HTMLElement>(".perio-fullgrid-row-label")!
      const tooth = node.querySelector<HTMLElement>("[data-perio-tooth-header]")!
      const columns = getComputedStyle(arch).gridTemplateColumns.split(" ")
      const payload = window.clinicChart!.snapshot().payload
      return {
        pageWidth: document.documentElement.scrollWidth,
        viewportWidth: innerWidth,
        iframeWidth: Math.round(chart.getBoundingClientRect().width),
        matrixWidth: node.clientWidth,
        matrixScrollWidth: node.scrollWidth,
        labelWidth: Math.round(label.getBoundingClientRect().width),
        toothWidth: Math.round(tooth.getBoundingClientRect().width),
        firstTracks: columns.slice(0, 3),
        toothHeaders: [...node.querySelectorAll<HTMLElement>("[data-perio-tooth-header]")].map((header) => header.dataset.perioToothHeader),
        pd: payload.teeth["16"].perio.pd.MB,
        serialized: JSON.stringify(payload),
      }
    })
    const outerPage = await page.evaluate(() => ({
      width: document.documentElement.scrollWidth,
      viewport: window.innerWidth,
    }))
    expect(outerPage.width).toBeLessThanOrEqual(outerPage.viewport)
    expect(geometry.pageWidth).toBeLessThanOrEqual(geometry.viewportWidth)
    expect(geometry.matrixScrollWidth).toBeGreaterThan(geometry.matrixWidth)
    expect(geometry.toothWidth).toBeGreaterThanOrEqual(46)
    expect(geometry.toothHeaders).toEqual(original.teeth)
    expect(geometry.pd).toBe(original.pd)
    expect(geometry.serialized).toBe(original.serialized)
    if (geometry.iframeWidth <= 220) {
      expect(geometry.labelWidth).toBe(38)
      expect(geometry.firstTracks).toEqual(["38px", "46px", "46px"])
    } else if (geometry.iframeWidth <= 480) {
      expect(geometry.labelWidth).toBe(88)
      expect(geometry.firstTracks).toEqual(["88px", "46px", "46px"])
    } else {
      expect(geometry.labelWidth).toBe(220)
    }
  }
})
