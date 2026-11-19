import { setAccessTheme } from "./helpers/access-theme"
import { expect, test, type Page } from "@playwright/test"
import { settleCalendarLayout } from "./helpers/calendar-layout"
import { calendarColor, calendarContrast } from "./helpers/calendar-colors"

test.use({ timezoneId: "America/Guayaquil", reducedMotion: "reduce" })
const widths = [320, 360, 375, 390, 430, 600, 768, 1024, 1280, 1440, 1920]
const toolbar = (page: Page) => page.locator(".rbc-toolbar")
const professional = (page: Page) => page.getByRole("combobox", { name: "Profesional", exact: true })
const specialty = (page: Page) => page.getByRole("combobox", { name: "Especialidad", exact: true })
const menu = (page: Page) => page.getByRole("listbox")
const trigger = (page: Page) => page.getByRole("button", { name: /^Elegir fecha:/ })
async function login(page: Page, theme: string) {
  await page.clock.install({ time: new Date("2026-11-11T17:00:00Z") })
  await page.goto("/login")
  await setAccessTheme(page, theme === "light" ? "light" : "dark")
  await page.locator("#email").fill("admin@clinica.com")
  await page.locator("#password").fill("admin123")
  await page.getByRole("button", { name: "Ingresar", exact: true }).click()
  await page.getByRole("button", { name: "Continuar", exact: true }).click()
  await expect(page).toHaveURL(/\/$/)
  await page.goto("/citas")
  await expect(professional(page)).toBeVisible()
}
async function snapshot(page: Page) {
  return page.evaluate(async () => {
    const path = "/src/modules/appointments/api/appointments.mock-data.ts"
    const { mockAppointments, mockScheduleBlocks, mockProfessionals } = await import(path)
    return JSON.parse(JSON.stringify({ appointments: mockAppointments, blocks: mockScheduleBlocks, professionals: mockProfessionals }))
  })
}
async function selectProfessional(page: Page, name: string) {
  await professional(page).click()
  await page.getByRole("option", { name: new RegExp(`^${name}`) }).click()
  await expect(menu(page)).toHaveCount(0)
}
async function selectSpecialty(page: Page, name: string) {
  await specialty(page).click()
  await page.getByRole("option", { name, exact: true }).click()
}
async function chooseView(page: Page, name: string) {
  await toolbar(page).getByRole("button", { name, exact: true }).click()
}

