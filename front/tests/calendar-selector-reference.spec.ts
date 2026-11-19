import { expect, test, type Page } from "@playwright/test"
import { settleCalendarLayout } from "./helpers/calendar-layout"

test.use({ timezoneId: "America/Guayaquil" })
test.describe.configure({ mode: "parallel" })
const triggerOf = (page: Page) => page.getByRole("button", { name: /^Elegir fecha:/ })
const popupOf = (page: Page) => page.locator('[data-slot="popover-content"]')
const footerOf = (page: Page) => popupOf(page).locator("[data-calendar-date-footer]")
const dayOf = (page: Page, date: string) => popupOf(page).locator(`button[data-day="${date}"]`)

async function login(page: Page, theme: "light" | "dark") {
  await page.clock.install({ time: new Date("2026-11-11T17:00:00Z") })
  await page.goto("/login")
  await page.getByRole("button", { name: theme === "light" ? "Tema claro" : "Tema oscuro", exact: true }).click()
  await page.locator("#email").fill("admin@clinica.com")
  await page.locator("#password").fill("admin123")
  await page.getByRole("button", { name: "Ingresar", exact: true }).click()
  await page.getByRole("button", { name: "Continuar", exact: true }).click()
  await page.goto("/citas")
  await expect(triggerOf(page)).toBeVisible()
}

async function snapshot(page: Page) {
  return page.evaluate(async () => {
    const source = "/src/modules/appointments/api/appointments.mock-data.ts"
    const { mockAppointments, mockScheduleBlocks } = await import(source)
    return JSON.stringify({ appointments: mockAppointments, blocks: mockScheduleBlocks })
  })
}

