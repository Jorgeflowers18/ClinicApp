import { expect, test, type Page } from "@playwright/test"

test.use({ timezoneId: "America/Guayaquil" })
test.describe.configure({ mode: "parallel" })
const widths = [320, 360, 375, 390, 430, 600, 768, 1024, 1280, 1440, 1920]
const labels = { month: "Mes", week: "Semana", day: "Día" } as const
const triggerOf = (page: Page) => page.getByRole("button", { name: /^Elegir fecha:/ })
const eventOf = (page: Page, id: string) => page.locator(`.rbc-day-slot .rbc-event:has([data-event-id="${id}"])`)

async function login(page: Page, theme: "light" | "dark", route = "/citas") {
  await page.clock.install({ time: new Date("2026-11-11T17:00:00Z") })
  await page.goto("/login")
  await page.getByRole("button", { name: theme === "light" ? "Tema claro" : "Tema oscuro", exact: true }).click()
  await page.locator("#email").fill("admin@clinica.com")
  await page.locator("#password").fill("admin123")
  await page.getByRole("button", { name: "Ingresar", exact: true }).click()
  await page.getByRole("button", { name: "Continuar", exact: true }).click()
  await expect(page).toHaveURL(/\/$/)
  if (route !== "/") await page.goto(route)
  await expect(page.locator('[data-slot="skeleton"]')).toHaveCount(0)
  if (route === "/citas") await expect(triggerOf(page)).toBeVisible()
}

async function chooseView(page: Page, view: keyof typeof labels) {
  const compact = page.getByLabel("Vista", { exact: true })
  if (await compact.isVisible()) {
    await compact.click()
    await page.getByRole("option", { name: labels[view], exact: true }).click()
  } else await page.locator(".rbc-toolbar").getByRole("button", { name: labels[view], exact: true }).click()
}

async function snapshot(page: Page) {
  return page.evaluate(async () => {
    const source = "/src/modules/appointments/api/appointments.mock-data.ts"
    const { mockAppointments, mockScheduleBlocks } = await import(source)
    return JSON.stringify({ appointments: mockAppointments, blocks: mockScheduleBlocks })
  })
}

