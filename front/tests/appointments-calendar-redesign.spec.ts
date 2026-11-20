import { setAccessTheme } from "./helpers/access-theme"
import { expect, test, type Page } from "@playwright/test"

test.use({ timezoneId: "America/Guayaquil" })
test.describe.configure({ mode: "parallel" })
const triggerOf = (page: Page) => page.getByRole("button", { name: /^Elegir fecha:/ })
const popupOf = (page: Page) => page.locator('[data-slot="popover-content"]')
const toolbarOf = (page: Page) => page.locator(".rbc-toolbar")
const monthOf = (page: Page) => page.locator(".rbc-month-view")
const views = { month: "Mes", week: "Semana", day: "Día" } as const
const widths = [320, 360, 375, 390, 430, 600, 768, 1024, 1280, 1440, 1920]

async function login(page: Page, theme: "light" | "dark", route = "/citas") {
  await page.clock.install({ time: new Date("2026-11-11T17:00:00Z") })
  await page.goto("/login")
  await setAccessTheme(page, theme === "light" ? "light" : "dark")
  await page.locator("#email").fill("admin@clinica.com")
  await page.locator("#password").fill("admin123")
  await page.getByRole("button", { name: "Ingresar", exact: true }).click()
  await page.getByRole("button", { name: "Continuar", exact: true }).click()
  await expect(page).toHaveURL(/\/$/)
  if (route !== "/") await page.goto(route)
  await expect(page.locator('[data-slot="skeleton"]')).toHaveCount(0)
  if (route === "/citas") await expect(triggerOf(page)).toBeVisible()
}

test.describe("touch date navigation", () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } })
  for (const theme of ["light", "dark"] as const) {
    test(`touch selects one leap day and keeps monthly overflow usable in ${theme}`, async ({ page }) => {
      await login(page, theme)
      const before = await appointmentsSnapshot(page)
      await triggerOf(page).tap()
      await browse(page, "2028", "febrero")
      await popupOf(page).locator('button[data-day="29/2/2028"]').tap()
      await expect(popupOf(page)).toHaveCount(0)
      await triggerOf(page).tap()
      await expect(popupOf(page).locator('button[data-selected-single="true"]')).toHaveCount(1)
      await expect(popupOf(page).locator('button[data-day="29/2/2028"]')).toHaveAttribute("data-selected-single", "true")
      await page.keyboard.press("Escape")
      await chooseView(page, "month")
      await toolbarOf(page).getByRole("button", { name: "Hoy", exact: true }).tap()
      const overflow = await openOverflowFor(page, "2026-11-11")
      await expect(overflow.locator(".clinic-month-event")).toHaveCount(3)
      const bounds = await overflow.boundingBox()
      expect(bounds!.x).toBeGreaterThanOrEqual(0)
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390)
      expect(bounds!.y).toBeGreaterThanOrEqual(0)
      expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(845)
      await overflow.locator('[data-event-id="blk_1"]').tap()
      await expect(page.getByRole("alertdialog", { name: "Eliminar bloqueo de horario", exact: true })).toBeVisible()
      await page.getByRole("alertdialog").getByRole("button", { name: "Cancelar", exact: true }).tap()
      expect(await appointmentsSnapshot(page)).toBe(before)
      const remainingOverflow = await openOverflowFor(page, "2026-11-11")
      await remainingOverflow.locator('[data-event-id="blk_1"]').tap()
      await page.getByRole("alertdialog").getByRole("button", { name: "Eliminar", exact: true }).tap()
      await expect(page.getByRole("alertdialog")).toHaveCount(0)
      const afterDelete = JSON.parse(await appointmentsSnapshot(page))
      const original = JSON.parse(before)
      expect(afterDelete.appointments).toEqual(original.appointments)
      expect(afterDelete.blocks).toEqual(original.blocks.filter((block: { id: string }) => block.id !== "blk_1"))
      await expect(monthOf(page).locator('[data-date="2026-11-11"] .clinic-month-count')).toHaveAccessibleName("2 citas")
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
    })
  }
})

async function chooseView(page: Page, view: keyof typeof views) {
  const compact = page.getByLabel("Vista", { exact: true })
  if (await compact.isVisible()) {
    await compact.click()
    await page.getByRole("option", { name: views[view], exact: true }).click()
  } else await toolbarOf(page).getByRole("button", { name: views[view], exact: true }).click()
}

