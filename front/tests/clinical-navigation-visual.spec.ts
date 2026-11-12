import { expect, test, type Page } from "@playwright/test"
import { clinicalNavigation } from "./helpers/clinical-navigation"

test.describe.configure({ mode: "parallel" })
const previous = (page: Page) => page.getByRole("button", { name: "Anterior", exact: true })
const next = (page: Page) => page.getByRole("button", { name: "Siguiente", exact: true })

async function login(page: Page, theme: "light" | "dark") {
  await page.goto("/login")
  await page.getByRole("button", { name: theme === "dark" ? "Tema oscuro" : "Tema claro", exact: true }).click()
  await page.locator("#email").fill("admin@clinica.com")
  await page.locator("#password").fill("admin123")
  await page.getByRole("button", { name: "Ingresar", exact: true }).click()
  await page.getByRole("button", { name: "Continuar", exact: true }).click()
  await page.goto("/historial-clinico/paciente/pat_1")
  await expect(page.getByRole("button", { name: "Registrar atención", exact: true })).toBeEnabled()
}

for (const theme of ["light", "dark"] as const) {
  test(`clinical menu anchors to its trigger, keeps compact rows and distinguishes selection in ${theme}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 1000 })
    await login(page, theme)
    const primary = theme === "light" ? "rgb(83, 80, 204)" : "rgb(228, 242, 34)"
    await expect(previous(page)).toHaveCSS("background-color", theme === "light" ? "rgb(241, 242, 243)" : "rgb(35, 37, 42)")
    await expect(next(page)).toHaveCSS("color", primary)
    const trigger = clinicalNavigation(page).getByRole("button", { name: "Ver secciones", exact: true })
    await expect(trigger.locator("svg")).toHaveCount(2)
    await trigger.click()
    const menu = page.getByRole("menu")
    await expect(menu).toBeVisible()
    const anchor = await trigger.boundingBox()
    const bounds = await menu.boundingBox()
    expect(Math.abs(bounds!.x - anchor!.x)).toBeLessThanOrEqual(1)
    expect(bounds!.y - anchor!.y - anchor!.height).toBeGreaterThanOrEqual(6)
    expect(bounds!.y - anchor!.y - anchor!.height).toBeLessThanOrEqual(9)
    const sidebar = await page.locator(".clinic-app-sidebar").boundingBox()
    expect(bounds!.x).toBeGreaterThanOrEqual(sidebar!.x + sidebar!.width)
    expect(bounds!.width).toBeLessThanOrEqual(336)
    expect(bounds!.height).toBeLessThanOrEqual(320)
    const items = page.getByRole("menuitemradio")
    await expect(items).toHaveCount(10)
    for (const row of await items.all()) {
      const box = await row.boundingBox()
      expect(box!.height).toBeGreaterThanOrEqual(36)
      expect(box!.height).toBeLessThanOrEqual(40)
    }
    const checked = page.getByRole("menuitemradio", { checked: true })
    await expect(checked).toHaveAccessibleName("3. Odontograma y periodontograma")
    await expect(checked).toHaveCSS("box-shadow", `${primary} 2px 0px 0px 0px inset`)
    await expect(checked.locator('[data-slot="dropdown-menu-radio-item-indicator"] svg')).toHaveCSS("color", primary)
    const labelPositions = await items.evaluateAll((rows) => rows.slice(0, 9).map((row) => row.querySelector(":scope > span:last-child")!.getBoundingClientRect().left))
    expect(Math.max(...labelPositions) - Math.min(...labelPositions)).toBeLessThanOrEqual(1)
    const indicators = await menu.locator('[data-slot="dropdown-menu-radio-item-indicator"]').evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().right))
    expect(Math.max(...indicators) - Math.min(...indicators)).toBeLessThanOrEqual(1)
    await items.first().hover()
    await expect(items.first()).toHaveAttribute("aria-checked", "false")
    expect(await items.first().evaluate((node) => getComputedStyle(node).backgroundColor)).not.toBe(await checked.evaluate((node) => getComputedStyle(node).backgroundColor))
    const pageScroll = await page.locator(".clinic-app-canvas").evaluate((node) => node.scrollTop)
    await page.keyboard.press("End")
    await expect(items.last()).toBeFocused()
    await expect(items.last()).toBeInViewport()
    expect(await menu.evaluate((node) => node.scrollTop)).toBeGreaterThan(0)
    expect(await page.locator(".clinic-app-canvas").evaluate((node) => node.scrollTop)).toBe(pageScroll)
    await page.screenshot({ path: testInfo.outputPath(`clinical-menu-${theme}.png`), animations: "disabled" })
    await page.keyboard.press("Enter")
    await expect(menu).toHaveCount(0)
    await expect(trigger).toBeFocused()
    await expect(clinicalNavigation(page)).toContainText("Sección adicional")
    await expect(page.getByRole("group", { name: "Navegación entre secciones" })).toHaveCount(0)
  })

  test(`navigation has tonal emphasis while save stays solid and independent at every width in ${theme}`, async ({ page }) => {
    await page.goto(`/tests/fixtures/clinical-navigation.html?total=3&active=2&theme=${theme}`)
    const primary = theme === "light" ? "rgb(83, 80, 204)" : "rgb(228, 242, 34)"
    const save = page.getByRole("button", { name: "Guardar cambios", exact: true })
    await expect(save).toHaveCSS("background-color", primary)
    for (const width of [320, 360, 375, 390, 430, 600, 768, 1024, 1280, 1440, 1920]) {
      await page.setViewportSize({ width, height: 1000 })
      await expect(next(page)).toHaveCSS("color", primary)
      expect(await next(page).evaluate((node) => getComputedStyle(node).backgroundColor)).not.toBe(primary)
      expect(await next(page).evaluate((node) => getComputedStyle(node).backgroundColor)).not.toBe(await previous(page).evaluate((node) => getComputedStyle(node).backgroundColor))
      for (const button of [previous(page), next(page)]) {
        await expect(button).toHaveAttribute("type", "button")
        const bounds = await button.boundingBox()
        expect(bounds!.height).toBeGreaterThanOrEqual(width < 1024 ? 44 : 38)
        expect(bounds!.x).toBeGreaterThanOrEqual(0)
        expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width)
      }
    }
    await page.getByLabel("Dato de prueba", { exact: true }).fill("Borrador sin autoguardado")
    await next(page).click()
    await expect(page.getByLabel("Identificador activo")).toHaveText("odontograma")
    await expect(page.getByLabel("Número de guardados")).toHaveText("0")
    await expect(next(page)).toHaveCount(0)
    await previous(page).click()
    await expect(page.getByLabel("Dato de prueba", { exact: true })).toHaveValue("Borrador sin autoguardado")
    await save.click()
    await expect(page.getByLabel("Número de guardados")).toHaveText("1")
    await expect(page.getByLabel("Valor guardado")).toHaveText("Borrador sin autoguardado")
  })
}
