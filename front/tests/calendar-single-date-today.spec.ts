import { expect, test, type Page } from "@playwright/test"

test.use({ timezoneId: "America/Guayaquil" })
test.describe.configure({ mode: "parallel" })
const triggerOf = (page: Page) => page.getByRole("button", { name: /^Elegir fecha:/ })
const popupOf = (page: Page) => page.locator('[data-slot="popover-content"]')
const footerOf = (page: Page) => popupOf(page).locator("[data-calendar-date-footer]")
const selectedOf = (page: Page) => popupOf(page).locator("[data-calendar-selected-date]")
const views = { month: "Mes", week: "Semana", day: "Día" } as const
const widths = [320, 360, 375, 390, 430, 600, 768, 1024, 1280, 1440, 1920]

async function login(page: Page, theme: "light" | "dark", now = "2026-11-11T17:00:00Z", route = "/citas") {
  await page.clock.install({ time: new Date(now) })
  await page.goto("/login")
  await page.getByRole("button", { name: theme === "light" ? "Tema claro" : "Tema oscuro", exact: true }).click()
  await page.locator("#email").fill("admin@clinica.com")
  await page.locator("#password").fill("admin123")
  await page.getByRole("button", { name: "Ingresar", exact: true }).click()
  await page.getByRole("button", { name: "Continuar", exact: true }).click()
  await page.goto(route)
  await expect(triggerOf(page)).toBeVisible()
}

async function chooseView(page: Page, view: keyof typeof views) {
  const compact = page.getByLabel("Vista", { exact: true })
  if (await compact.isVisible()) {
    await compact.click()
    await page.getByRole("option", { name: views[view], exact: true }).click()
  } else await page.locator(".rbc-toolbar").getByRole("button", { name: views[view], exact: true }).click()
}

async function expectView(page: Page, view: keyof typeof views) {
  await expect(page.locator(".clinic-calendar-frame")).toHaveAttribute("data-calendar-view", view)
  const compact = page.getByLabel("Vista", { exact: true })
  if (await compact.isVisible()) await expect(compact).toContainText(views[view])
  else await expect(page.locator(".rbc-toolbar").getByRole("button", { name: views[view], exact: true })).toHaveAttribute("aria-pressed", "true")
}

async function browse(page: Page, year: string, month: string) {
  await popupOf(page).getByLabel("Año", { exact: true }).fill(year)
  await popupOf(page).getByLabel("Mes", { exact: true }).click()
  await expect(page.getByRole("option")).toHaveCount(12)
  await page.getByRole("option", { name: month, exact: true }).click()
}

async function distantDate(page: Page) {
  await triggerOf(page).click()
  await browse(page, "2028", "febrero")
  await popupOf(page).locator('button[data-day="29/2/2028"]').click()
  await expect(popupOf(page)).toHaveCount(0)
  await expect(triggerOf(page)).toHaveText("29 de febrero de 2028")
}

async function snapshot(page: Page) {
  return page.evaluate(async () => {
    const source = "/src/modules/appointments/api/appointments.mock-data.ts"
    const { mockAppointments, mockScheduleBlocks } = await import(source)
    return JSON.stringify({ appointments: mockAppointments, blocks: mockScheduleBlocks })
  })
}

