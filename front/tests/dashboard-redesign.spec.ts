import { setAccessTheme } from "./helpers/access-theme"
import { expect, test, type Page } from "@playwright/test"

test.use({ timezoneId: "America/Guayaquil" })
const widths = [320, 375, 430, 768, 1024, 1280, 1440, 1920]
const cards = (page: Page) => page.locator(".clinic-dashboard-page .clinic-kpi-card")
const chart = (page: Page) => page.getByRole("region", { name: "Citas del mes", exact: true })

async function login(page: Page, theme: "light" | "dark", beforeDashboard?: () => Promise<void>) {
  await page.goto("/login")
  await setAccessTheme(page, theme === "light" ? "light" : "dark")
  await page.locator("#email").fill("admin@clinica.com")
  await page.locator("#password").fill("admin123")
  await page.getByRole("button", { name: "Ingresar", exact: true }).click()
  if (beforeDashboard) await beforeDashboard()
  await page.getByRole("button", { name: "Continuar", exact: true }).click()
  await expect(page.locator(".clinic-dashboard-page")).toBeVisible()
}

async function sourceData(page: Page) {
  return page.evaluate(async () => {
    const path = "/src/modules/reports/api/reports.api.ts"
    const periodPath = "/src/modules/reports/lib/period.ts"
    const [{ reportsApi }, { getPresetPeriod }] = await Promise.all([import(path), import(periodPath)])
    const period = getPresetPeriod("month")
    const [summary, agenda] = await Promise.all([reportsApi.getSummary(period), reportsApi.getAgenda(period)])
    return { summary, byDay: agenda.byDay as { date: string; label: string; total: number }[] }
  })
}