for (const theme of ["light", "dark"]) {
  test(`professional options keep hierarchy, stable trigger width, selection and keyboard in ${theme}`, async ({ page }, testInfo) => {
    await login(page, theme)
    const before = await snapshot(page)
    const width = (await professional(page).boundingBox())!.width
    await expect(toolbar(page).getByRole("button", { name: "Restablecer filtros", exact: true })).toBeDisabled()
    for (const [name, field] of [["Dra. Carla Ríos", "Odontología general"], ["Dr. Andrés Vega", "Ortodoncia"], ["Dra. Paula Nieto", "Endodoncia"]]) {
      await professional(page).click()
      const option = page.getByRole("option", { name: `${name}, ${field}`, exact: true })
      await expect(option.locator(".clinic-calendar-professional-name")).toHaveText(name)
      await expect(option.locator(".clinic-calendar-professional-specialty")).toHaveText(field)
      expect((await option.boundingBox())!.height).toBeGreaterThanOrEqual(52)
      await expect(option.locator(".clinic-calendar-professional-name")).toHaveCSS("white-space", "normal")
      await option.click()
      await expect(professional(page).locator('[data-slot="select-value"]')).toHaveText(name)
      expect((await professional(page).boundingBox())!.width).toBe(width)
      await professional(page).click()
      const checked = page.getByRole("option", { name: `${name}, ${field}`, exact: true })
      await expect(checked).toHaveAttribute("aria-selected", "true")
      await expect(checked).toHaveCSS("box-shadow", /inset/)
      expect((await checked.locator("svg").boundingBox())!.x).toBeGreaterThan((await checked.locator(".clinic-calendar-professional-name").boundingBox())!.x)
      await page.keyboard.press("Escape")
      await expect(professional(page)).toBeFocused()
    }
    await toolbar(page).getByRole("button", { name: "Restablecer filtros", exact: true }).click()
    await professional(page).focus()
    await page.keyboard.press("ArrowDown")
    await expect(menu(page)).toBeVisible()
    await page.keyboard.press("ArrowDown")
    await page.keyboard.press("Enter")
    await expect(menu(page)).toHaveCount(0)
    await expect(professional(page)).toBeFocused()
    await professional(page).click()
    const outside = (await page.getByRole("heading", { name: "Citas", exact: true }).boundingBox())!
    await page.mouse.click(outside.x + 4, outside.y + 4)
    await expect(menu(page)).toHaveCount(0)
    expect(await snapshot(page)).toEqual(before)
    await testInfo.attach("professional-values", { body: JSON.stringify(before.professionals), contentType: "application/json" })
  })

  test(`specialty uses registered data and explicitly confirms incompatible selections in ${theme}`, async ({ page }) => {
    await login(page, theme)
    const before = await snapshot(page)
    const date = await trigger(page).getAttribute("aria-label")
    await specialty(page).click()
    expect(await page.getByRole("option").allTextContents()).toEqual(["Todas las especialidades", ...new Set(before.professionals.map((item: { specialty: string }) => item.specialty))])
    await page.getByRole("option", { name: "Ortodoncia", exact: true }).click()
    await professional(page).click()
    await expect(page.getByRole("option")).toHaveCount(2)
    await page.getByRole("option", { name: /^Dr\. Andrés Vega/ }).click()
    await expect(page.locator('.clinic-time-event[data-event-id="apt_2"]')).toBeVisible()
    await expect(page.locator('.clinic-time-event[data-event-id="apt_1"]')).toHaveCount(0)
    await selectSpecialty(page, "Todas las especialidades")
    await expect(professional(page).locator('[data-slot="select-value"]')).toHaveText("Dr. Andrés Vega")
    await selectSpecialty(page, "Endodoncia")
    const confirm = page.getByRole("alertdialog", { name: "Cambiar filtro de especialidad", exact: true })
    await expect(confirm).toContainText("Dr. Andrés Vega")
    await confirm.getByRole("button", { name: "Conservar profesional", exact: true }).click()
    await expect(specialty(page).locator('[data-slot="select-value"]')).toHaveText("Todas las especialidades")
    await expect(professional(page).locator('[data-slot="select-value"]')).toHaveText("Dr. Andrés Vega")
    await selectSpecialty(page, "Endodoncia")
    await confirm.getByRole("button", { name: "Cambiar especialidad", exact: true }).click()
    await expect(professional(page).locator('[data-slot="select-value"]')).toHaveText("Todos los profesionales")
    await expect(specialty(page).locator('[data-slot="select-value"]')).toHaveText("Endodoncia")
    await expect(page.locator('.clinic-time-event[data-event-id="apt_4"]')).toHaveCount(1)
    await expect(page.locator('.clinic-time-event[data-event-id="apt_2"]')).toHaveCount(0)
    // A room-only block is not assigned an invented specialty.
    await expect(page.locator('.clinic-time-event[data-event-id="blk_2"]')).toHaveCount(1)
    await selectProfessional(page, "Dra. Paula Nieto")
    await expect(page.locator('.clinic-time-event[data-event-id="blk_2"]')).toHaveCount(0)
    await toolbar(page).getByRole("button", { name: "Restablecer filtros", exact: true }).click()
    await expect(specialty(page).locator('[data-slot="select-value"]')).toHaveText("Todas las especialidades")
    await expect(page.locator('.clinic-time-event[data-event-id="apt_2"]')).toHaveCount(1)
    await expect(trigger(page)).toHaveAttribute("aria-label", date!)
    await expect(toolbar(page).getByRole("button", { name: "Semana", exact: true })).toHaveAttribute("aria-pressed", "true")
    expect(await snapshot(page)).toEqual(before)
  })

  test(`long names remain accessible and missing specialties do not create invented categories in ${theme}`, async ({ page }, testInfo) => {
    await login(page, theme)
    const before = await snapshot(page)
    const name = "Dra. Carla Ríos, especialista en rehabilitación oral integral y atención odontológica avanzada"
    await page.evaluate(async name => {
      const source = "/src/modules/appointments/api/appointments.mock-data.ts", client = "/src/shared/lib/query-client.ts"
      const [{ mockProfessionals }, { queryClient }] = await Promise.all([import(source), import(client)])
      queryClient.setQueryData(["professionals"], mockProfessionals.map((item: { id: string }) => item.id === "prof_1" ? { ...item, name } : { ...item }))
    }, name)
    await selectProfessional(page, name)
    await expect(professional(page).locator('[data-slot="select-value"]')).toHaveText(name)
    await professional(page).focus()
    await page.mouse.move(0, 0)
    await professional(page).hover()
    await expect(page.getByRole("tooltip").filter({ hasText: name })).toBeVisible()
    await professional(page).click()
    const option = page.getByRole("option", { name: `${name}, Odontología general`, exact: true })
    expect(await option.locator(".clinic-calendar-professional-name").evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true)
    await expect(option.locator(".clinic-calendar-professional-name")).toHaveCSS("white-space", "normal")
    const box = (await menu(page).boundingBox())!
    expect(box.width).toBeGreaterThanOrEqual(280)
    expect(box.width).toBeLessThanOrEqual(360)
    await page.screenshot({ path: testInfo.outputPath(`long-name-${theme}.png`) })
    await page.keyboard.press("Escape")
    await toolbar(page).getByRole("button", { name: "Restablecer filtros", exact: true }).click()
    await page.evaluate(async () => {
      const source = "/src/modules/appointments/api/appointments.mock-data.ts", client = "/src/shared/lib/query-client.ts"
      const [{ mockProfessionals }, { queryClient }] = await Promise.all([import(source), import(client)])
      queryClient.setQueryData(["professionals"], mockProfessionals.map((item: object) => ({ ...item, specialty: "" })))
    })
    await expect(specialty(page)).toHaveCount(0)
    await professional(page).click()
    await expect(page.getByRole("option")).toHaveCount(4)
    await expect(menu(page).locator(".clinic-calendar-professional-specialty")).toHaveCount(0)
    expect(await snapshot(page)).toEqual(before)
  })

  test(`toolbar and anchored menus fit eleven widths and both sidebar states in ${theme}`, async ({ page }, testInfo) => {
    test.setTimeout(180000)
    await login(page, theme)
    const before = await snapshot(page), measurements = []
    for (const width of widths) {
      await page.setViewportSize({ width, height: 1000 })
      await settleCalendarLayout(page)
      for (const collapsed of width >= 768 ? [false, true] : [false]) {
        if (width >= 768) {
          const nav = page.locator('.clinic-app-header [data-sidebar-toggle]')
          if (await nav.getAttribute("aria-expanded") === String(collapsed)) await nav.click()
          await settleCalendarLayout(page)
        }
        await expect(toolbar(page)).toHaveCount(1)
        await expect(trigger(page)).toHaveCount(1)
        const outside = await toolbar(page).locator("button").evaluateAll(nodes => nodes.filter(node => {
          const box = node.getBoundingClientRect()
          return box.width > 0 && (box.left < 0 || box.right > innerWidth + 1)
        }).map(node => node.id || node.textContent))
        expect(outside).toEqual([])
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
        await professional(page).click()
        const box = (await menu(page).boundingBox())!
        expect(box.x).toBeGreaterThanOrEqual(0)
        expect(box.x + box.width).toBeLessThanOrEqual(width + 1)
        expect(box.y + box.height).toBeLessThanOrEqual(1001)
        expect(await menu(page).evaluate(node => !!node.closest("main"))).toBe(false)
        await page.keyboard.press("Escape")
        measurements.push({ width, collapsed, menu: box })
      }
    }
    await page.setViewportSize({ width: 1920, height: 1000 })
    await settleCalendarLayout(page)
    const centers = await toolbar(page).locator('.clinic-calendar-filters,.clinic-calendar-navigation,.rbc-toolbar-label,.clinic-calendar-views').evaluateAll(nodes => nodes.map(node => { const box = node.getBoundingClientRect(); return box.y + box.height / 2 }))
    expect(Math.max(...centers) - Math.min(...centers)).toBeLessThanOrEqual(1)
    for (const name of ["Mes", "Día", "Semana"]) {
      await chooseView(page, name)
      await expect(toolbar(page).getByRole("button", { name, exact: true })).toHaveAttribute("aria-pressed", "true")
      await expect(toolbar(page).getByRole("button", { name, exact: true })).toHaveCSS("box-shadow", /2px/)
    }
    expect(await snapshot(page)).toEqual(before)
    await testInfo.attach("toolbar-menu-matrix", { body: JSON.stringify(measurements), contentType: "application/json" })
  })

  test(`all semantic states use consistent colors and native durations across every presentation in ${theme}`, async ({ page }, testInfo) => {
    await login(page, theme)
    const states = ["programada", "confirmada", "completada", "cancelada", "no_asistio"]
    await page.evaluate(async states => {
      const source = "/src/modules/appointments/api/appointments.mock-data.ts", client = "/src/shared/lib/query-client.ts"
      const [{ mockAppointments }, { queryClient }] = await Promise.all([import(source), import(client)])
      for (const [index, status] of states.entries()) {
        const start = new Date(2026, 10, 11, 8 + index)
        mockAppointments.push({ id: `palette_${status}`, patientId: "pat_1", professionalId: "prof_1", start: start.toISOString(), end: new Date(+start + 1800000).toISOString(), status, createdAt: start.toISOString() })
      }
      await queryClient.invalidateQueries({ queryKey: ["appointments"] })
    }, states)
    const before = await snapshot(page), colors: Record<string, number[]> = {}
    const reference: Record<string, number[]> = { programada: [34, 211, 238], confirmada: [34, 211, 238], completada: [52, 211, 153], cancelada: [251, 113, 133], no_asistio: [251, 191, 36], block: [161, 161, 170] }
    for (const name of ["Semana", "Día"]) {
      await chooseView(page, name)
      for (const state of [...states, "block"]) {
        const id = state === "block" ? "blk_1" : `palette_${state}`
        const card = page.locator(`.rbc-day-slot .rbc-event:has([data-event-id="${id}"])`)
        await expect(card).toHaveCount(1)
        const color = await calendarColor(card)
        if (name === "Semana") colors[state] = color
        else expect(color).toEqual(colors[state])
        if (theme === "dark") expect(color).toEqual(reference[state])
        if (state !== "block") expect((await card.boundingBox())!.height).toBeCloseTo(36, 0)
        expect(calendarContrast(await calendarColor(card, "color"), await calendarColor(card, "background-color"))).toBeGreaterThanOrEqual(4.5)
      }
    }
    expect(colors.programada[1]).toBeGreaterThan(colors.programada[0] + 50)
    expect(colors.completada[1]).toBeGreaterThan(colors.completada[0] + 40)
    expect(colors.cancelada[0]).toBeGreaterThan(colors.cancelada[1] + 20)
    expect(colors.no_asistio[1]).toBeGreaterThan(colors.no_asistio[2] + 40)
    await chooseView(page, "Mes")
    const header = page.locator('.clinic-month-date[data-date="2026-11-11"]')
    await header.scrollIntoViewIfNeeded()
    const bounds = (await header.boundingBox())!
    const more = page.locator(".rbc-show-more")
    const index = await more.evaluateAll((nodes, bounds) => nodes.findIndex(node => { const box = node.getBoundingClientRect(); return box.x >= bounds.x - 7 && box.x < bounds.x + bounds.width && box.y > bounds.y && box.y < bounds.y + 128 }), bounds)
    expect(index).toBeGreaterThanOrEqual(0)
    await more.nth(index).click()
    for (const state of [...states, "block"]) {
      const id = state === "block" ? "blk_1" : `palette_${state}`
      const card = page.locator(`.rbc-overlay .rbc-event:has([data-event-id="${id}"])`)
      expect(await calendarColor(card)).toEqual(colors[state])
    }
    await page.getByRole("heading", { name: "Citas", exact: true }).click()
    await page.setViewportSize({ width: 375, height: 1000 })
    await settleCalendarLayout(page)
    await chooseView(page, "Día")
    for (const state of [...states, "block"]) {
      const id = state === "block" ? "blk_1" : `palette_${state}`
      expect(await calendarColor(page.locator(`.clinic-agenda-event[data-event-id="${id}"] [data-slot="card"]`))).toEqual(colors[state])
    }
    await expect(page.locator('.clinic-agenda-event[data-event-id="blk_1"] [data-slot="card"]')).toHaveCSS("background-image", /repeating-linear-gradient/)
    await expect(page.getByRole("list", { name: "Estados de citas y bloqueos" }).locator("li")).toHaveCount(5)
    expect(await snapshot(page)).toEqual(before)
    await testInfo.attach("state-colors", { body: JSON.stringify(colors), contentType: "application/json" })
  })
}
