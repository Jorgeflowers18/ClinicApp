import fs from "node:fs/promises"
import path from "node:path"
import { chromium, expect } from "@playwright/test"

const stage = process.argv[2]
if (!["before", "after"].includes(stage)) throw new Error("Use before or after")
const output = path.resolve(process.env.UI_CAPTURE_DIR || "test-results/ui-standardization", stage)
await fs.mkdir(output, { recursive: true })
const browser = await chromium.launch({ channel: "chrome", headless: true })
const snapshots = []
const baseURL = process.env.CLINIC_TEST_URL || "http://localhost:5173"

async function snapshot(page, selector) {
  await page.evaluate(() => document.fonts.ready)
  return page.locator(selector).evaluate((root) => [root, ...root.querySelectorAll('button, input, a, h1, h2, p, label, [data-slot="brand-logo"]')]
    .filter((node) => node.getClientRects().length && getComputedStyle(node).visibility !== "hidden")
    .map((node) => {
      const rect = node.getBoundingClientRect(), style = getComputedStyle(node)
      return {
        tag: node.tagName, text: node.textContent?.trim(), label: node.getAttribute("aria-label"),
        box: [rect.x, rect.y, rect.width, rect.height].map((value) => Math.round(value * 100) / 100),
        styles: Object.fromEntries(["backgroundColor", "color", "borderColor", "borderRadius", "fontFamily", "fontSize", "fontWeight", "lineHeight", "padding", "gap"].map((key) => [key, style[key]])),
      }
    }))
}

try {
  for (const theme of ["light", "dark"]) {
    const context = await browser.newContext({ baseURL, viewport: { width: 1440, height: 1000 }, timezoneId: "America/Guayaquil" })
    const page = await context.newPage()
    try {
      await page.clock.install({ time: new Date("2026-11-11T17:00:00Z") })
      await page.goto("/login")
      await page.getByRole("button", { name: theme === "light" ? "Tema claro" : "Tema oscuro", exact: true }).click()
      for (const width of [390, 1440]) {
        await page.setViewportSize({ width, height: 1000 })
        snapshots.push({ area: "login", theme, width, nodes: await snapshot(page, ".auth-shell") })
        await page.screenshot({ path: path.join(output, `login-${theme}-${width}.png`), animations: "disabled" })
      }
      await page.locator("#email").fill("admin@clinica.com")
      await page.locator("#password").fill("admin123")
      await page.getByRole("button", { name: "Ingresar", exact: true }).click()
      await page.getByRole("button", { name: "Continuar", exact: true }).click()
      await expect(page).toHaveURL(/\/$/)
      await page.goto("/historial-clinico/paciente/pat_1")
      await expect(page.frameLocator("iframe").locator("#toothGrid")).toBeVisible()
      for (const width of [390, 1440]) {
        await page.setViewportSize({ width, height: 1000 })
        if (width >= 1024) await expect(page.locator(".clinic-app-sidebar")).toHaveCSS("width", "256px")
        snapshots.push({ area: "header", theme, width, nodes: await snapshot(page, ".clinic-app-header") })
        if (width < 1024) {
          await page.getByRole("button", { name: "Abrir menú", exact: true }).click()
          await expect(page.locator(".clinic-app-sidebar-panel")).toBeVisible()
          await expect.poll(async () => (await page.locator(".clinic-app-sidebar-panel").boundingBox())?.x).toBe(0)
          snapshots.push({ area: "sidebar", theme, width, nodes: await snapshot(page, ".clinic-app-sidebar-panel") })
          await page.keyboard.press("Escape")
        } else snapshots.push({ area: "sidebar", theme, width, nodes: await snapshot(page, ".clinic-app-sidebar") })
      }
      await page.setViewportSize({ width: 1440, height: 1000 })
      for (const [name, route] of [["panel", "/"], ["history", "/historial-clinico/paciente/pat_1"], ["treatments", "/tratamientos"], ["appointments", "/citas"], ["finance", "/finanzas"], ["inventory", "/inventario"], ["notifications", "/notificaciones"]]) {
        await page.goto(route)
        await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible()
        await expect(page.locator('[data-slot="skeleton"]')).toHaveCount(0)
        if (name === "appointments") await expect(page.locator('.rbc-event').filter({ hasText: "María González" }).first()).toBeVisible()
        if (name === "history") await expect(page.getByRole("button", { name: "Registrar atención", exact: true })).toBeEnabled()
        await page.evaluate(() => document.fonts.ready)
        await page.mouse.move(0, 0)
        await page.screenshot({ path: path.join(output, `${name}-${theme}.png`), animations: "disabled" })
      }
    } finally { await context.close() }
  }
  await fs.writeFile(path.join(output, "protected.json"), JSON.stringify(snapshots, null, 2))
  console.log(JSON.stringify({ stage, protectedSnapshots: snapshots.length, output }))
} finally { await browser.close() }