for (const theme of ["light", "dark"] as const) {
  test(`native time cards retain geometry, treatments, keyboard details and semantic colors in ${theme}`, async ({ page }, testInfo) => {
    await login(page, theme)
    const before = await snapshot(page)
    const primary = theme === "dark" ? "rgb(228, 242, 34)" : "rgb(83, 80, 204)"
    await expect(page.locator(".clinic-week-date")).toHaveCount(7)
    await expect(page.locator('.clinic-week-date[data-selected]')).toHaveAttribute("dateTime", "2026-11-11")
    const selectedHeader = page.locator('.clinic-week-date[data-selected]')
    await expect(selectedHeader).toContainText("11 nov")
    const headingBox = await selectedHeader.locator("xpath=ancestor::div[contains(@class,'rbc-header')]").boundingBox()
    const dateBox = await selectedHeader.locator("span").last().boundingBox()
    expect(dateBox!.y + dateBox!.height).toBeLessThanOrEqual(headingBox!.y + headingBox!.height)
    expect(await selectedHeader.locator("span").last().evaluate((node) => {
      const rect = node.getBoundingClientRect()
      return node.closest(".rbc-header")!.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2))
    })).toBe(true)
    await selectedHeader.locator("span").last().click()
    await expect(page.locator(".clinic-day-date")).toBeVisible()
    await expect(page.getByRole("dialog", { name: "Nueva cita", exact: true })).toHaveCount(0)
    await chooseView(page, "week")
    const times = await page.locator(".rbc-time-gutter .rbc-label").allTextContents()
    expect(times).toHaveLength(24)
    expect(times[0]).toBe("00:00")
    expect(times[23]).toBe("23:00")
    const compact = eventOf(page, "apt_1")
    const full = eventOf(page, "apt_2")
    await expect(full.locator(".clinic-time-event-detail")).toHaveText("Ajuste de ortodoncia · 60 min")
    await expect(full).not.toHaveAttribute("role", "button")
    await expect(full).not.toHaveAttribute("tabindex", "0")
    await expect(compact.locator(".clinic-time-event-detail")).toBeHidden()
    await expect(compact.locator(".clinic-time-event-time")).toHaveText("09:00 – 09:30")
    const shortCardBox = await compact.boundingBox()
    const patientBox = await compact.locator(".clinic-time-event-heading").boundingBox()
    expect(patientBox!.y + patientBox!.height).toBeLessThanOrEqual(shortCardBox!.y + shortCardBox!.height)
    const geometry = await page.locator(".rbc-day-slot .rbc-event").evaluateAll((nodes) => nodes.map((node) => ({
      id: node.querySelector("[data-event-id]")?.getAttribute("data-event-id"),
      top: (node as HTMLElement).style.top, height: (node as HTMLElement).style.height,
      pixelHeight: node.getBoundingClientRect().height,
    })))
    expect(geometry.find((event) => event.id === "apt_1")!.pixelHeight).toBeCloseTo(36, 0)
    expect(geometry.find((event) => event.id === "apt_2")!.pixelHeight).toBeCloseTo(72, 0)
    const semantic = await full.evaluate((node) => getComputedStyle(node).getPropertyValue("--event-color").trim())
    expect(semantic).toBe(theme === "dark" ? "#02b8cc" : "#5350cc")
    expect(await full.evaluate((node) => getComputedStyle(node).backgroundColor)).not.toBe(primary)
    await expect(eventOf(page, "blk_1")).toHaveCSS("background-image", /repeating-linear-gradient/)
    await expect(eventOf(page, "apt_6")).toHaveCSS("text-decoration-line", "line-through")
    await page.keyboard.press("Tab")
    await full.locator(".clinic-time-event").focus()
    await expect(full.locator(".clinic-time-event")).toHaveCSS("outline-style", "solid")
    await page.keyboard.press("Enter")
    await expect(page.getByRole("dialog")).toContainText("Carlos Pérez")
    await page.keyboard.press("Escape")
    await chooseView(page, "day")
    await expect(page.locator(".clinic-day-date")).toHaveText("Miércoles, 11 de noviembre de 2026")
    await expect(page.locator(".rbc-day-slot")).toHaveCount(1)
    await expect(compact.locator(".clinic-time-event-detail")).toBeVisible()
    await expect(compact.locator(".clinic-time-event-detail")).toHaveText("Limpieza dental · 30 min")
    await expect.poll(async () => {
      const card = await compact.boundingBox()
      const detail = await compact.locator(".clinic-time-event-detail").boundingBox()
      return detail!.y + detail!.height <= card!.y + card!.height
    }).toBe(true)
    await page.getByLabel("Profesional", { exact: true }).click()
    await page.getByRole("option", { name: /Dr\. Andrés Vega/ }).click()
    await expect(page.locator(".clinic-time-event")).toHaveCount(1)
    await expect(full).toBeVisible()
    expect(await snapshot(page)).toBe(before)
    await testInfo.attach("native-event-geometry", { body: JSON.stringify(geometry, null, 2), contentType: "application/json" })
  })

  test(`simultaneous and short appointments keep RBC placement and original detail actions in ${theme}`, async ({ page }, testInfo) => {
    await login(page, theme, "/")
    // Isolated fixtures test the native overlap algorithm without editing production seeds.
    await page.evaluate(async () => {
      const source = "/src/modules/appointments/api/appointments.mock-data.ts"
      const { mockAppointments } = await import(source)
      for (const [index, duration] of [60, 30, 15].entries()) {
        const start = new Date(2026, 10, 11, 11)
        mockAppointments.push({ id: `simultaneous_${index}`, patientId: `pat_${index + 1}`, professionalId: "prof_2", start: start.toISOString(), end: new Date(+start + duration * 60000).toISOString(), status: ["programada", "cancelada", "no_asistio"][index], notes: `Overlap fixture ${index}`, createdAt: start.toISOString() })
      }
      mockAppointments.push({ id: "spanning_fixture", patientId: "pat_4", professionalId: "prof_3", start: new Date(2026, 10, 10, 12).toISOString(), end: new Date(2026, 10, 12, 12).toISOString(), status: "programada", notes: "Multi-day fixture", createdAt: new Date().toISOString() })
      const client = "/src/shared/lib/query-client.ts"
      const { queryClient } = await import(client)
      await queryClient.invalidateQueries({ queryKey: ["appointments"] })
    })
    await page.getByRole("link", { name: "Citas", exact: true }).click()
    await expect(triggerOf(page)).toBeVisible()
    const before = await snapshot(page)
    const positions = []
    for (const view of ["week", "day"] as const) {
      await chooseView(page, view)
      const spanning = page.locator('.rbc-allday-cell [data-event-id="spanning_fixture"]')
      await expect(spanning).toBeVisible()
      const allDayBox = await spanning.boundingBox()
      const headerBox = await page.locator(".rbc-time-header-cell").boundingBox()
      expect(allDayBox!.y).toBeGreaterThanOrEqual(headerBox!.y + headerBox!.height)
      await spanning.focus()
      await page.keyboard.press("Enter")
      await expect(page.getByRole("dialog")).toContainText("Multi-day fixture")
      await page.keyboard.press("Escape")
      const rectangles = []
      for (const id of ["apt_2", "simultaneous_0", "simultaneous_1", "simultaneous_2"]) {
        const card = eventOf(page, id)
        await expect(card).toHaveCount(1)
        const rect = await card.evaluate((node) => ({ top: (node as HTMLElement).style.top, height: (node as HTMLElement).style.height, left: (node as HTMLElement).style.left, width: (node as HTMLElement).style.width }))
        expect(parseFloat(rect.width)).toBeGreaterThan(0)
        expect(parseFloat(rect.width)).toBeLessThan(100)
        rectangles.push(rect)
        if (id.startsWith("simultaneous")) {
          await card.locator(".clinic-time-event").focus()
          await page.keyboard.press("Enter")
          await expect(page.getByRole("dialog")).toContainText(`Overlap fixture ${id.slice(-1)}`)
          await page.keyboard.press("Escape")
        }
      }
      expect(new Set(rectangles.map((rect) => rect.top)).size).toBe(1)
      expect(new Set(rectangles.map((rect) => rect.left)).size).toBe(4)
      expect(parseFloat(rectangles[1].height) / parseFloat(rectangles[2].height)).toBeCloseTo(2, 3)
      expect(parseFloat(rectangles[2].height) / parseFloat(rectangles[3].height)).toBeCloseTo(2, 3)
      positions.push({ view, rectangles })
    }
    expect(await snapshot(page)).toBe(before)
    await testInfo.attach("simultaneous-native-rectangles", { body: JSON.stringify(positions, null, 2), contentType: "application/json" })
  })

  test(`all views fit eleven widths with expanded and collapsed navigation in ${theme}`, async ({ page }, testInfo) => {
    test.setTimeout(180000)
    await login(page, theme)
    const before = await snapshot(page)
    const records = []
    for (const width of widths) {
      await page.setViewportSize({ width, height: 1000 })
      for (const collapsed of [false, true]) {
        if (width >= 768) {
          const sidebar = page.locator(".clinic-app-sidebar")
          const toggle = page.locator(".clinic-app-header").getByRole("button", { name: /^(Abrir|Cerrar) menú$/ })
          if (await toggle.getAttribute("aria-expanded") === String(collapsed)) await toggle.click()
          await expect(sidebar).toHaveCSS("width", collapsed ? "72px" : "268px")
        } else if (!collapsed) {
          await page.getByRole("button", { name: "Abrir menú", exact: true }).click()
          await expect(page.locator(".clinic-app-sidebar-panel")).toBeVisible()
          expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
          await page.keyboard.press("Escape")
        }
        for (const view of ["month", "week", "day"] as const) {
          await chooseView(page, view)
          await expect(triggerOf(page)).toBeVisible()
          const trigger = await triggerOf(page).boundingBox()
          expect(trigger!.x).toBeGreaterThanOrEqual(0)
          expect(trigger!.x + trigger!.width).toBeLessThanOrEqual(width + 1)
          expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
          const frame = page.locator(".clinic-calendar-frame")
          if (view === "month") {
            await expect(page.locator(".rbc-month-row")).toHaveCount(6)
            await expect(page.locator(".rbc-month-header .rbc-header")).toHaveCount(7)
          } else if (await frame.isVisible()) {
            await expect(page.locator(".rbc-day-slot")).toHaveCount(view === "week" ? 7 : 1)
            const headers = page.locator(".rbc-time-header .rbc-header")
            expect((await headers.first().boundingBox())!.height).toBeGreaterThanOrEqual(52)
          } else await expect(page.getByRole("region", { name: view === "day" ? "Agenda diaria" : "Agenda semanal", exact: true })).toBeVisible()
          records.push({ width, collapsed, view, trigger })
          if ([320, 768, 1920].includes(width) && collapsed) await page.screenshot({ path: testInfo.outputPath(`${view}-${theme}-${width}.png`), animations: "disabled", fullPage: true })
        }
      }
    }
    expect(await snapshot(page)).toBe(before)
    await testInfo.attach("view-responsive-matrix", { body: JSON.stringify(records, null, 2), contentType: "application/json" })
  })
}
