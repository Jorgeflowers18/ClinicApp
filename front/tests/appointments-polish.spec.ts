import { expect, test, type Page } from "@playwright/test"
import { settleCalendarLayout } from "./helpers/calendar-layout"

test.use({ timezoneId: "America/Guayaquil", reducedMotion: "reduce" })
const widths = [320, 360, 375, 390, 430, 600, 768, 1024, 1280, 1440, 1920]
const dateTrigger = (page: Page) => page.getByRole("button", { name: /^Elegir fecha:/ })
const popup = (page: Page) => page.locator('[data-slot="popover-content"]')
const editor = (page: Page) => page.locator(".clinic-schedule-dialog")
async function login(page: Page, theme: string) {
  await page.clock.install({ time: new Date("2026-11-11T17:00:00Z") })
  await page.goto("/login")
  await page.getByRole("button", { name: theme === "light" ? "Tema claro" : "Tema oscuro", exact: true }).click()
  await page.locator("#email").fill("admin@clinica.com")
  await page.locator("#password").fill("admin123")
  await page.getByRole("button", { name: "Ingresar", exact: true }).click()
  await page.getByRole("button", { name: "Continuar", exact: true }).click()
  await expect(page).toHaveURL(/\/$/)
  await page.goto("/citas")
  await expect(dateTrigger(page)).toBeVisible()
}
async function view(page: Page, name: string) {
  const compact = page.getByLabel("Vista", { exact: true })
  if (await compact.isVisible()) { await compact.click(); await page.getByRole("option", { name, exact: true }).click() }
  else await page.locator(".rbc-toolbar").getByRole("button", { name, exact: true }).click()
}
async function choose(page: Page, id: string, name: string | RegExp) {
  await editor(page).locator(`#${id}`).click()
  await page.getByRole("option", { name, exact: typeof name === "string" }).click()
}
async function snapshot(page: Page) {
  return page.evaluate(async () => {
    const path = "/src/modules/appointments/api/appointments.mock-data.ts"
    const { mockAppointments, mockScheduleBlocks } = await import(path)
    return JSON.parse(JSON.stringify({ appointments: mockAppointments, blocks: mockScheduleBlocks }))
  })
}
async function editEvent(page: Page, id = "apt_4") {
  await view(page, "Semana")
  const target = page.locator(`[data-event-id="${id}"]`).filter({ visible: true }).first()
  await target.click()
  await page.getByRole("button", { name: "Editar / reprogramar", exact: true }).click()
  await expect(page.getByRole("dialog", { name: "Editar cita", exact: true })).toBeVisible()
}
async function fillTime(page: Page, date: string, start: string, end: string) {
  await editor(page).locator("#date").fill(date)
  await editor(page).locator("#startTime").fill(start)
  await editor(page).locator("#endTime").fill(end)
}
async function discard(page: Page) {
  await editor(page).getByRole("button", { name: "Cancelar", exact: true }).click()
  await page.getByRole("button", { name: "Descartar cambios", exact: true }).click()
  await expect(editor(page)).toHaveCount(0)
}