for (const theme of ["light", "dark"] as const) {
  test(`reference composition has equal pill fields, circular arrows, day surfaces and a neutral Today in ${theme}`, async ({ page }, testInfo) => {
    await login(page, theme)
    const before = await snapshot(page)
    await triggerOf(page).click()
    await dayOf(page, "15/11/2026").click()
    await expect(popupOf(page)).toHaveCount(0)
    await triggerOf(page).click()
    const popup = popupOf(page)
    await expect(popup).toHaveCSS("width", "360px")
    await expect(popup).toHaveCSS("border-radius", "20px")
    await expect(popup).toHaveCSS("background-color", theme === "dark" ? "rgb(15, 16, 17)" : "rgb(255, 255, 255)")
    await expect(popup.locator('[data-slot="popover-title"]')).toHaveCSS("font-size", "18px")
    const fields = [popup.getByLabel("Mes", { exact: true }), popup.getByLabel("Año", { exact: true })]
    const sizes = await Promise.all(fields.map((field) => field.evaluate((node) => ({ width: node.getBoundingClientRect().width, height: node.getBoundingClientRect().height }))))
    expect(Math.abs(sizes[0].width - sizes[1].width)).toBeLessThanOrEqual(1)
    expect(Math.abs(sizes[0].height - sizes[1].height)).toBeLessThanOrEqual(1)
    for (const field of fields) await expect(field).toHaveCSS("border-radius", "999px")
    for (const button of await popup.getByRole("group", { name: "Cambiar mes del selector" }).getByRole("button").all()) {
      await expect(button).toHaveCSS("border-radius", "999px")
      await expect(button).toHaveCSS("border-style", "solid")
      const box = await button.boundingBox()
      expect(Math.abs(box!.width - box!.height)).toBeLessThanOrEqual(1)
    }
    const primary = theme === "light" ? "rgb(83, 80, 204)" : "rgb(228, 242, 34)"
    const foreground = theme === "light" ? "rgb(255, 255, 255)" : "rgb(8, 9, 10)"
    const normal = dayOf(page, "14/11/2026")
    await expect(normal).toHaveCSS("background-color", theme === "dark" ? "rgb(22, 23, 24)" : "rgb(241, 242, 243)")
    await expect(normal).toHaveCSS("border-radius", "10px")
    const selected = dayOf(page, "15/11/2026")
    await expect(selected).toHaveCSS("background-color", primary)
    await expect(selected).toHaveCSS("color", foreground)
    await expect(dayOf(page, "26/10/2026")).toHaveCSS("background-color", "rgba(0, 0, 0, 0)")
    await expect(dayOf(page, "11/11/2026")).toHaveAttribute("data-appointment-count", "2")
    expect(await dayOf(page, "11/11/2026").evaluate((node) => getComputedStyle(node, "::after").backgroundColor)).toBe(primary)
    expect(await normal.getAttribute("data-appointment-count")).toBeNull()
    const today = footerOf(page).getByRole("button", { name: "Hoy", exact: true })
    await expect(today).toHaveCSS("border-radius", "999px")
    await expect(today).toHaveCSS("background-color", theme === "dark" ? "rgb(229, 229, 230)" : "rgb(241, 242, 243)")
    await expect(today).toHaveCSS("color", theme === "dark" ? "rgb(8, 9, 10)" : "rgb(23, 25, 28)")
    const normalColor = await normal.evaluate((node) => getComputedStyle(node).backgroundColor)
    await normal.hover()
    await expect.poll(() => normal.evaluate((node) => getComputedStyle(node).backgroundColor)).not.toBe(normalColor)
    await expect(popup.locator('button[data-selected-single="true"]')).toHaveCount(1)
    await selected.hover()
    await expect(selected).toHaveCSS("color", foreground)
    await expect(selected).toHaveCSS("background-color", primary)
    await page.mouse.move(0, 0)
    await popup.screenshot({ path: testInfo.outputPath(`reference-selector-${theme}.png`), animations: "disabled" })
    const previous = popup.getByRole("button", { name: "Mes anterior", exact: true })
    await previous.focus()
    await page.keyboard.press("Enter")
    await expect(popup.getByLabel("Mes", { exact: true })).toContainText("octubre")
    await expect(triggerOf(page)).toHaveAccessibleName("Elegir fecha: 15 de noviembre de 2026")
    await popup.getByRole("button", { name: "Mes siguiente", exact: true }).click()
    await dayOf(page, "26/10/2026").click()
    await expect(popup).toHaveCount(0)
    await expect(triggerOf(page)).toHaveAccessibleName("Elegir fecha: 26 de octubre de 2026")
    await expect(triggerOf(page)).toBeFocused()
    await triggerOf(page).click()
    await footerOf(page).getByRole("button", { name: "Hoy", exact: true }).focus()
    await page.keyboard.press("Enter")
    await expect(popup).toHaveCount(0)
    await expect(triggerOf(page)).toHaveAccessibleName("Elegir fecha: 11 de noviembre de 2026")
    await expect(page.locator(".clinic-calendar-frame")).toHaveAttribute("data-calendar-view", "week")
    expect(await snapshot(page)).toBe(before)
  })

  test(`reference surfaces fit all widths with aligned fields, readable selection and accessible footer in ${theme}`, async ({ page }, testInfo) => {
    await login(page, theme)
    const measurements = []
    for (const size of [...[320, 360, 375, 390, 430, 600, 768, 1024, 1280, 1440, 1920].map((width) => ({ width, height: 1000 })), { width: 844, height: 390 }, { width: 320, height: 568 }]) {
      await page.setViewportSize(size)
      await settleCalendarLayout(page)
      await triggerOf(page).click()
      const popup = popupOf(page)
      await expect(popup.locator(".rdp-weekday")).toHaveCount(7)
      const controls = [popup.getByLabel("Mes", { exact: true }), popup.getByLabel("Año", { exact: true })]
      const fields = await Promise.all(controls.map((control) => control.evaluate((node) => ({ width: node.getBoundingClientRect().width, height: node.getBoundingClientRect().height, overflow: node.scrollWidth > node.clientWidth + 1 }))))
      expect(Math.abs(fields[0].width - fields[1].width)).toBeLessThanOrEqual(1)
      expect(fields.some((field) => field.overflow)).toBe(false)
      const bounds = await popup.boundingBox()
      expect(bounds!.x).toBeGreaterThanOrEqual(-1)
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(size.width + 1)
      expect(bounds!.y).toBeGreaterThanOrEqual(-1)
      expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(size.height + 1)
      await expect(footerOf(page).getByRole("button", { name: "Hoy", exact: true })).toBeInViewport()
      await expect(footerOf(page).locator("time")).toBeInViewport()
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(size.width)
      await popup.locator('button[data-day]').last().scrollIntoViewIfNeeded()
      await expect(popup.locator('button[data-day]').last()).toBeInViewport()
      await expect(footerOf(page).getByRole("button", { name: "Hoy", exact: true })).toBeInViewport()
      measurements.push({ ...size, popup: bounds, fields })
      if ([320, 1440].includes(size.width) && size.height === 1000) await popup.screenshot({ path: testInfo.outputPath(`reference-selector-${theme}-${size.width}.png`), animations: "disabled" })
      await page.keyboard.press("Escape")
      await expect(popup).toHaveCount(0)
      await expect(triggerOf(page)).toBeFocused()
    }
    await testInfo.attach("reference-selector-responsive", { body: JSON.stringify(measurements, null, 2), contentType: "application/json" })
  })
}