async function browse(page: Page, year: string, month: string) {
  await popupOf(page).getByLabel("Año", { exact: true }).fill(year)
  await popupOf(page).getByLabel("Mes", { exact: true }).click()
  await expect(page.getByRole("option")).toHaveCount(12)
  await page.getByRole("option", { name: month, exact: true }).click()
}

async function selectDate(page: Page, year: string, month: string, day: string, shift = false) {
  await triggerOf(page).click()
  await browse(page, year, month)
  await popupOf(page).locator(`button[data-day="${day}"]`).click({ modifiers: shift ? ["Shift"] : [] })
  await expect(popupOf(page)).toHaveCount(0)
  await expect(triggerOf(page)).toBeFocused()
  await expect(page.getByRole("dialog", { name: "Nueva cita", exact: true })).toHaveCount(0)
  await expect(page.locator(".rbc-slot-selection")).toHaveCount(0)
}

async function appointmentsSnapshot(page: Page) {
  return page.evaluate(async () => {
    const source = "/src/modules/appointments/api/appointments.mock-data.ts"
    const { mockAppointments, mockScheduleBlocks } = await import(source)
    return JSON.stringify({ appointments: mockAppointments, blocks: mockScheduleBlocks })
  })
}

async function openOverflowFor(page: Page, date: string) {
  const header = monthOf(page).locator(`.clinic-month-date[data-date="${date}"]`)
  // RBC briefly replaces week rows while measuring after a viewport change.
  await expect(async () => { await header.scrollIntoViewIfNeeded() }).toPass({ timeout: 15000 })
  const cell = await header.boundingBox()
  const more = monthOf(page).locator(".rbc-show-more")
  const index = await more.evaluateAll((buttons, bounds) => buttons.findIndex((button) => {
    const rect = button.getBoundingClientRect()
    return rect.left >= bounds!.x - 7 && rect.left < bounds!.x + bounds!.width
      && rect.top > bounds!.y && rect.top < bounds!.y + 128
  }), cell)
  expect(index, `Overflow button for ${date}`).toBeGreaterThanOrEqual(0)
  await more.nth(index).click()
  await expect(page.locator(".rbc-overlay")).toBeVisible()
  return page.locator(".rbc-overlay")
}

async function closeOverflow(page: Page) {
  // RBC's existing popup closes on outside clicks; Escape belongs to the date popover.
  await page.getByRole("heading", { name: "Citas", exact: true }).click()
  await expect(page.locator(".rbc-overlay")).toHaveCount(0)
}

