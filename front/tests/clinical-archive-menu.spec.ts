import { expect, test, type Locator, type Page } from "@playwright/test"
import { loginArchive, openArchive, seedArchive } from "./helpers/clinical-archive"

test.use({ timezoneId: "America/Guayaquil", reducedMotion: "reduce" })
const widths = [320, 360, 390, 430, 768, 1024, 1440, 1920]
const trigger = (page: Page) => page.getByRole("button", { name: "Acciones de Imagen de prueba 1", exact: true })
const menu = (page: Page) => page.getByRole("menu", { name: "Acciones de Imagen de prueba 1", exact: true })
const labels = ["Vista previa", "Pantalla completa", "Seleccionar para comparar", "Editar información", "Descargar original", "Archivar archivo"]

async function storedHistory(page: Page) {
  return page.evaluate(async () => { const path = "/src/modules/clinical-history/api/clinical-history.api.ts"; return (await import(path)).clinicalHistoryApi.getRecord("pat_5") })
}
async function assertVisibleMenu(popup: Locator, width: number, height: number) {
  await expect(popup).toBeVisible()
  const result = await popup.evaluate(node => {
    const bounds = node.getBoundingClientRect()
    const items = [...node.querySelectorAll<HTMLElement>('[role="menuitem"]')].map(item => {
      const icon = item.querySelector("svg")!.getBoundingClientRect(), text = item.querySelector("span")!.getBoundingClientRect()
      return { label: item.textContent, height: item.getBoundingClientRect().height, iconWidth: icon.width, iconX: icon.x, textX: text.x, textHeight: text.height, centerOffset: Math.abs(icon.y + icon.height / 2 - text.y - text.height / 2), textOverflow: item.querySelector("span")!.scrollWidth > text.width + 1 }
    })
    return { bounds: bounds.toJSON(), items, pageWidth: document.documentElement.scrollWidth, clipped: Boolean(node.closest("table, article, [data-slot=table-container]")) }
  })
  expect(result.bounds.width).toBeGreaterThanOrEqual(260)
  expect(result.bounds.width).toBeLessThanOrEqual(300)
  expect(result.bounds.x).toBeGreaterThanOrEqual(0)
  expect(result.bounds.right).toBeLessThanOrEqual(width)
  expect(result.bounds.y).toBeGreaterThanOrEqual(0)
  expect(result.bounds.bottom).toBeLessThanOrEqual(height)
  expect(result.pageWidth).toBeLessThanOrEqual(width)
  expect(result.clipped).toBe(false)
  for (const item of result.items) {
    expect(item.height).toBeGreaterThanOrEqual(width < 1024 ? 44 : 40)
    expect(item.iconWidth).toBe(18)
    expect(item.iconX).toBe(result.items[0].iconX)
    expect(item.textX).toBe(result.items[0].textX)
    expect(item.textHeight).toBeLessThanOrEqual(20)
    expect(item.centerOffset).toBeLessThanOrEqual(1)
    expect(item.textOverflow).toBe(false)
  }
  return result
}

for (const theme of ["light", "dark"] as const) {
  test(`file menu fits eight widths with complete labels in gallery and list in ${theme}`, async ({ page }, testInfo) => {
    test.setTimeout(120000)
    const errors: string[] = []; page.on("pageerror", error => errors.push(error.message))
    await loginArchive(page, theme)
    await seedArchive(page)
    await openArchive(page)
    const before = await storedHistory(page), measurements = []
    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 })
      for (const view of ["galería", "lista"]) {
        await page.getByRole("button", { name: `Vista de ${view}`, exact: true }).click()
        await trigger(page).scrollIntoViewIfNeeded()
        const anchor = (await trigger(page).boundingBox())!
        await trigger(page).click()
        const popup = menu(page)
        await expect(popup.getByRole("menuitem")).toHaveText(labels)
        const result = await assertVisibleMenu(popup, width, 900)
        await expect(popup.getByRole("separator")).toHaveCount(1)
        await expect(popup.getByRole("menuitem", { name: "Archivar archivo", exact: true })).toHaveAttribute("data-variant", "destructive")
        const after = (await trigger(page).boundingBox())!
        expect(Math.abs(after.x - anchor.x)).toBeLessThan(1)
        expect(Math.abs(after.y - anchor.y)).toBeLessThan(1)
        await expect(trigger(page)).toHaveAttribute("aria-expanded", "true")
        if ([320, 1440].includes(width)) await popup.screenshot({ path: `test-results/clinical-archive-menu/${theme}-${view}-${width}.png` })
        await page.keyboard.press("Escape")
        await expect(popup).toHaveCount(0)
        await expect(trigger(page)).toBeFocused()
        await expect(trigger(page)).toHaveAttribute("aria-expanded", "false")
        measurements.push({ width, view, ...result })
      }
    }
    expect(await storedHistory(page)).toEqual(before)
    expect(errors).toEqual([])
    await testInfo.attach(`menu-${theme}.json`, { body: JSON.stringify(measurements, null, 2), contentType: "application/json" })
  })
}