for (const theme of ["light", "dark"]) {
  test(`floating selector keeps page geometry, one date and focus at all widths in ${theme}`, async ({ page }, testInfo) => {
    await login(page, theme)
    const before = await snapshot(page)
    const geometry = []
    for (const width of widths) {
      await page.setViewportSize({ width, height: 1000 })
      for (const name of ["Mes", "Semana", "Día"]) {
        await view(page, name)
        const read = () => page.evaluate(() => ({ main: document.querySelector("main")!.scrollTop, scroll: document.querySelector("main")!.scrollHeight, body: document.documentElement.scrollHeight, top: document.querySelector('[data-calendar-date-trigger]')!.getBoundingClientRect().top }))
        const initial = await read()
        await dateTrigger(page).click()
        await expect(popup(page)).toBeVisible()
        expect(await read()).toEqual(initial)
        const bounds = (await popup(page).boundingBox())!
        expect(bounds.x).toBeGreaterThanOrEqual(0)
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(width + 1)
        expect(bounds.y).toBeGreaterThanOrEqual(0)
        expect(bounds.y + bounds.height).toBeLessThanOrEqual(1001)
        expect(bounds.width).toBeLessThanOrEqual(360)
        const anchor = (await dateTrigger(page).boundingBox())!
        if (1000 - anchor.y - anchor.height >= bounds.height + 8) await expect(popup(page)).toHaveAttribute("data-side", "bottom")
        expect(await popup(page).evaluate(node => !!node.closest("main"))).toBe(false)
        await expect(popup(page).locator('button[data-selected-single="true"]')).toHaveCount(1)
        await expect(popup(page).locator('[data-range-start="true"],[data-range-middle="true"],[data-range-end="true"]')).toHaveCount(0)
        if (width === 320 && name === "Mes") await page.getByRole("heading", { name: "Citas", exact: true }).click()
        else await page.keyboard.press("Escape")
        await expect(dateTrigger(page)).toBeFocused()
        expect(await read()).toEqual(initial)
        geometry.push({ width, name, bounds })
      }
    }
    await page.setViewportSize({ width: 844, height: 390 })
    await settleCalendarLayout(page)
    await dateTrigger(page).click()
    const bounds = (await popup(page).boundingBox())!
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(391)
    await popup(page).getByLabel("Año", { exact: true }).fill("2027")
    await popup(page).locator('[data-calendar-date-footer]').getByRole("button", { name: "Hoy", exact: true }).click()
    await expect(dateTrigger(page)).toHaveAccessibleName("Elegir fecha: 11 de noviembre de 2026")
    expect(await snapshot(page)).toEqual(before)
    await testInfo.attach("floating-popover-geometry", { body: JSON.stringify(geometry), contentType: "application/json" })
  })

  test(`time and compact agenda scroll locally while native durations remain proportional in ${theme}`, async ({ page }, testInfo) => {
    await login(page, theme)
    const before = await snapshot(page)
    const geometry = []
    for (const width of [375, 768, 1024, 1440, 1920]) {
      await page.setViewportSize({ width, height: 900 })
      for (const name of ["Semana", "Día"]) {
        await view(page, name)
        const main = await page.locator("main").evaluate(node => ({ top: node.scrollTop, extra: node.scrollHeight - node.clientHeight }))
        expect(main.extra).toBeLessThanOrEqual(2)
        const grid = page.locator(".rbc-time-content")
        const scroller = await grid.isVisible() ? grid : page.locator(".clinic-compact-agenda")
        const toolbar = await dateTrigger(page).boundingBox()
        await scroller.evaluate(node => node.scrollTop = node.scrollHeight)
        expect(await page.locator("main").evaluate(node => node.scrollTop)).toBe(main.top)
        expect((await dateTrigger(page).boundingBox())!.y).toBe(toolbar!.y)
        if (await grid.isVisible()) {
          await expect(page.locator(".rbc-time-gutter .rbc-label")).toHaveCount(24)
          const rect = await page.locator('.rbc-day-slot [data-event-id="apt_1"]').evaluate(node => node.closest(".rbc-event")!.getBoundingClientRect().height)
          expect(rect).toBeCloseTo(36, 0)
          geometry.push({ width, name, halfHourHeight: rect })
        }
        await expect(page.getByRole("list", { name: "Estados de citas y bloqueos" })).toBeInViewport()
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
      }
    }
    expect(await snapshot(page)).toEqual(before)
    await testInfo.attach("local-scroll-and-duration", { body: JSON.stringify(geometry), contentType: "application/json" })
  })

  test(`three editors share compact columns and fixed actions at eleven widths in ${theme}`, async ({ page }, testInfo) => {
    test.setTimeout(180000)
    await login(page, theme)
    const before = await snapshot(page)
    const records = []
    for (const mode of ["new", "edit", "block"]) {
      await page.setViewportSize({ width: 1440, height: 900 })
      if (mode === "edit") await editEvent(page)
      else await page.getByRole("button", { name: mode === "new" ? "Nueva cita" : "Bloquear horario", exact: true }).click()
      for (const width of widths) {
        await page.setViewportSize({ width, height: 900 })
        const modal = editor(page)
        const box = (await modal.boundingBox())!
        expect(Math.round(box.width)).toBe(width < 768 ? width : Math.min(860, width - 48))
        expect(box.y).toBeGreaterThanOrEqual(-1)
        expect(box.y + box.height).toBeLessThanOrEqual(901)
        const footer = modal.locator("[data-form-actions]")
        await expect(footer).toHaveCSS("position", "static")
        await expect(footer).toHaveCSS("border-radius", "0px")
        await expect(footer.getByRole("button").last()).toBeInViewport()
        if (width < 768) {
          const bounds = (await footer.boundingBox())!
          expect(Math.abs(bounds.y + bounds.height - 900)).toBeLessThanOrEqual(1)
        }
        const outside = await modal.locator("input,textarea,[data-slot=select-trigger]").evaluateAll(nodes => nodes.filter(node => {
          const rect = node.getBoundingClientRect(), bounds = node.closest(".clinic-schedule-dialog")!.getBoundingClientRect()
          return rect.left < bounds.left - 1 || rect.right > bounds.right + 1
        }).map(node => node.id))
        expect(outside).toEqual([])
        const controls = await modal.locator("input,[data-slot=select-trigger]").evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().height))
        expect(Math.min(...controls)).toBeGreaterThanOrEqual(width < 1024 ? 44 : 40)
        if (width >= 768) {
          const times = await modal.locator(".clinic-schedule-times input").evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().top))
          expect(new Set(times).size).toBe(1)
          if (mode !== "block") {
            const first = await modal.locator("#patientId").boundingBox(), second = await modal.locator("#professionalId").boundingBox()
            expect(first!.y).toBe(second!.y)
          }
        }
        records.push({ mode, width })
      }
      await editor(page).getByRole("button", { name: "Cancelar", exact: true }).click()
      await expect(editor(page)).toHaveCount(0)
    }
    expect(await snapshot(page)).toEqual(before)
    await testInfo.attach("editor-responsive-matrix", { body: JSON.stringify(records), contentType: "application/json" })
  })

  test(`appointment creation, conflicts and editing keep identifiers, duration and status in ${theme}`, async ({ page }) => {
    await login(page, theme)
    const before = await snapshot(page)
    await page.getByRole("button", { name: "Nueva cita", exact: true }).click()
    await editor(page).getByRole("button", { name: "Agendar cita", exact: true }).click()
    await expect(editor(page)).toContainText("Selecciona un paciente")
    await expect(editor(page)).toContainText("Selecciona un profesional")
    await choose(page, "patientId", "María González")
    await choose(page, "professionalId", /Dra\. Carla Ríos/)
    await choose(page, "roomId", "Consultorio 1")
    await fillTime(page, "2026-11-11", "09:00", "09:30")
    await choose(page, "treatmentId", /Limpieza dental/)
    await expect(editor(page).locator("#endTime")).toHaveValue("09:30")
    await editor(page).locator("#notes").fill("Borrador conservado")
    await editor(page).getByRole("button", { name: "Agendar cita", exact: true }).click()
    await expect(page.getByText("El profesional ya tiene una cita agendada en ese horario", { exact: true })).toBeVisible()
    await expect(editor(page)).toBeVisible()
    await expect(editor(page).locator("#notes")).toHaveValue("Borrador conservado")
    expect(await snapshot(page)).toEqual(before)
    await fillTime(page, "2026-11-11", "10:00", "10:30")
    await editor(page).getByRole("button", { name: "Agendar cita", exact: true }).click()
    await expect(editor(page)).toHaveCount(0)
    const created = (await snapshot(page)).appointments.find((item: { id: string }) => !before.appointments.some((old: { id: string }) => old.id === item.id))
    expect(created).toMatchObject({ patientId: "pat_1", professionalId: "prof_1", treatmentId: "trt_1", roomId: "room_1", status: "programada", notes: "Borrador conservado" })
    expect(+new Date(created.end) - +new Date(created.start)).toBe(30 * 60000)
    await editEvent(page, "apt_1")
    await expect(editor(page).locator("#patientId")).toContainText("María González")
    await expect(editor(page).locator('#professionalId [data-slot="select-value"]')).toHaveText("Dra. Carla Ríos")
    await expect(editor(page).locator('#treatmentId [data-slot="select-value"]')).toHaveText("Limpieza dental")
    await expect(editor(page).locator('#roomId [data-slot="select-value"]')).toHaveText("Consultorio 1")
    await editor(page).locator("#notes").fill("Actualización de prueba")
    await editor(page).getByRole("button", { name: "Guardar cambios", exact: true }).click()
    await expect(editor(page)).toHaveCount(0)
    const after = await snapshot(page)
    expect(after.appointments.find((item: { id: string }) => item.id === "apt_1")).toEqual({ ...before.appointments[0], notes: "Actualización de prueba" })
    expect(after.appointments.filter((item: { id: string }) => item.id !== "apt_1" && item.id !== created.id)).toEqual(before.appointments.slice(1))
    expect(after.blocks).toEqual(before.blocks)
  })

  test(`block forms preserve professional and room conflict rules and optional scopes in ${theme}`, async ({ page }) => {
    await login(page, theme)
    const before = await snapshot(page)
    await page.getByRole("button", { name: "Bloquear horario", exact: true }).click()
    await fillTime(page, "2026-11-11", "09:00", "09:30")
    await editor(page).locator("#reason").fill("Prueba de bloqueo")
    await editor(page).getByRole("button", { name: "Bloquear horario", exact: true }).click()
    await expect(editor(page)).toContainText("Selecciona un profesional o un consultorio")
    await choose(page, "professionalId", /Dra\. Carla Ríos/)
    await editor(page).getByRole("button", { name: "Bloquear horario", exact: true }).click()
    await expect(page.getByText("El profesional tiene una cita agendada en ese horario", { exact: true })).toBeVisible()
    await expect(editor(page).locator("#reason")).toHaveValue("Prueba de bloqueo")
    expect(await snapshot(page)).toEqual(before)
    // The existing rules allow blocks to overlap other blocks.
    await fillTime(page, "2026-11-11", "13:15", "13:45")
    await editor(page).getByRole("button", { name: "Bloquear horario", exact: true }).click()
    await expect(editor(page)).toHaveCount(0)
    const added = (await snapshot(page)).blocks.find((item: { id: string }) => !before.blocks.some((old: { id: string }) => old.id === item.id))
    expect(added).toMatchObject({ professionalId: "prof_1", reason: "Prueba de bloqueo" })
    expect(added.roomId).toBeUndefined()
    await page.getByRole("button", { name: "Nueva cita", exact: true }).click()
    await choose(page, "patientId", "María González")
    await choose(page, "professionalId", /Dra\. Carla Ríos/)
    await fillTime(page, "2026-11-11", "13:15", "13:45")
    await editor(page).getByRole("button", { name: "Agendar cita", exact: true }).click()
    await expect(page.getByText("El profesional tiene un bloqueo de horario en ese rango", { exact: true })).toBeVisible()
    await discard(page)
    await page.getByRole("button", { name: "Bloquear horario", exact: true }).click()
    await choose(page, "roomId", "Consultorio 3")
    await fillTime(page, "2026-11-12", "16:00", "16:30")
    await editor(page).locator("#reason").fill("Solo consultorio")
    await editor(page).getByRole("button", { name: "Bloquear horario", exact: true }).click()
    await expect(editor(page)).toHaveCount(0)
    const after = await snapshot(page)
    expect(after.appointments).toEqual(before.appointments)
    expect(after.blocks).toHaveLength(before.blocks.length + 2)
    expect(after.blocks.at(-1)).toMatchObject({ roomId: "room_3", reason: "Solo consultorio" })
    expect(after.blocks.at(-1).professionalId).toBeUndefined()
  })

  test(`all draft dismissal paths retain values and readable long labels in ${theme}`, async ({ page }) => {
    await login(page, theme)
    const before = await snapshot(page)
    const longName = "Dra. Paula Nieto, especialista en endodoncia y rehabilitación oral integral de pacientes adultos"
    await page.evaluate(async name => {
      const path = "/src/modules/appointments/api/appointments.mock-data.ts"
      const { mockProfessionals } = await import(path)
      mockProfessionals.find((item: { id: string }) => item.id === "prof_3").name = name
    }, longName)
    for (const mode of ["new", "edit", "block"]) {
      if (mode === "edit") await editEvent(page)
      else await page.getByRole("button", { name: mode === "new" ? "Nueva cita" : "Bloquear horario", exact: true }).click()
      if (mode === "edit") {
        await expect(editor(page).locator('#professionalId [data-slot="select-value"]')).toHaveText(longName)
        await expect(editor(page).locator('#professionalId [data-slot="select-value"]')).toHaveCSS("-webkit-line-clamp", "none")
        await expect(editor(page).locator('#treatmentId [data-slot="select-value"]')).toHaveText("Endodoncia")
      }
      const field = editor(page).locator(mode === "block" ? "#reason" : "#notes")
      await field.fill("Borrador por conservar")
      for (const way of ["cancel", "escape", "close", "outside"]) {
        if (way === "cancel") await editor(page).getByRole("button", { name: "Cancelar", exact: true }).click()
        if (way === "escape") await page.keyboard.press("Escape")
        if (way === "close") await editor(page).getByRole("button", { name: /^Cerrar / }).click()
        if (way === "outside") await page.mouse.click(8, 8)
        await expect(page.getByRole("alertdialog", { name: "¿Descartar los cambios?", exact: true })).toBeVisible()
        await page.getByRole("button", { name: "Continuar editando", exact: true }).click()
        await expect(field).toHaveValue("Borrador por conservar")
      }
      await discard(page)
    }
    expect(await snapshot(page)).toEqual(before)
  })
}
