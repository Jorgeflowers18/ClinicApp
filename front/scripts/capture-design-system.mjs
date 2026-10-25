import { chromium, expect } from "@playwright/test"
import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"

const phase = process.argv[2] || "after"
if (!["before", "after"].includes(phase)) throw new Error("Use before or after")
const origin = process.env.CLINIC_TEST_URL || "http://localhost:5173"
const output = path.resolve("test-results", `design-system-${phase}`)
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ channel: "chrome", headless: true })
const routes = [
  ["panel", "/"], ["patients", "/pacientes"], ["appointments", "/citas"],
  ["inventory", "/inventario"], ["finance", "/finanzas"], ["reports", "/reportes"],
  ["clinical", "/historial-clinico/paciente/pat_1?visita=hist_1"],
]
const results = []
try {
  for (const theme of ["light", "dark"]) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
    await context.addInitScript((value) => localStorage.setItem("theme", value), theme)
    const page = await context.newPage()
    await page.goto(`${origin}/login`)
    await page.locator("#email").fill("admin@clinica.com")
    await page.locator("#password").fill("admin123")
    await page.locator('button[type="submit"]').click()
    await page.getByRole("button", { name: "Continuar", exact: true }).click()
    await page.waitForURL(`${origin}/`)
    for (const [name, route] of routes) {
      await page.goto(`${origin}${route}`)
      await page.locator("main").waitFor()
      await expect(page.locator('[data-slot="skeleton"]')).toHaveCount(0)
      await page.evaluate(() => document.fonts.ready)
      await expect.poll(() => page.evaluate(() => document.fonts.check('14px "Inter Variable"'))).toBe(true)
      if (name === "patients") await page.getByRole("button", { name: /Acciones del paciente/ }).first().waitFor()
      if (name === "clinical") await page.frameLocator("iframe").locator("#toothGrid > *").first().waitFor()
      for (const width of [390, 1440]) {
        await page.setViewportSize({ width, height: 1000 })
        await page.evaluate(async () => {
          await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
          await Promise.all(document.getAnimations().filter((animation) =>
            animation instanceof CSSTransition && animation.transitionProperty === "grid-template-columns"
          ).map((animation) => animation.finished.catch(() => undefined)))
        })
        await page.mouse.move(0, 0)
        const file = `${name}-${theme}-${width}.png`
        await page.screenshot({ path: path.join(output, file), fullPage: true })
        results.push({ phase, name, route, theme, width, file })
      }
    }
    await context.close()
  }
  await writeFile(path.join(output, "manifest.json"), JSON.stringify(results, null, 2))
  console.log(JSON.stringify({ phase, screenshots: results.length, output }))
} finally {
  await browser.close()
}
