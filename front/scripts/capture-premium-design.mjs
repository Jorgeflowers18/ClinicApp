import { chromium, expect } from "@playwright/test"
import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"

const phase = process.argv[2] || "after"
if (!["before", "after"].includes(phase)) throw new Error("Use before or after")
const origin = process.env.CLINIC_TEST_URL || "http://localhost:5173"
const output = path.resolve("test-results", `premium-${phase}`)
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ channel: "chrome", headless: true })
const results = []
try {
  for (const theme of ["light", "dark"]) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
    await context.addInitScript((value) => localStorage.setItem("theme", value), theme)
    const page = await context.newPage()
    async function capture(name, route) {
      await page.goto(`${origin}${route}`)
      await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible()
      await expect(page.locator('[data-slot="skeleton"]')).toHaveCount(0)
      await page.evaluate(() => document.fonts.ready)
      await expect.poll(() => page.evaluate(() => document.fonts.check('14px "Inter Variable"'))).toBe(true)
      for (const width of [390, 1440]) {
        await page.setViewportSize({ width, height: 1000 })
        await page.evaluate(async () => {
          await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
          await Promise.all(document.getAnimations().filter((animation) =>
            animation instanceof CSSTransition && animation.transitionProperty === "grid-template-columns"
          ).map((animation) => animation.finished.catch(() => undefined)))
        })
        if (name === "panel") {
          // Recharts animates SVG geometry in JavaScript, outside CSS animations.
          // Wait for the loaded bars to settle before taking the comparison.
          let previous = ""
          let stable = 0
          await expect.poll(async () => {
            const heights = await page.locator(".recharts-bar-rectangle path").evaluateAll((bars) => bars.map((bar) => bar.getBoundingClientRect().height))
            const current = JSON.stringify(heights)
            stable = heights.some((height) => height > 0) && current === previous ? stable + 1 : 0
            previous = current
            return stable
          }, { intervals: [100, 200, 200], timeout: 10000 }).toBeGreaterThanOrEqual(3)
        }
        const file = `${name}-${theme}-${width}.png`
        await page.screenshot({ path: path.join(output, file), fullPage: true, animations: "disabled" })
        results.push({ phase, name, route, theme, width, file })
      }
    }
    await capture("login", "/login")
    await capture("recovery", "/recuperar-contrasena")
    await capture("request", "/solicitar-acceso")
    await page.goto(`${origin}/login`)
    await page.locator("#email").fill("admin@clinica.com")
    await page.locator("#password").fill("admin123")
    await page.getByRole("button", { name: "Ingresar", exact: true }).click()
    await page.getByRole("button", { name: "Continuar", exact: true }).waitFor()
    await capture("setup", "/perfil-usuario")
    await page.getByRole("button", { name: "Continuar", exact: true }).click()
    await page.waitForURL(`${origin}/`)
    await capture("profile", "/perfil-usuario")
    await capture("institution", "/perfil-institucion")
    await capture("panel", "/")
    await context.close()
  }
  await writeFile(path.join(output, "manifest.json"), JSON.stringify(results, null, 2))
  console.log(JSON.stringify({ phase, screenshots: results.length, output }))
} finally {
  await browser.close()
}
