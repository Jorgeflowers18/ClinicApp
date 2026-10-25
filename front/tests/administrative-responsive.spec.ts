import { test, expect, type Page } from "@playwright/test"

async function login(page: Page) {
  await page.goto("/login")
  await page.getByLabel("Correo electrónico").fill("admin@clinica.com")
  await page.locator("#password").fill("admin123")
  await page.getByRole("button", { name: "Ingresar", exact: true }).click()
  await page.getByRole("button", { name: "Continuar", exact: true }).click()
  await expect(page).toHaveURL(/\/$/)
}

test("administrative modules do not overflow the page at mobile and tablet widths", async ({ page }) => {
  await login(page)

  const routes = [
    "/",
    "/pacientes",
    "/citas",
    "/tratamientos",
    "/inventario",
    "/notificaciones",
    "/finanzas",
    "/reportes",
    "/perfil-usuario",
    "/perfil-institucion",
  ]

  for (const width of [320, 375, 390, 430, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 })
    for (const route of routes) {
      await page.goto(route)
      await expect(page.locator("body")).toBeVisible()
      const pageWidth = await page.evaluate(() => document.documentElement.scrollWidth)
      expect(pageWidth, `unexpected page overflow on ${route} at ${width}px`).toBeLessThanOrEqual(width)
    }
  }
})

test("mobile appointments keep a full date and a shortcut to today", async ({ page }) => {
  await login(page)
  await page.setViewportSize({ width: 320, height: 900 })
  await page.goto("/citas")

  await expect(page.getByRole("button", { name: "Hoy", exact: true })).toBeVisible()
  await expect(page.getByRole("button", { name: /\d{1,2} [a-zA-Záéíóú.]{3,} \d{4}/ })).toBeVisible()
})

for (const theme of ["light", "dark"] as const) {
  test(`financial portfolio preserves every field in cards and desktop table in ${theme}`, async ({ page }, testInfo) => {
    await login(page)
    if (theme === "dark") await page.getByRole("button", { name: "Modo claro", exact: true }).click()
    await page.goto("/finanzas")

    const portfolio = page.locator('[data-slot="active-portfolio"]')
    const table = portfolio.getByRole("table")
    const cards = portfolio.getByRole("list", { name: "Registros de cartera activa" })
    const headers = ["Paciente", "Tratamiento", "Total", "Pagado", "Pendiente", "Vencido", "Próximo venc.", "Días mora", "Estado"]
    await expect(table.getByRole("columnheader")).toHaveText(headers)
    const readTable = () => table.locator("tbody tr").evaluateAll((rows) => rows.map((row) =>
      [...(row as HTMLTableRowElement).cells].map((cell) => cell.textContent?.trim())
    ))
    const originalRows = await readTable()
    expect(originalRows.length).toBeGreaterThan(0)
    const outsideContent = () => page.locator("main > div").evaluate((page) => ({
      heading: page.firstElementChild!.outerHTML,
      indicators: page.children[1].outerHTML,
      footer: page.lastElementChild!.outerHTML,
    }))
    const originalOutside = await outsideContent()
    const measurements = []

    for (const width of [320, 360, 375, 390, 430, 600, 768, 1024, 1280, 1440, 1920]) {
      await page.setViewportSize({ width, height: 900 })
      if (width <= 1024) {
        await expect(cards).toBeVisible()
        await expect(table).toHaveCount(0)
        const articles = cards.getByRole("article")
        await expect(articles).toHaveCount(originalRows.length)
        for (const [index, values] of originalRows.entries()) {
          const card = articles.nth(index)
          await expect(card.getByRole("heading", { level: 3 })).toHaveText(values[0]!)
          await expect(card.locator("dt")).toHaveText(headers.slice(1))
          await expect(card.locator("dd")).toHaveText(values.slice(1) as string[])
        }
      } else {
        await expect(table).toBeVisible()
        await expect(cards).toHaveCount(0)
        await expect(table.getByRole("columnheader")).toHaveText(headers)
        expect(await readTable()).toEqual(originalRows)
      }
      const size = await portfolio.evaluate((element) => ({
        viewport: innerWidth, available: element.clientWidth,
        page: document.documentElement.scrollWidth,
        overflowing: [...element.querySelectorAll<HTMLElement>("ul, article, h3, dt, dd")]
          .filter((item) => item.getClientRects().length > 0 && item.scrollWidth > item.clientWidth + 1)
          .map((item) => item.tagName),
      }))
      expect(size.page, `${theme} ${width}px page width`).toBeLessThanOrEqual(width)
      expect(size.overflowing, `${theme} ${width}px card content`).toEqual([])
      expect(await outsideContent()).toEqual(originalOutside)
      measurements.push({ theme, ...size })
      if (width === 390 || width === 1440) await page.screenshot({ path: testInfo.outputPath(`portfolio-${theme}-${width}.png`), animations: "disabled" })
    }

    // At one viewport, opening the sidebar reduces the component's real width.
    await page.setViewportSize({ width: 1100, height: 900 })
    await expect(cards).toBeVisible()
    await page.getByRole("button", { name: "Cerrar menú", exact: true }).click()
    await expect(table).toBeVisible()
    await expect(cards).toHaveCount(0)
    expect(await readTable()).toEqual(originalRows)
    await page.getByRole("region", { name: "Cartera activa, tabla desplazable horizontalmente" }).focus()
    await expect(page.getByRole("region", { name: "Cartera activa, tabla desplazable horizontalmente" })).toBeFocused()
    await page.getByRole("button", { name: "Abrir menú", exact: true }).click()
    await expect(cards).toBeVisible()
    await expect(table).toHaveCount(0)
    await testInfo.attach("portfolio-responsive", { body: JSON.stringify(measurements), contentType: "application/json" })

    const treatments = page.getByRole("button", { name: "Ir a tratamientos", exact: true })
    await treatments.focus()
    await expect(treatments).toBeFocused()
    await treatments.press("Enter")
    await expect(page).toHaveURL(/\/tratamientos$/)
  })
}