test("menu uses the free horizontal space, flips above a low anchor and remains scrollable in a short window", async ({ page }) => {
  await loginArchive(page)
  await seedArchive(page)
  await openArchive(page)
  await page.setViewportSize({ width: 1920, height: 1000 })
  await trigger(page).scrollIntoViewIfNeeded()
  await trigger(page).click()
  const galleryAnchor = (await trigger(page).boundingBox())!, galleryPopup = (await menu(page).boundingBox())!
  expect(galleryPopup.x).toBeGreaterThanOrEqual(galleryAnchor.x - 1)
  await page.keyboard.press("Escape")
  await page.getByRole("button", { name: "Vista de lista", exact: true }).click()
  await trigger(page).click()
  const tableAnchor = (await trigger(page).boundingBox())!, tablePopup = (await menu(page).boundingBox())!
  expect(tablePopup.x).toBeLessThan(tableAnchor.x)
  expect(tablePopup.x + tablePopup.width).toBeLessThanOrEqual(1920)
  await page.keyboard.press("Escape")
  await trigger(page).evaluate(node => node.scrollIntoView({ block: "end" }))
  await trigger(page).click()
  await expect(menu(page)).toHaveAttribute("data-side", "top")
  await assertVisibleMenu(menu(page), 1920, 1000)
  await page.keyboard.press("Escape")
  await page.setViewportSize({ width: 390, height: 330 })
  await trigger(page).click()
  await expect(menu(page)).toBeVisible()
  const last = menu(page).getByRole("menuitem", { name: "Archivar archivo", exact: true })
  await last.scrollIntoViewIfNeeded()
  await expect(last).toBeInViewport()
  const bounds = (await menu(page).boundingBox())!
  expect(bounds.x).toBeGreaterThanOrEqual(0)
  expect(bounds.y).toBeGreaterThanOrEqual(0)
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(390)
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(330)
  await page.mouse.click(2, 2)
  await expect(menu(page)).toHaveCount(0)
})

test("composed trigger keeps tooltip, keyboard activation, focus and reduced motion", async ({ page }) => {
  await loginArchive(page, "light")
  await seedArchive(page, 1)
  await openArchive(page)
  const button = trigger(page)
  await button.hover()
  await expect(page.locator('[data-slot="tooltip-content"]').filter({ hasText: "Acciones del archivo" })).toBeVisible()
  await button.focus()
  await page.keyboard.press("Enter")
  await expect(menu(page)).toBeVisible()
  await expect(menu(page)).toHaveCSS("animation-name", "none")
  expect(await button.evaluate(node => node.querySelectorAll("button").length)).toBe(0)
  await page.keyboard.press("Escape")
  await expect(button).toBeFocused()
  await page.emulateMedia({ reducedMotion: "no-preference" })
  await button.click()
  await expect(menu(page)).toBeVisible()
  await expect(menu(page)).toHaveCSS("animation-duration", "0.15s")
  await expect.poll(() => menu(page).evaluate(node => node.getAnimations().filter(animation => animation.playState === "running").length)).toBe(0)
  await page.keyboard.press("Escape")
  await expect(menu(page)).toHaveCount(0)
  await expect(button).toBeFocused()
})