for (const theme of ["light", "dark"] as const) {
  test(`both Today controls return to one local date and preserve all views and presentations in ${theme}`, async ({ page }) => {
    await login(page, theme)
    const before = await snapshot(page)
    const todaySurface = theme === "light" ? "rgb(241, 242, 243)" : "rgb(229, 229, 230)"
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 })
      for (const view of ["month", "week", "day"] as const) {
        await chooseView(page, view)
        await distantDate(page)
        await triggerOf(page).click()
        await expect(page.getByRole("button", { name: "Hoy", exact: true })).toHaveCount(2)
        await expect(selectedOf(page)).toHaveAttribute("datetime", "2028-02-29")
        await browse(page, "2400", "marzo")
        await expect(triggerOf(page)).toHaveText("29 de febrero de 2028")
        await expect(selectedOf(page)).toHaveAttribute("datetime", "2028-02-29")
        const today = footerOf(page).getByRole("button", { name: "Hoy", exact: true })
        await page.mouse.move(0, 0)
        await expect(today).toHaveCSS("background-color", todaySurface)
        await today.click()
        await expect(popupOf(page)).toHaveCount(0)
        await expect(triggerOf(page)).toBeFocused()
        await expect(triggerOf(page)).toHaveText("11 de noviembre de 2026")
        await expectView(page, view)
        await expect(page.getByRole("dialog")).toHaveCount(0)
        await distantDate(page)
        await expect(page.getByRole("button", { name: "Hoy", exact: true })).toHaveCount(1)
        await page.getByRole("button", { name: "Hoy", exact: true }).click()
        await expect(triggerOf(page)).toHaveText("11 de noviembre de 2026")
        await expectView(page, view)
        await triggerOf(page).click()
        await expect(selectedOf(page)).toHaveAttribute("datetime", "2026-11-11")
        await expect(popupOf(page).locator('button[data-selected-single="true"]')).toHaveCount(1)
        await expect(popupOf(page).locator('button[data-day="11/11/2026"]')).toHaveAttribute("data-selected-single", "true")
        await page.keyboard.press("Escape")
      }
    }
    expect(await snapshot(page)).toBe(before)
  })

  test(`exact trigger, cursor heading and selected footer remain separate and allow keyboard Today in ${theme}`, async ({ page }) => {
    await login(page, theme)
    const before = await snapshot(page)
    await expect(triggerOf(page)).toHaveText("11 de noviembre de 2026")
    await expect(page.locator('[aria-label="Periodo visible"]:visible')).toContainText("09 – 15")
    await triggerOf(page).click()
    await expect(popupOf(page).getByRole("heading", { name: /Ir a una fecha: noviembre 2026/i })).toBeVisible()
    await expect(popupOf(page).getByText("Selecciona únicamente un día", { exact: true })).toBeVisible()
    expect(await popupOf(page).locator(".rdp-weekday").allTextContents()).toEqual(["L", "M", "M", "J", "V", "S", "D"])
    await popupOf(page).locator('button[data-day="15/11/2026"]').click({ modifiers: ["Shift"] })
    await expect(popupOf(page)).toHaveCount(0)
    await expect(triggerOf(page)).toHaveText("15 de noviembre de 2026")
    await triggerOf(page).click()
    await expect(selectedOf(page)).toHaveText("15 de noviembre de 2026")
    await expect(popupOf(page).locator('button[data-selected-single="true"]')).toHaveCount(1)
    await expect(popupOf(page).locator('button[data-day="15/11/2026"]')).toHaveAttribute("data-selected-single", "true")
    await expect(popupOf(page).locator('button[data-day="11/11/2026"]')).not.toHaveAttribute("data-selected-single", "true")
    await expect(popupOf(page).locator('[data-range-start="true"], [data-range-middle="true"], [data-range-end="true"]')).toHaveCount(0)
    await browse(page, "2400", "febrero")
    await expect(popupOf(page).getByRole("heading", { name: /febrero 2400/i })).toBeVisible()
    await expect(triggerOf(page)).toHaveText("15 de noviembre de 2026")
    await expect(selectedOf(page)).toHaveText("15 de noviembre de 2026")
    await popupOf(page).getByLabel("Año", { exact: true }).fill("")
    await expect(popupOf(page).getByRole("alert")).toContainText("año válido")
    const today = footerOf(page).getByRole("button", { name: "Hoy", exact: true })
    await expect(today).toBeEnabled()
    await today.focus()
    await page.keyboard.press("Space")
    await expect(popupOf(page)).toHaveCount(0)
    await expect(triggerOf(page)).toBeFocused()
    await expect(triggerOf(page)).toHaveText("11 de noviembre de 2026")
    await expectView(page, "week")
    expect(await snapshot(page)).toBe(before)
  })

  test(`appointment dots derive from filtered appointments and exclude block-only days in ${theme}`, async ({ page }) => {
    await login(page, theme)
    const before = await snapshot(page)
    await triggerOf(page).click()
    const populated = popupOf(page).locator('button[data-day="11/11/2026"]')
    await expect(populated).toHaveAttribute("data-appointment-count", "2")
    await expect(populated).toHaveAccessibleName(/2 citas/)
    expect(await populated.evaluate((node) => getComputedStyle(node, "::after").content)).toBe('""')
    const values = await popupOf(page).locator("button[data-appointment-count]").evaluateAll((nodes) => nodes.map((node) => Number(node.getAttribute("data-appointment-count"))))
    expect(values.reduce((total, count) => total + count, 0)).toBe(6)
    expect(await popupOf(page).locator('button[data-day="15/11/2026"]').getAttribute("data-appointment-count")).toBeNull()
    await page.keyboard.press("Escape")
    await page.getByLabel("Profesional", { exact: true }).click()
    await page.getByRole("option", { name: /Dra\. Carla Ríos/ }).click()
    await triggerOf(page).click()
    await expect(populated).toHaveAttribute("data-appointment-count", "1")
    await expect(populated).toHaveAccessibleName(/1 cita/)
    await page.keyboard.press("Escape")
    expect(await snapshot(page)).toBe(before)
    await page.goto("/citas?pacienteId=pat_5")
    await expect(page.locator(".rbc-event-block").first()).toBeVisible()
    await triggerOf(page).click()
    await expect(popupOf(page).locator('button[data-day="10/11/2026"]')).toHaveAttribute("data-appointment-count", "1")
    for (const day of ["11/11/2026", "12/11/2026"]) {
      const button = popupOf(page).locator(`button[data-day="${day}"]`)
      expect(await button.getAttribute("data-appointment-count")).toBeNull()
      expect(await button.evaluate((node) => getComputedStyle(node, "::after").content)).toBe("none")
    }
  })

  test(`selected date and Today footer stay visible across every width, view and short viewport in ${theme}`, async ({ page }, testInfo) => {
    await login(page, theme)
    const measurements = []
    for (const width of widths) {
      await page.setViewportSize({ width, height: 1000 })
      for (const view of ["month", "week", "day"] as const) {
        await chooseView(page, view)
        if (view === "month") await page.locator(".clinic-calendar-frame").evaluate((node) => { node.scrollLeft = node.scrollWidth })
        await triggerOf(page).click()
        const popup = popupOf(page)
        await expect(popup.locator(".rdp-weekday")).toHaveCount(7)
        const today = footerOf(page).getByRole("button", { name: "Hoy", exact: true })
        await expect(today).toBeInViewport()
        await expect(selectedOf(page)).toBeInViewport()
        const bounds = await popup.boundingBox()
        expect(bounds!.x).toBeGreaterThanOrEqual(-1)
        expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width + 1)
        expect(bounds!.y).toBeGreaterThanOrEqual(-1)
        expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(1001)
        // The popover scales during its opening animation; measure the settled touch target.
        await expect.poll(async () => (await today.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(width < 1024 ? 44 : 38)
        const target = await today.boundingBox()
        expect(await popup.evaluate((node) => node.scrollWidth <= node.clientWidth + 1)).toBe(true)
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
        measurements.push({ width, view, popup: bounds, today: target })
        await today.click()
        await expect(popup).toHaveCount(0)
        await expectView(page, view)
      }
    }
    for (const size of [{ width: 844, height: 390 }, { width: 375, height: 420 }, { width: 320, height: 568 }]) {
      await page.setViewportSize(size)
      await triggerOf(page).click()
      const popup = popupOf(page)
      await popup.locator('button[data-day]').last().scrollIntoViewIfNeeded()
      await expect(popup.locator('button[data-day]').last()).toBeInViewport()
      await expect(footerOf(page).getByRole("button", { name: "Hoy", exact: true })).toBeInViewport()
      const box = await popup.boundingBox()
      expect(box!.y).toBeGreaterThanOrEqual(-1)
      expect(box!.y + box!.height).toBeLessThanOrEqual(size.height + 1)
      await footerOf(page).getByRole("button", { name: "Hoy", exact: true }).click()
      await expect(popup).toHaveCount(0)
    }
    await testInfo.attach("single-date-today-responsive", { body: JSON.stringify(measurements, null, 2), contentType: "application/json" })
  })
}

for (const [instant, localDay] of [["2026-11-11T02:30:00Z", "10"], ["2026-11-11T05:30:00Z", "11"]]) {
  test(`both Today controls use the local date near UTC midnight at ${instant}`, async ({ page }) => {
    await login(page, "light", instant)
    await chooseView(page, "day")
    const expected = `${localDay} de noviembre de 2026`
    const before = await snapshot(page)
    await distantDate(page)
    await triggerOf(page).click()
    await footerOf(page).getByRole("button", { name: "Hoy", exact: true }).click()
    await expect(popupOf(page)).toHaveCount(0)
    await expect(triggerOf(page)).toHaveText(expected)
    await expectView(page, "day")
    await distantDate(page)
    await page.getByRole("button", { name: "Hoy", exact: true }).click()
    await expect(triggerOf(page)).toHaveText(expected)
    await triggerOf(page).click()
    await expect(popupOf(page).locator(`button[data-day="${localDay}/11/2026"]`)).toHaveAttribute("data-selected-single", "true")
    await expect(popupOf(page).locator('button[data-selected-single="true"]')).toHaveCount(1)
    expect(await snapshot(page)).toBe(before)
  })
}
