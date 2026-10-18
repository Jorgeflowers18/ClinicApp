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

test("financial portfolio keeps every column in a keyboard-scrollable region on mobile", async ({ page }) => {
  await login(page)
  await page.setViewportSize({ width: 320, height: 900 })
  await page.goto("/finanzas")

  const portfolio = page.getByRole("region", { name: "Cartera activa, tabla desplazable horizontalmente" })
  await expect(portfolio).toBeVisible()
  await expect(portfolio.getByRole("columnheader")).toHaveCount(9)
  for (const width of [320, 375, 390, 430, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 })
    await expect(portfolio).toBeVisible()
    const pageWidth = await page.evaluate(() => document.documentElement.scrollWidth)
    expect(pageWidth, `financial page overflow at ${width}px`).toBeLessThanOrEqual(width)
  }
  await page.setViewportSize({ width: 320, height: 900 })
  await expect.poll(() => portfolio.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true)
  await portfolio.focus()
  await expect(portfolio).toBeFocused()
  await portfolio.press("ArrowRight")
  await expect.poll(() => portfolio.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0)
  await expect(portfolio.getByRole("columnheader", { name: "Estado" })).toBeVisible()
})
