import fs from "node:fs"
import { test, expect, type Page } from "@playwright/test"

test.use({ reducedMotion: "reduce", timezoneId: "America/Guayaquil" })
test.describe.configure({ mode: "parallel" })
const pane = (page: Page) => page.getByRole("tabpanel")
async function login(page: Page, theme: string) {
  await page.clock.install({ time: new Date("2026-11-19T17:00:00Z") })
  await page.goto("/login")
  await page.getByRole("button", { name: theme === "light" ? "Tema claro" : "Tema oscuro", exact: true }).click()
  await page.locator("#email").fill("admin@clinica.com"); await page.locator("#password").fill("admin123")
  await page.getByRole("button", { name: "Ingresar", exact: true }).click()
  await page.getByRole("button", { name: "Continuar", exact: true }).click()
  await expect(page).toHaveURL(/\/$/)
}
async function tab(page: Page, name: string) {
  const target = page.getByRole("tab", { name, exact: true })
  if (await target.count() && await target.getAttribute("aria-selected") === "true") return
  if (await target.count() && (await target.boundingBox())!.width > 4) await target.click()
  else { await page.getByRole("button", { name: /^Más pestañas/ }).click(); await page.getByRole("menuitemradio", { name, exact: true }).click() }
  await expect(page.getByRole("tab", { name, exact: true })).toHaveAttribute("aria-selected", "true")
}
async function preset(page: Page, label: string) {
  await page.getByLabel("Periodo", { exact: true }).click()
  await page.getByRole("option", { name: label, exact: true }).click()
  await expect(page.getByLabel("Periodo", { exact: true }).locator('[data-slot="select-value"]')).toHaveText(label)
  await expect(pane(page).locator('[data-slot="skeleton"]')).toHaveCount(0)
}
async function readReports(page: Page, period = { from: "2026-01-01", to: "2026-12-31" }) {
  return page.evaluate(async period => {
    const path = "/src/modules/reports/api/reports.api.ts", { reportsApi } = await import(path)
    const [summary, agenda, productivity, treatments, inventory] = await Promise.all([
      reportsApi.getSummary(period), reportsApi.getAgenda(period), reportsApi.getProductivity(period), reportsApi.getTreatments(period), reportsApi.getInventory(period),
    ])
    return { summary, agenda, productivity, treatments, inventory }
  }, period)
}
async function stockSnapshot(page: Page) {
  return page.evaluate(async () => {
    const path = "/src/modules/inventory/api/inventory.mock-data.ts", data = await import(path)
    return JSON.stringify({ items: data.mockInventoryItems, lots: data.mockStockLots, moves: data.mockStockMovements, orders: data.mockPurchaseOrders, cycles: data.mockSterilizationCycles })
  })
}
function csv(rows: Record<string, unknown>[], columns: string[][]) {
  const escape = (v: unknown) => { const text = v == null ? "" : String(v); return '"' + text.replace(/"/g, '""') + '"' }
  return Buffer.from("\uFEFF" + [columns.map(c => escape(c[1])).join(","), ...rows.map(row => columns.map(c => escape(row[c[0]])).join(","))].join("\r\n"), "utf8")
}
async function exportCsv(page: Page, title: string, filename: string, rows: Record<string, unknown>[], columns: string[][]) {
  const card = page.locator(".report-table-card").filter({ has: page.getByText(title, { exact: true }) })
  const pending = page.waitForEvent("download")
  await card.getByRole("button", { name: "Exportar CSV", exact: true }).click()
  const download = await pending
  expect(download.suggestedFilename()).toBe(filename + ".csv")
  expect(fs.readFileSync((await download.path())!)).toEqual(csv(rows, columns))
}
for (const theme of ["light", "dark"]) {
  test("finance preserves source amounts, dates and independent records while filtering in " + theme, async ({ page }) => {
    await login(page, theme); await page.goto("/finanzas")
    await expect(page.locator(".clinic-kpi-value")).toHaveText(["$100,00", "$95,00", "$0,00", "1"])
    await expect(page.getByRole("button", { name: "Ver tratamientos", exact: true })).toHaveCount(1)
    await expect(page.getByRole("button", { name: "Ir a tratamientos", exact: true })).toHaveCount(0)
    const original = await page.evaluate(async () => { const p = "/src/modules/finance/api/finance.api.ts"; return (await import(p)).financeApi.listPortfolio() })
    const table = page.locator('[data-slot="active-portfolio"] table')
    await expect(table.getByRole("columnheader")).toHaveText(["Paciente", "Tratamiento", "Total", "Pagado", "Pendiente", "Vencido", "Próximo venc.", "Días mora", "Estado"])
    await expect(table.locator("tbody tr")).toHaveCount(original.length)
    for (const field of ["total", "paid", "pending", "overdue", "daysLate"]) await expect(table.locator('[data-column="' + field + '"]').first()).toHaveCSS("text-align", "right")
    await page.getByLabel("Buscar paciente o tratamiento").fill("ENDODONCIA")
    await expect(table.locator("tbody tr")).toHaveCount(1)
    await expect(table.locator("tbody tr")).toContainText("Jorge Flores")
    await expect(table.locator("tbody tr")).toContainText("5 oct 2026")
    await expect(table.locator('tbody [data-column="daysLate"]')).toHaveText("0")
    await expect(table.locator('tbody [data-column="overdue"]')).toHaveText("$0,00")
    await page.getByLabel("Buscar paciente o tratamiento").fill("")
    await page.getByLabel("Estado", { exact: true }).filter({ visible: true }).click(); await page.getByRole("option", { name: "Parcial", exact: true }).click()
    await expect(table.locator("tbody tr")).toHaveCount(2)
    await page.getByLabel("Saldo", { exact: true }).filter({ visible: true }).click(); await page.getByRole("option", { name: "Con vencido", exact: true }).click()
    await expect(page.getByText("No hay registros que coincidan con los filtros.", { exact: true })).toBeVisible()
    await page.getByRole("button", { name: "Restablecer filtros", exact: true }).click()
    await expect(table.locator("tbody tr")).toHaveCount(3)
    await expect(page.locator(".clinic-kpi-value")).toHaveText(["$100,00", "$95,00", "$0,00", "1"])
    const info = page.getByRole("button", { name: "Información: Cobrado este mes", exact: true })
    await info.focus(); await page.keyboard.press("Enter")
    await expect(page.getByText(/no está limitado al mes en curso/)).toBeVisible()
    await page.keyboard.press("Escape"); await expect(info).toBeFocused()
    await page.setViewportSize({ width: 375, height: 900 })
    const cards = page.getByRole("list", { name: "Registros de cartera activa" }).getByRole("article")
    await expect(cards).toHaveCount(original.length)
    for (const [i, row] of original.entries()) {
      await expect(cards.nth(i)).toContainText(row.patientName); await expect(cards.nth(i)).toContainText(row.treatmentName)
      await expect(cards.nth(i).locator("dt")).toHaveText(["Total", "Pagado", "Pendiente", "Vencido", "Próximo venc.", "Días mora"])
      expect(await cards.nth(i).locator("dd").count()).toBe(6)
    }
    expect(await page.evaluate(async () => { const p = "/src/modules/finance/api/finance.api.ts"; return (await import(p)).financeApi.listPortfolio() })).toEqual(original)
  })

  test("all period labels, inclusive preset boundaries, custom dates and tab state remain correct in " + theme, async ({ page }) => {
    await login(page, theme); await page.goto("/reportes")
    for (const [label, from, to] of [["Esta semana","2026-11-16","2026-11-22"],["Este mes","2026-11-01","2026-11-30"],["Últimos 30 días","2026-10-21","2026-11-19"],["Este año","2026-01-01","2026-12-31"]]) {
      await preset(page, label)
      await expect(page.locator("#desktopReportFrom")).toHaveValue(from)
      await expect(page.locator("#desktopReportTo")).toHaveValue(to)
      await expect(page.locator("#desktopReportFrom")).toBeDisabled()
      await expect(page.getByLabel("Desde", { exact: true })).not.toBeVisible()
    }
    await preset(page, "Personalizado")
    await expect(page.getByLabel("Desde", { exact: true })).toBeEnabled()
    await page.getByLabel("Desde", { exact: true }).fill("2026-01-01")
    await page.getByLabel("Hasta", { exact: true }).fill("2026-02-28")
    await expect(page.getByLabel("Desde", { exact: true })).toHaveAttribute("max", "2026-02-28")
    await expect(page.getByLabel("Hasta", { exact: true })).toHaveAttribute("min", "2026-01-01")
    for (const name of ["Productividad", "Tratamientos", "Inventario", "Agenda"]) {
      await tab(page, name)
      await expect(page.getByLabel("Periodo", { exact: true }).locator('[data-slot="select-value"]')).toHaveText("Personalizado")
      await expect(page.getByLabel("Hasta", { exact: true })).toHaveValue("2026-02-28")
    }
    await page.getByRole("button", { name: "Restablecer filtros", exact: true }).click()
    await expect(page.getByLabel("Periodo", { exact: true }).locator('[data-slot="select-value"]')).toHaveText("Últimos 30 días")
    await expect(page.locator(".clinic-kpi-value")).toHaveText(["4", "1", "0", "0%"])
    await page.getByRole("button", { name: "Información: Tasa de inasistencia", exact: true }).click()
    await expect(page.getByText(/Sobre citas completadas \+ no asistidas/)).toBeVisible()
    await page.keyboard.press("Escape")
  })

  test("seven CSV exports retain filenames, columns, encoding and real source rows in " + theme, async ({ page }) => {
    await login(page, theme); const before = await stockSnapshot(page)
    const data = await readReports(page), suffix = "_2026-01-01_2026-12-31"
    await page.goto("/reportes"); await preset(page, "Este año")
    await exportCsv(page, "Citas por estado", "agenda-por-estado" + suffix, data.agenda.byStatus, [["label","Estado"],["count","Citas"]])
    await exportCsv(page, "Ocupación por consultorio", "ocupacion-consultorios" + suffix, data.agenda.occupancyByRoom, [["roomName","Consultorio"],["appointments","Citas"],["bookedMinutes","Minutos reservados"],["blockedMinutes","Minutos bloqueados"]])
    await tab(page, "Productividad"); await expect(pane(page).locator('[data-slot="skeleton"]')).toHaveCount(0)
    const productivity = data.productivity.byProfessional.map((row: Record<string, unknown>) => ({ ...row, completionRate: `${Math.round((row.completionRate as number) * 100)}%` }))
    await exportCsv(page, "Productividad por profesional", "productividad" + suffix, productivity, [["name","Profesional"],["specialty","Especialidad"],["scheduled","Programadas"],["completed","Completadas"],["noShow","No asistió"],["cancelled","Canceladas"],["completionRate","% cumplimiento"]])
    await tab(page, "Tratamientos"); await expect(pane(page).locator('[data-slot="skeleton"]')).toHaveCount(0)
    await exportCsv(page, "Tratamientos", "tratamientos" + suffix, data.treatments.byTreatment, [["name","Tratamiento"],["price","Precio"],["appointmentsInPeriod","Citas en el periodo"],["activeAssignments","Asignaciones activas"],["completedAssignments","Asignaciones completadas"],["sessionsDone","Sesiones realizadas"],["sessionsPlanned","Sesiones planificadas"],["estimatedRevenue","Ingreso estimado"]])
    await tab(page, "Inventario"); await expect(pane(page).locator('[data-slot="skeleton"]')).toHaveCount(0)
    await exportCsv(page, "Stock crítico (" + data.inventory.criticalItems.length + ")", "stock-critico" + suffix, data.inventory.criticalItems, [["name","Insumo"],["category","Categoría"],["stock","Stock"],["minStock","Mínimo"],["unit","Unidad"]])
    await exportCsv(page, "Compras del periodo", "compras" + suffix, data.inventory.purchasesInPeriod, [["orderId","Orden"],["supplierName","Proveedor"],["statusLabel","Estado"],["createdAt","Fecha"],["total","Total"]])
    await exportCsv(page, "Consumo del periodo", "consumo" + suffix, data.inventory.consumptionInPeriod, [["name","Insumo"],["quantity","Cantidad"],["unit","Unidad"]])
    expect(await stockSnapshot(page)).toBe(before)
  })

  test("query failures and delayed ranges never display false zero or stale success in " + theme, async ({ page }) => {
    await login(page, theme)
    await page.evaluate(async () => {
      const p = "/src/modules/finance/api/finance.api.ts", q = "/src/shared/lib/query-client.ts"
      ;(await import(p)).financeApi.listPortfolio = async () => { throw new Error("Lectura rechazada") }
      ;(await import(q)).queryClient.setDefaultOptions({ queries: { retry: false } })
    })
    await page.getByRole("link", { name: "Finanzas", exact: true }).click()
    await expect(page.getByText(/No se pudo cargar la información financiera/)).toBeVisible()
    await expect(page.locator(".clinic-kpi-value")).toHaveCount(0)
    await page.getByRole("link", { name: "Reportes", exact: true }).click()
    await expect(page.locator(".clinic-kpi-value")).toHaveText(["4","1","0","0%"])
    await page.evaluate(async () => {
      const p = "/src/modules/reports/api/reports.api.ts", { reportsApi } = await import(p), original = reportsApi.getAgenda
      reportsApi.getAgenda = async period => new Promise(resolve => { (window as unknown as { releaseReport: () => void }).releaseReport = () => { reportsApi.getAgenda = original; void original(period).then(resolve) } })
    })
    await page.getByLabel("Periodo", { exact: true }).click(); await page.getByRole("option", { name: "Este año", exact: true }).click()
    await expect(pane(page).locator(".report-chart [data-slot='skeleton']")).toBeVisible()
    await expect(pane(page).locator(".report-chart svg")).toHaveCount(0)
    await page.evaluate(() => (window as unknown as { releaseReport: () => void }).releaseReport())
    await expect(pane(page).locator(".report-chart [data-slot='skeleton']")).toHaveCount(0)
    await page.evaluate(async () => {
      const p = "/src/modules/reports/api/reports.api.ts", q = "/src/shared/lib/query-client.ts", { reportsApi } = await import(p), { queryClient } = await import(q)
      reportsApi.getInventory = async () => { throw new Error("Reporte rechazado") }; queryClient.setDefaultOptions({ queries: { retry: false } })
    })
    await tab(page, "Inventario")
    await expect(pane(page).getByText(/No se pudo cargar este reporte/)).toHaveCount(3)
    for (const button of await pane(page).getByRole("button", { name: "Exportar CSV", exact: true }).all()) await expect(button).toBeDisabled()
  })

  test("finance and all reports fit eleven widths, sidebar states and short viewports in " + theme, async ({ page }, testInfo) => {
    test.setTimeout(180000)
    await login(page, theme)
    const measurements = []
    for (const width of [320,360,375,390,430,600,768,1024,1280,1440,1920]) {
      await page.setViewportSize({ width, height: 900 }); await page.goto("/finanzas")
      await expect(page.locator(".clinic-kpi-value")).toHaveCount(4)
      await expect(page.getByText("María González", { exact: true }).filter({ visible: true }).first()).toBeVisible()
      const heights = await page.locator(".finance-metrics .clinic-kpi-card").evaluateAll(nodes => nodes.map(n => n.getBoundingClientRect().height))
      expect(Math.max(...heights) - Math.min(...heights)).toBeLessThan(2)
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
      await page.goto("/reportes"); await expect(page.locator(".clinic-kpi-value")).toHaveCount(4)
      for (const name of ["Agenda","Productividad","Tratamientos","Inventario"]) {
        await tab(page, name); await expect(pane(page).locator('[data-slot="skeleton"]')).toHaveCount(0)
        expect(await page.evaluate(() => document.documentElement.scrollWidth), name + " " + width).toBeLessThanOrEqual(width)
      }
      await page.getByLabel("Periodo", { exact: true }).click()
      const bounds = await page.getByRole("listbox").boundingBox()
      expect(bounds!.x).toBeGreaterThanOrEqual(-1); expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width + 1)
      await page.keyboard.press("Escape")
      await preset(page, "Personalizado")
      await expect(page.getByLabel("Desde", { exact: true })).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
      measurements.push({ width, financeHeights: heights })
    }
    await page.setViewportSize({ width: 1440, height: 900 })
    for (const route of ["/finanzas","/reportes"]) {
      await page.goto(route); await page.getByRole("button", { name: "Cerrar menú", exact: true }).click()
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1440)
      await page.getByRole("button", { name: "Abrir menú", exact: true }).click()
    }
    for (const size of [{width:390,height:380},{width:720,height:450}]) {
      await page.setViewportSize(size); await page.goto("/reportes"); await preset(page, "Personalizado")
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(size.width)
      await page.getByLabel("Hasta", { exact: true }).scrollIntoViewIfNeeded(); await expect(page.getByLabel("Hasta", { exact: true })).toBeInViewport()
    }
    await testInfo.attach("responsive-measurements", { body: JSON.stringify(measurements), contentType: "application/json" })
  })

  test("stock quantities stay numeric and separate from truthful states, and purchase detail retains historical costs in " + theme, async ({ page }) => {
    await login(page, theme)
    await page.evaluate(async () => {
      const p = "/src/modules/inventory/api/inventory.mock-data.ts", data = await import(p)
      data.mockInventoryItems.push(...[
        { id: "check_equal", name: "Prueba igualdad", stock: 1, minStock: 1, unit: "unidad" },
        { id: "check_zero", name: "Prueba cero", stock: 0, minStock: 0, unit: "unidad" },
        { id: "check_decimal", name: "Prueba decimal", stock: 1.5, minStock: 1, unit: "ml" },
        { id: "check_unknown", name: "Prueba sin dato", stock: undefined, minStock: 1, unit: "g" },
      ].map(row => ({ ...data.mockInventoryItems[0], ...row })))
      data.mockInventoryItems.find((row: {id:string}) => row.id === "inv_2").unitCost = 999
      const order = data.mockPurchaseOrders.find((row: {id:string}) => row.id === "po_2")
      order.notes = "Observaciones extensas de compra. ".repeat(30)
    })
    const original = await stockSnapshot(page)
    await page.getByRole("link", { name: "Inventario", exact: true }).click()
    await expect(pane(page).getByText("Prueba igualdad", {exact:true}).filter({visible:true})).toBeVisible()
    const table = pane(page).getByRole("table")
    const expected = [["Prueba igualdad","1 unidad","Bajo mínimo"],["Prueba cero","0 unidades","Agotado"],["Prueba decimal","1.5 ml","Suficiente"],["Prueba sin dato","—","Sin datos"]]
    for (const [name, quantity, state] of expected) {
      const row = table.locator("tbody tr").filter({ hasText: name })
      await expect(row.locator('[data-column="stock"]')).toHaveText(quantity)
      await expect(row.locator('[data-column="stock"]')).toHaveCSS("text-align", "right")
      await expect(row.locator('[data-column="stock"] svg')).toHaveCount(0)
      await expect(row.locator('[data-column="stockStatus"]')).toHaveText(state)
    }
    await tab(page, "Compras")
    await pane(page).getByRole("button", { name: "Acciones de compra de Farma Dental", exact: true }).click()
    await page.getByRole("menuitem", { name: "Ver detalle", exact: true }).click()
    const dialog = page.locator('.inventory-dialog[role="dialog"]')
    await expect(dialog).toContainText("Consulta de solo lectura")
    await expect(dialog.getByRole("heading", { name: "Insumos de la orden", exact: false })).toBeVisible()
    await expect(dialog).toContainText("$1,25")
    await expect(dialog.getByRole("textbox")).toHaveCount(0)
    const bounds = await dialog.boundingBox(); expect(bounds!.width).toBeLessThanOrEqual(900)
    await expect(dialog.locator(".inventory-order-summary")).toContainText("Farma Dental")
    await expect(dialog.locator(".inventory-order-notes")).toContainText("Observaciones extensas de compra.")
    await expect(dialog.locator(".inventory-form-actions")).toHaveCSS("background-color", "rgba(0, 0, 0, 0)")
    await dialog.getByRole("button", { name: "Cerrar", exact: true }).click()
    await expect(dialog).toHaveCount(0)
    expect(await stockSnapshot(page)).toBe(original)
  })
}
