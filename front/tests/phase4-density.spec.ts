import { expect, test, type Page } from "@playwright/test"

test.use({ timezoneId: "America/Guayaquil" })
test.describe.configure({ mode: "parallel" })
const widths = [320, 360, 375, 390, 430, 600, 768, 1024, 1280, 1440, 1920]
const themeSwitch = (page: Page) => page.getByRole("switch", { name: "Modo oscuro", exact: true })

async function login(page: Page, theme: "light" | "dark", route = "/") {
  await page.clock.install({ time: new Date("2026-11-11T17:00:00Z") })
  await page.goto("/login")
  await page.getByRole("button", { name: theme === "light" ? "Tema claro" : "Tema oscuro", exact: true }).click()
  await page.locator("#email").fill("admin@clinica.com")
  await page.locator("#password").fill("admin123")
  await page.getByRole("button", { name: "Ingresar", exact: true }).click()
  await page.getByRole("button", { name: "Continuar", exact: true }).click()
  await expect(page).toHaveURL(/\/$/)
  if (route !== "/") await page.goto(route)
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible()
  await expect(page.locator('[data-slot="skeleton"]')).toHaveCount(0)
}

for (const theme of ["light", "dark"] as const) {
  test(`finance groups labels, currency and totals without changing portfolio data in ${theme}`, async ({ page }, testInfo) => {
    await login(page, theme, "/finanzas")
    const cards = page.locator(".clinic-kpi-card")
    await expect(cards.locator(".clinic-kpi-label")).toHaveText(["Cobrado este mes", "Total pendiente", "Total vencido", "Seguros pendientes"])
    await expect(cards.locator(".clinic-kpi-value")).toHaveText(["$100,00", "$95,00", "$0,00", "1"])
    const measured = []
    for (const card of await cards.all()) {
      const label = await card.locator(".clinic-kpi-label").boundingBox()
      const value = await card.locator(".clinic-kpi-value").boundingBox()
      const icon = await card.locator(".clinic-summary-icon").boundingBox()
      const box = await card.boundingBox()
      expect(value!.y - label!.y - label!.height).toBeCloseTo(4, 1)
      expect(value!.x).toBeCloseTo(label!.x, 1)
      expect(box!.height).toBeLessThan(100)
      expect(icon!.width).toBe(32)
      expect(icon!.height).toBe(32)
      expect(await card.locator(".clinic-kpi-value").evaluate((node) => node.childElementCount)).toBe(0)
      await expect(card.getByRole("button")).toHaveCount(0)
      measured.push({ label: await card.locator(".clinic-kpi-label").innerText(), box, labelBox: label, valueBox: value, iconBox: icon })
    }
    const table = page.locator('[data-slot="active-portfolio"]').getByRole("table")
    await expect(table.getByRole("columnheader")).toHaveText(["Paciente", "Tratamiento", "Total", "Pagado", "Pendiente", "Vencido", "Próximo venc.", "Días mora", "Estado"])
    await expect(table.locator('tbody [data-column="paid"]')).toHaveText(["$35,00", "$15,00", "$50,00"])
    await expect(table.locator('[data-column="pending"]').first()).toHaveCSS("text-align", "right")
    for (const [index, token] of [[0, "--success"], [1, "--info"], [2, "--destructive"]] as const) {
      const color = await page.evaluate((name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim(), token)
      expect(await cards.nth(index).locator(".clinic-summary-icon").evaluate((node, expected) => {
        const probe = document.createElement("span")
        probe.style.color = expected
        document.body.append(probe)
        const matches = getComputedStyle(node).color === getComputedStyle(probe).color
        probe.remove()
        return matches
      }, color)).toBe(true)
    }
    await page.setViewportSize({ width: 390, height: 844 })
    const first = page.getByRole("list", { name: "Registros de cartera activa" }).getByRole("article").first()
    await expect(first.locator("dd")).toHaveText(["Limpieza dental", "$35,00", "$35,00", "$0,00", "$0,00", "—", "0", "Al día"])
    for (const field of await first.locator("dl > div").all()) {
      const label = await field.locator("dt").boundingBox()
      const value = await field.locator("dd").boundingBox()
      expect(value!.x).toBeCloseTo(label!.x, 1)
      expect(value!.y - label!.y - label!.height).toBeLessThanOrEqual(5)
    }
    await testInfo.attach("financial-composition", { body: JSON.stringify(measured, null, 2), contentType: "application/json" })
  })

  test(`natural KPI composition fits all widths across financial, clinical and summary screens in ${theme}`, async ({ page }, testInfo) => {
    await login(page, theme)
    const measured = []
    for (const route of ["/", "/finanzas", "/reportes", "/historial-clinico/paciente/pat_1"]) {
      await page.goto(route)
      await expect(page.locator('[data-slot="skeleton"]')).toHaveCount(0)
      await expect(page.locator(".clinic-kpi-card")).toHaveCount(4)
      for (const width of widths) {
        await page.setViewportSize({ width, height: 1000 })
        await expect.poll(() => page.locator(".clinic-kpi-card").evaluateAll((cards) => cards.flatMap((card) => {
          const bounds = card.getBoundingClientRect()
          return [...card.querySelectorAll<HTMLElement>(".clinic-kpi-label, .clinic-kpi-value, .clinic-kpi-hint, .clinic-summary-icon")]
            .filter((node) => {
              const rect = node.getBoundingClientRect()
              return rect.left < bounds.left || rect.right > bounds.right + 1 || node.scrollWidth > node.clientWidth + 1
            }).map((node) => node.textContent)
        }))).toEqual([])
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
        const cards = await page.locator(".clinic-kpi-card").evaluateAll((cards) => cards.map((card) => {
          const label = card.querySelector(".clinic-kpi-label")!.getBoundingClientRect()
          const value = card.querySelector(".clinic-kpi-value")!.getBoundingClientRect()
          const last = (card.querySelector(".clinic-kpi-hint") ?? card.querySelector(".clinic-kpi-value"))!.getBoundingClientRect()
          const bounds = card.getBoundingClientRect()
          return { height: bounds.height, gap: value.top - label.bottom, remainingBottom: bounds.bottom - last.bottom }
        }))
        for (const card of cards) {
          expect(card.gap).toBeGreaterThanOrEqual(3.9)
          expect(card.gap).toBeLessThanOrEqual(8)
          expect(card.remainingBottom).toBeLessThanOrEqual(17)
        }
        measured.push({ route, width, cards })
      }
    }
    await testInfo.attach("natural-density-matrix", { body: JSON.stringify(measured, null, 2), contentType: "application/json" })
  })

  test(`sidebar keeps routes and dimensions with one active accent and a real theme switch in ${theme}`, async ({ page }, testInfo) => {
    await login(page, theme)
    const expectedAccent = theme === "dark" ? "rgb(228, 242, 34)" : "rgb(83, 80, 204)"
    const measured = []
    for (const width of widths) {
      await page.setViewportSize({ width, height: 1000 })
      if (width < 1024) await page.getByRole("button", { name: "Abrir menú", exact: true }).click()
      const sidebar = page.locator(width < 1024 ? ".clinic-app-sidebar-panel" : ".clinic-app-sidebar")
      await expect(sidebar).toBeVisible()
      await expect(sidebar.locator('a[aria-current="page"]')).toHaveCount(1)
      await expect(sidebar.locator('a[aria-current="page"]')).toHaveCSS("box-shadow", `${expectedAccent} 3px 0px 0px 0px inset`)
      await expect(themeSwitch(page)).toHaveAttribute("aria-checked", String(theme === "dark"))
      const bounds = await themeSwitch(page).boundingBox()
      expect(bounds!.width).toBeGreaterThanOrEqual(44)
      expect(bounds!.height).toBeGreaterThanOrEqual(44)
      const track = await themeSwitch(page).evaluate((node) => getComputedStyle(node, "::before").backgroundColor)
      expect(track).toBe(theme === "dark" ? expectedAccent : "rgb(133, 140, 151)")
      measured.push({ width, bounds, track })
      if (width < 1024) await page.keyboard.press("Escape")
      else {
        await expect(sidebar).toHaveCSS("width", "256px")
        await page.getByRole("button", { name: "Cerrar menú", exact: true }).click()
        await expect(sidebar).toHaveCSS("width", "72px")
        await expect(themeSwitch(page)).toBeVisible()
        await expect(sidebar.locator('a[aria-current="page"]')).toHaveCSS("box-shadow", `${expectedAccent} 3px 0px 0px 0px inset`)
        await page.getByRole("button", { name: "Abrir menú", exact: true }).click()
      }
    }
    await themeSwitch(page).focus()
    await page.keyboard.press("Space")
    await expect(themeSwitch(page)).toHaveAttribute("aria-checked", String(theme === "light"))
    await expect.poll(() => page.locator("html").evaluate((node) => node.classList.contains("dark"))).toBe(theme === "light")
    await page.reload()
    await expect(themeSwitch(page)).toHaveAttribute("aria-checked", String(theme === "light"))
    await themeSwitch(page).setChecked(theme === "dark")
    for (const [name, route] of [["Pacientes", "/pacientes"], ["Citas", "/citas"], ["Historial clínico", "/historial-clinico"], ["Inventario", "/inventario"], ["Finanzas", "/finanzas"], ["Reportes", "/reportes"], ["Mi perfil", "/perfil-usuario"]]) {
      await page.locator(".clinic-app-sidebar").getByRole("link", { name, exact: true }).click()
      await expect(page).toHaveURL(new RegExp(`${route}$`))
      await expect(page.locator('.clinic-app-sidebar a[aria-current="page"]')).toHaveCount(1)
      await expect(page.locator('.clinic-app-sidebar a[aria-current="page"]')).toHaveText(name)
    }
    await testInfo.attach("sidebar-theme-responsive", { body: JSON.stringify(measured, null, 2), contentType: "application/json" })
  })
}