for (const theme of ["light", "dark"] as const) {
  test(`Dashboard keeps source totals, equal KPI geometry and readable daily chart at eight widths in ${theme}`, async ({ page }, testInfo) => {
    const errors: string[] = []
    page.on("pageerror", (error) => errors.push(error.message))
    await login(page, theme)
    const source = await sourceData(page)
    const values = [source.summary.patientsTotal, source.summary.appointmentsInPeriod, source.summary.activeTreatments, source.summary.criticalStockItems].map(String)
    await expect(cards(page).locator(".clinic-kpi-value")).toHaveText(values)
    await expect(cards(page).nth(1).locator(".clinic-kpi-hint")).toHaveText(`${source.summary.appointmentsCompleted} ${source.summary.appointmentsCompleted === 1 ? "completada" : "completadas"}`)
    await expect(chart(page)).toContainText(`${source.summary.appointmentsInPeriod}citas en el mes`)
    const primary = theme === "light" ? "rgb(83, 80, 204)" : "rgb(228, 242, 34)"
    await expect(cards(page).nth(1).locator(".clinic-summary-icon")).toHaveCSS("color", primary)
    await expect(cards(page).nth(2)).toHaveAttribute("data-icon-tone", "success")
    await expect(cards(page).nth(3)).toHaveAttribute("data-icon-tone", "warning")
    const positiveDays = source.byDay.filter(day => day.total > 0)
    const bars = chart(page).locator(".recharts-bar-rectangle path")
    await expect(bars).toHaveCount(positiveDays.length)
    await expect(bars.first()).toHaveCSS("fill", primary)
    for (const [index, day] of positiveDays.entries()) {
      await bars.nth(index).hover()
      await expect(chart(page).locator(".recharts-tooltip-item-value")).toHaveText(String(day.total))
      await expect(chart(page).locator(".recharts-tooltip-item-name")).toHaveText(day.total === 1 ? "Cita" : "Citas")
      await expect(chart(page).locator(".recharts-tooltip-label")).toContainText(new Date(`${day.date}T12:00:00`).toLocaleDateString("es-EC", { day: "numeric", month: "long" }))
    }
    const measurements = []
    for (const width of widths) {
      await page.setViewportSize({ width, height: 1000 })
      await page.locator("main").evaluate(node => node.scrollTop = 0)
      await expect.poll(async () => cards(page).evaluateAll(nodes => Math.max(...nodes.map(node => node.getBoundingClientRect().height)) - Math.min(...nodes.map(node => node.getBoundingClientRect().height)))).toBeLessThan(.5)
      const layout = await cards(page).evaluateAll(nodes => nodes.map(node => {
        const box = node.getBoundingClientRect()
        const label = node.querySelector(".clinic-kpi-label")!.getBoundingClientRect()
        const icon = node.querySelector(".clinic-summary-icon")!.getBoundingClientRect()
        const value = node.querySelector(".clinic-kpi-value")!.getBoundingClientRect()
        const hint = node.querySelector(".clinic-kpi-hint")?.getBoundingClientRect()
        const clipped = [...node.querySelectorAll<HTMLElement>(".clinic-kpi-label, .clinic-kpi-value, .clinic-kpi-hint")].some(child => child.scrollWidth > child.clientWidth + 1)
        return { x: box.x, height: box.height, labelCenter: label.y + label.height / 2, iconCenter: icon.y + icon.height / 2, valueX: value.x, labelX: label.x, rightPadding: box.right - icon.right, hintRight: hint ? icon.right - hint.right : 0, hintBottom: hint ? value.bottom - hint.bottom : 0, clipped }
      }))
      expect(new Set(layout.map(card => card.x)).size).toBe(width < 768 ? 1 : width < 1280 ? 2 : 4)
      for (const item of layout) {
        expect(item.clipped).toBe(false)
        expect(item.labelCenter).toBeCloseTo(item.iconCenter, 0)
        expect(item.valueX).toBeCloseTo(item.labelX, 1)
        expect(item.rightPadding).toBeCloseTo(17, 0)
        expect(Math.abs(item.hintRight)).toBeLessThan(1)
        expect(Math.abs(item.hintBottom)).toBeLessThan(4)
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
      await chart(page).scrollIntoViewIfNeeded()
      const ticks = await chart(page).locator(".recharts-xAxis .recharts-cartesian-axis-tick-value").evaluateAll(nodes => nodes.map(node => ({ left: node.getBoundingClientRect().left, right: node.getBoundingClientRect().right })))
      for (let index = 1; index < ticks.length; index++) expect(ticks[index].left).toBeGreaterThan(ticks[index - 1].right)
      await bars.first().hover()
      await expect(chart(page).locator(".recharts-tooltip-item-value")).toHaveText(String(positiveDays[0].total))
      const tooltip = chart(page).locator(".recharts-default-tooltip")
      await expect(tooltip).toBeVisible()
      await expect.poll(async () => { const box = (await tooltip.boundingBox())!; return box.x >= 0 && box.x + box.width <= width + 1 }).toBe(true)
      measurements.push({ width, cards: layout, ticks })
    }
    await page.setViewportSize({ width: 1440, height: 1000 })
    await chart(page).locator(".recharts-surface").focus()
    await page.keyboard.press("ArrowRight")
    await expect(chart(page).locator(".recharts-tooltip-item-value")).toBeVisible()
    await page.getByRole("button", { name: "Ver reportes", exact: true }).click()
    await expect(page).toHaveURL(/\/reportes$/)
    await expect(page.getByRole("tab", { name: "Agenda", exact: true })).toBeVisible()
    expect(errors).toEqual([])
    await testInfo.attach("dashboard-responsive-and-data", { body: JSON.stringify({ values, dailyData: source.byDay, measurements }, null, 2), contentType: "application/json" })
  })

  test(`Dashboard handles singular, plural, no stock alert and an empty month from the existing data source in ${theme}`, async ({ page }) => {
    await login(page, theme)
    await expect(cards(page).nth(1).locator(".clinic-kpi-hint")).toHaveText("1 completada")
    await page.evaluate(async () => {
      const appointmentsPath = "/src/modules/appointments/api/appointments.mock-data.ts"
      const clientPath = "/src/shared/lib/query-client.ts"
      const [{ mockAppointments }, { queryClient }] = await Promise.all([import(appointmentsPath), import(clientPath)])
      mockAppointments.forEach((appointment: { status: string }, index: number) => appointment.status = index < 2 ? "completada" : "programada")
      await queryClient.invalidateQueries({ queryKey: ["reports"] })
    })
    await expect(cards(page).nth(1).locator(".clinic-kpi-hint")).toHaveText("2 completadas")
    await page.evaluate(async () => {
      const appointmentsPath = "/src/modules/appointments/api/appointments.mock-data.ts"
      const inventoryPath = "/src/modules/inventory/api/inventory.mock-data.ts"
      const clientPath = "/src/shared/lib/query-client.ts"
      const [{ mockAppointments }, { mockInventoryItems }, { queryClient }] = await Promise.all([import(appointmentsPath), import(inventoryPath), import(clientPath)])
      mockAppointments.splice(0)
      mockInventoryItems.forEach((item: { stock: number; minStock: number }) => item.stock = item.minStock + 1)
      await queryClient.invalidateQueries({ queryKey: ["reports"] })
    })
    await expect(cards(page).nth(1).locator(".clinic-kpi-value")).toHaveText("0")
    await expect(cards(page).nth(1).locator(".clinic-kpi-hint")).toHaveText("0 completadas")
    await expect(cards(page).nth(3)).toHaveAttribute("data-icon-tone", "neutral")
    await expect(cards(page).nth(3).locator(".clinic-kpi-value")).toHaveText("0")
    await expect(page.getByText("Reabastecer", { exact: true })).toHaveCount(0)
    await expect(chart(page).getByRole("status")).toContainText("No hay citas registradas este mes.")
    await expect(chart(page).locator(".recharts-bar-rectangle")).toHaveCount(0)
  })

  test(`Dashboard loading, failed sources, retry and cached data never show false zero values in ${theme}`, async ({ page }) => {
    await login(page, theme, async () => {
      await page.evaluate(async () => {
        const path = "/src/modules/reports/api/reports.api.ts"
        const clientPath = "/src/shared/lib/query-client.ts"
        const [{ reportsApi }, { queryClient }] = await Promise.all([import(path), import(clientPath)])
        queryClient.setDefaultOptions({ queries: { retry: false } })
        const original = { ...reportsApi }
        const state = window as unknown as { releaseDashboardSources: () => void; restoreDashboardSources: () => void; failDashboardSources: () => void }
        const gate = new Promise<void>(resolve => state.releaseDashboardSources = resolve)
        reportsApi.getSummary = async () => { await gate; throw new Error("Summary fixture unavailable") }
        reportsApi.getAgenda = async () => { await gate; throw new Error("Agenda fixture unavailable") }
        state.restoreDashboardSources = () => Object.assign(reportsApi, original)
        state.failDashboardSources = () => {
          reportsApi.getSummary = async () => { throw new Error("Summary fixture unavailable") }
          reportsApi.getAgenda = async () => { throw new Error("Agenda fixture unavailable") }
        }
      })
    })
    await expect(page.getByRole("group", { name: "Indicadores de la clínica", exact: true })).toHaveAttribute("aria-busy", "true")
    await expect(cards(page).locator(".clinic-kpi-value")).toHaveCount(0)
    await expect(chart(page).getByRole("status", { name: "Cargando citas del mes", exact: true })).toBeVisible()
    const loadingHeights = await cards(page).evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().height))
    expect(new Set(loadingHeights).size).toBe(1)
    await page.evaluate(() => (window as unknown as { releaseDashboardSources: () => void }).releaseDashboardSources())
    await expect(cards(page).locator(".clinic-kpi-value")).toHaveText(["—", "—", "—", "—"])
    await expect(page.getByRole("alert")).toHaveCount(2)
    await expect(chart(page).getByText("No hay citas registradas este mes.", { exact: true })).toHaveCount(0)
    await page.evaluate(() => (window as unknown as { restoreDashboardSources: () => void }).restoreDashboardSources())
    await page.getByRole("alert").filter({ hasText: "No se pudieron cargar los indicadores." }).getByRole("button", { name: "Reintentar", exact: true }).click()
    await chart(page).getByRole("alert").getByRole("button", { name: "Reintentar", exact: true }).click()
    await expect(cards(page).locator(".clinic-kpi-value")).toHaveText(["5", "6", "2", "2"])
    await expect(page.getByRole("alert")).toHaveCount(0)
    await expect(chart(page).locator(".recharts-bar-rectangle")).toHaveCount(5)
    await page.evaluate(async () => {
      (window as unknown as { failDashboardSources: () => void }).failDashboardSources()
      const path = "/src/shared/lib/query-client.ts"
      const { queryClient } = await import(path)
      await queryClient.invalidateQueries({ queryKey: ["reports"] })
    })
    await expect(page.getByRole("alert")).toHaveCount(2)
    await expect(cards(page).locator(".clinic-kpi-value")).toHaveText(["5", "6", "2", "2"])
    await expect(chart(page).locator(".recharts-bar-rectangle")).toHaveCount(5)
    await expect(page.getByText(/No se pudieron actualizar los indicadores/)).toBeVisible()
  })
}