for (const theme of ["light", "dark"] as const) {
  test(`month shows genuine four, five and six week grids with proportional rows in ${theme}`, async ({ page }, testInfo) => {
    await login(page, theme)
    await chooseView(page, "month")
    const measured = []
    for (const [year, month, day, rows, first, last] of [
      ["2027", "febrero", "15/2/2027", 4, "2027-02-01", "2027-02-28"],
      ["2027", "marzo", "15/3/2027", 5, "2027-03-01", "2027-04-04"],
      ["2026", "noviembre", "15/11/2026", 6, "2026-10-26", "2026-12-06"],
    ] as const) {
      await selectDate(page, year, month, day)
      await expect(monthOf(page).locator(".rbc-month-header .rbc-header")).toHaveCount(7)
      await expect(monthOf(page).locator(".rbc-month-row")).toHaveCount(rows)
      await expect(page.locator(".rbc-time-view")).toHaveCount(0)
      await expect(monthOf(page).locator(".clinic-month-date").first()).toHaveAttribute("data-date", first)
      await expect(monthOf(page).locator(".clinic-month-date").last()).toHaveAttribute("data-date", last)
      for (const row of await monthOf(page).locator(".rbc-month-row").all()) {
        await expect(row.locator(".rbc-day-bg")).toHaveCount(7)
        const bounds = await row.boundingBox()
        expect(bounds!.height).toBeGreaterThanOrEqual(96)
        expect(bounds!.height).toBeLessThanOrEqual(112)
      }
      const height = (await monthOf(page).boundingBox())!.height
      measured.push({ month, rows, height })
    }
    expect(measured[0].height).toBeLessThan(measured[1].height)
    expect(measured[1].height).toBeLessThan(measured[2].height)
    await testInfo.attach("month-grid-measurements", { body: JSON.stringify(measured, null, 2), contentType: "application/json" })
  })

  test(`single date selection cannot become a range or create an appointment in any view in ${theme}`, async ({ page }) => {
    await login(page, theme)
    const before = await appointmentsSnapshot(page)
    for (const view of ["month", "week", "day"] as const) {
      await chooseView(page, view)
      for (const [year, month, day] of [
        ["2026", "noviembre", "11/11/2026"], ["2026", "noviembre", "15/11/2026"],
        ["2027", "marzo", "15/3/2027"], ["2028", "febrero", "29/2/2028"],
        ["2027", "febrero", "15/2/2027"],
      ]) {
        await selectDate(page, year, month, day, true)
        await expect(toolbarOf(page).getByRole("button", { name: views[view], exact: true })).toHaveAttribute("aria-pressed", "true")
        await triggerOf(page).click()
        await expect(popupOf(page).locator('button[data-selected-single="true"]')).toHaveCount(1)
        await expect(popupOf(page).locator(`button[data-day="${day}"]`)).toHaveAttribute("data-selected-single", "true")
        await expect(popupOf(page).locator('[data-range-start="true"], [data-range-middle="true"], [data-range-end="true"]')).toHaveCount(0)
        await expect(popupOf(page).getByRole("gridcell", { selected: true })).toHaveCount(1)
        // Choosing the already selected day confirms it and closes, instead of deselecting it.
        await popupOf(page).locator(`button[data-day="${day}"]`).click()
        await expect(popupOf(page)).toHaveCount(0)
        await expect(triggerOf(page)).toBeFocused()
        await expect(page.getByRole("dialog")).toHaveCount(0)
      }
      await expect(page.locator(".rbc-day-slot")).toHaveCount(view === "month" ? 0 : view === "week" ? 7 : 1)
    }
    expect(await appointmentsSnapshot(page)).toBe(before)
  })

  test(`today, selected date, daily appointment counts and native overflow remain distinct in ${theme}`, async ({ page }) => {
    await login(page, theme)
    await chooseView(page, "month")
    const before = await appointmentsSnapshot(page)
    await selectDate(page, "2026", "noviembre", "15/11/2026")
    const primary = theme === "light" ? "rgb(83, 80, 204)" : "rgb(228, 242, 34)"
    const selected = monthOf(page).locator('.clinic-month-date[data-selected]')
    await expect(selected).toHaveCount(1)
    await expect(selected).toHaveAttribute("data-date", "2026-11-15")
    await expect(selected.locator("button")).toHaveCSS("color", primary)
    await expect(monthOf(page).locator(".rbc-day-bg.clinic-calendar-selected-day")).toHaveCSS("box-shadow", `${primary} 0px 0px 0px 2px inset`)
    const today = monthOf(page).locator('button[aria-current="date"]')
    await expect(today).toHaveCount(1)
    expect(await today.evaluate((node) => getComputedStyle(node).backgroundColor)).not.toBe(primary)
    await expect(today).toHaveCSS("text-decoration-line", "underline")
    await expect(monthOf(page).locator('[data-date="2026-11-11"] .clinic-month-count')).toHaveAccessibleName("2 citas")
    const counts = await monthOf(page).locator(".clinic-month-count").allTextContents()
    expect(counts.reduce((sum, value) => sum + Number(value), 0)).toBe(6)
    const ids = new Set(await monthOf(page).locator(".clinic-month-event").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-event-id"))))
    for (const date of ["2026-11-11", "2026-11-12"]) {
      const header = monthOf(page).locator(`.clinic-month-date[data-date="${date}"]`)
      const bounds = await header.boundingBox()
      const hasMore = await monthOf(page).locator(".rbc-show-more").evaluateAll((nodes, box) => nodes.some((node) => {
        const rect = node.getBoundingClientRect()
        return rect.left >= box!.x - 7 && rect.left < box!.x + box!.width && rect.top > box!.y && rect.top < box!.y + 128
      }), bounds)
      if (!hasMore) continue
      const overflow = await openOverflowFor(page, date)
      for (const id of await overflow.locator(".clinic-month-event").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-event-id")))) ids.add(id)
      await closeOverflow(page)
    }
    expect([...ids].sort()).toEqual(["apt_1", "apt_2", "apt_3", "apt_4", "apt_5", "apt_6", "blk_1", "blk_2"].sort())
    await triggerOf(page).click()
    await expect(popupOf(page).locator('button[data-day="15/11/2026"]')).toHaveCSS("background-color", primary)
    const pickerToday = popupOf(page).locator('button[data-day="11/11/2026"]')
    expect(await pickerToday.evaluate((node) => getComputedStyle(node).backgroundColor)).not.toBe(primary)
    await expect(pickerToday).toHaveCSS("outline-style", "solid")
    await page.keyboard.press("Escape")
    await toolbarOf(page).getByRole("button", { name: "Hoy", exact: true }).click()
    await expect(monthOf(page).locator('.clinic-month-date[data-selected]')).toHaveAttribute("data-date", "2026-11-11")
    await monthOf(page).locator('[data-date="2026-11-15"] button').click()
    await expect(page.locator(".rbc-day-slot")).toHaveCount(1)
    await expect(page.getByRole("dialog", { name: "Nueva cita", exact: true })).toHaveCount(0)
    await triggerOf(page).click()
    await expect(popupOf(page).locator('button[data-day="15/11/2026"]')).toHaveAttribute("data-selected-single", "true")
    await page.keyboard.press("Escape")
    expect(await appointmentsSnapshot(page)).toBe(before)
  })

  test(`crowded dates expose every appointment and block with filters and an internal scroll in ${theme}`, async ({ page }, testInfo) => {
    await login(page, theme, "/")
    // Isolated browser-only fixtures exercise overflow; production seeds and APIs are untouched.
    await page.evaluate(async () => {
      const source = "/src/modules/appointments/api/appointments.mock-data.ts"
      const { mockAppointments } = await import(source)
      const statuses = ["programada", "confirmada", "completada", "cancelada", "no_asistio"]
      for (let index = 0; index < 12; index++) {
        const start = new Date(2026, 10, 11, 8, index * 15)
        mockAppointments.push({ id: `crowded_${index}`, patientId: `pat_${index % 5 + 1}`, professionalId: `prof_${index % 3 + 1}`, start: start.toISOString(), end: new Date(+start + 15 * 60000).toISOString(), status: statuses[index % statuses.length], notes: `Calendario de prueba ${index}`, createdAt: new Date().toISOString() })
      }
      const client = "/src/shared/lib/query-client.ts"
      const { queryClient } = await import(client)
      await queryClient.invalidateQueries({ queryKey: ["appointments"] })
    })
    await page.getByRole("link", { name: "Citas", exact: true }).click()
    await expect(toolbarOf(page)).toBeVisible()
    await chooseView(page, "month")
    const before = await appointmentsSnapshot(page)
    await expect(monthOf(page).locator('[data-date="2026-11-11"] .clinic-month-count')).toHaveAccessibleName("14 citas")
    const expected = ["apt_1", "apt_2", "blk_1", ...Array.from({ length: 12 }, (_, index) => `crowded_${index}`)].sort()
    for (const { width, height } of [{ width: 1440, height: 1000 }, { width: 390, height: 1000 }, { width: 320, height: 1000 }, { width: 844, height: 390 }]) {
      await page.setViewportSize({ width, height })
      const overflow = await openOverflowFor(page, "2026-11-11")
      await expect(overflow.locator(".clinic-month-event")).toHaveCount(15)
      expect((await overflow.locator(".clinic-month-event").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-event-id")))).sort()).toEqual(expected)
      expect(await overflow.evaluate((node) => node.scrollHeight > node.clientHeight)).toBe(true)
      const bounds = await overflow.boundingBox()
      expect(bounds!.x).toBeGreaterThanOrEqual(-1)
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width + 1)
      expect(bounds!.y).toBeGreaterThanOrEqual(-1)
      expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(height + 1)
      const last = overflow.locator('[data-event-id="crowded_11"]')
      await last.scrollIntoViewIfNeeded()
      await expect(last).toBeInViewport()
      await page.screenshot({ path: testInfo.outputPath(`overflow-${theme}-${width}.png`), animations: "disabled" })
      await closeOverflow(page)
    }
    await page.setViewportSize({ width: 1440, height: 1000 })
    const overflow = await openOverflowFor(page, "2026-11-11")
    const last = overflow.locator('[data-event-id="crowded_11"]')
    await last.focus()
    await page.keyboard.press("Enter")
    await expect(page.getByRole("dialog")).toContainText("Calendario de prueba 11")
    await page.keyboard.press("Escape")
    await expect(page.getByRole("dialog")).toHaveCount(0)
    await page.getByLabel("Profesional", { exact: true }).click()
    await page.getByRole("option", { name: /Dr\. Andrés Vega/ }).click()
    await expect(monthOf(page).locator('[data-date="2026-11-11"] .clinic-month-count')).toHaveAccessibleName("5 citas")
    const filtered = await openOverflowFor(page, "2026-11-11")
    await expect(filtered.locator(".clinic-month-event")).toHaveCount(5)
    expect((await filtered.locator(".clinic-month-event").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-event-id")))).sort()).toEqual(["apt_2", "crowded_1", "crowded_4", "crowded_7", "crowded_10"].sort())
    expect(await appointmentsSnapshot(page)).toBe(before)
  })

  test(`monthly grid and date selector remain usable at every width in ${theme}`, async ({ page }, testInfo) => {
    await login(page, theme)
    await chooseView(page, "month")
    const measurements = []
    for (const width of widths) {
      await page.setViewportSize({ width, height: 1000 })
      await expect(monthOf(page).locator(".rbc-month-row")).toHaveCount(6)
      await expect(monthOf(page).locator(".rbc-month-header .rbc-header")).toHaveCount(7)
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
      const frame = page.locator(".clinic-calendar-frame")
      await frame.evaluate((node) => { node.scrollLeft = node.scrollWidth })
      const trigger = triggerOf(page)
      const triggerBounds = await trigger.boundingBox()
      expect(triggerBounds!.x).toBeGreaterThanOrEqual(0)
      expect(triggerBounds!.x + triggerBounds!.width).toBeLessThanOrEqual(width)
      await trigger.click()
      const popup = popupOf(page)
      const bounds = await popup.boundingBox()
      expect(bounds!.x).toBeGreaterThanOrEqual(-1)
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width + 1)
      expect(bounds!.y).toBeGreaterThanOrEqual(-1)
      expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(1001)
      const fields = await popup.locator('input, [data-slot="select-trigger"]').evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().height))
      expect(Math.abs(fields[0] - fields[1])).toBeLessThanOrEqual(1)
      await popup.locator('button[data-day="15/11/2026"]').click()
      await expect(popup).toHaveCount(0)
      await expect(frame).toHaveAttribute("data-calendar-view", "month")
      await expect(monthOf(page).locator('.clinic-month-date[data-selected]')).toHaveAttribute("data-date", "2026-11-15")
      measurements.push({ width, triggerBounds, popupBounds: bounds, fieldHeights: fields })
    }
    await testInfo.attach("monthly-responsive", { body: JSON.stringify(measurements, null, 2), contentType: "application/json" })
  })

  test(`time interval selection still opens the existing appointment form after a date jump in ${theme}`, async ({ page }) => {
    await login(page, theme)
    await chooseView(page, "day")
    await selectDate(page, "2027", "marzo", "15/3/2027")
    const before = await appointmentsSnapshot(page)
    const slots = page.locator(".rbc-day-slot .rbc-time-slot")
    await slots.nth(18).scrollIntoViewIfNeeded()
    const start = await slots.nth(18).boundingBox()
    const end = await slots.nth(20).boundingBox()
    await page.mouse.move(start!.x + start!.width / 2, start!.y + 2)
    await page.mouse.down()
    await page.mouse.move(end!.x + end!.width / 2, end!.y + end!.height / 2, { steps: 8 })
    await page.mouse.up()
    const form = page.getByRole("dialog", { name: "Nueva cita", exact: true })
    await expect(form.getByLabel("Fecha", { exact: true })).toHaveValue("2027-03-15")
    await expect(form.getByLabel("Inicio", { exact: true })).toHaveValue("09:00")
    await expect(form.getByLabel("Fin", { exact: true })).toHaveValue("10:30")
    await form.getByRole("button", { name: "Cancelar", exact: true }).click()
    expect(await appointmentsSnapshot(page)).toBe(before)
  })
}
