import { chromium, expect } from "@playwright/test"
import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"

const phase = process.argv[2] || "after"
if (!["before", "pilot", "after"].includes(phase)) throw new Error("Use before, pilot or after")
const origin = process.env.CLINIC_TEST_URL || "http://localhost:5173"
const output = path.resolve("test-results", `css-architecture-${phase}`)
await mkdir(output, { recursive: true })
const widths = [320, 360, 375, 390, 430, 600, 768, 1024, 1280, 1440, 1920]
const props = ["display", "position", "color", "backgroundColor", "fontFamily", "fontSize", "fontWeight", "fontFeatureSettings", "lineHeight", "letterSpacing", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft", "marginTop", "marginRight", "marginBottom", "marginLeft", "gap", "gridTemplateColumns", "width", "height", "minWidth", "minHeight", "maxWidth", "maxHeight", "borderTopColor", "borderTopStyle", "borderTopWidth", "borderRadius", "boxShadow", "outlineColor", "outlineStyle", "outlineWidth", "outlineOffset", "overflowX", "overflowY", "textAlign", "whiteSpace", "transform"]
const selectors = 'main, header, aside, [data-slot], .auth-main, .auth-brand, .auth-card, .auth-link, .clinic-sidebar-link, .clinic-profile-notice, .clinic-file-upload, .clinic-kpi-icon, .rbc-calendar, .rbc-toolbar, .rbc-event, .recharts-wrapper, .recharts-cartesian-axis-tick-value, .recharts-default-legend, dt, dd'
const browser = await chromium.launch({ channel: "chrome", headless: true })
const measurements = []
const shots = []

async function settle(page, chart = false) {
  await page.mouse.move(0, 0)
  await page.evaluate(async () => {
    await document.fonts.ready
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    await Promise.all(document.getAnimations().filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity).map((animation) => animation.finished.catch(() => undefined)))
  })
  if (chart) {
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
}

async function snapshot(page) {
  return page.evaluate(({ selectors, props }) => {
    const describe = (element) => {
      const rect = element.getBoundingClientRect()
      const style = getComputedStyle(element)
      return {
        tag: element.tagName, slot: element.getAttribute("data-slot"),
        text: element.children.length ? null : element.textContent?.trim().slice(0, 120),
        bounds: [rect.x, rect.y, rect.width, rect.height].map((value) => Math.round(value * 1000) / 1000),
        styles: Object.fromEntries(props.map((prop) => [prop, style[prop]])),
      }
    }
    const root = getComputedStyle(document.documentElement)
    const tokens = [...root].filter((name) => name.startsWith("--") && !name.startsWith("--tw-")).sort().map((name) => [name, root.getPropertyValue(name).trim()])
    const elements = [...document.querySelectorAll(selectors)].filter((element) => {
      const style = getComputedStyle(element)
      return element.getClientRects().length && style.visibility !== "hidden" && !element.closest('[aria-hidden="true"], [inert], .sr-only')
    }).map(describe)
    return { width: innerWidth, scrollWidth: document.documentElement.scrollWidth, tokens, elements }
  }, { selectors, props })
}

try {
  for (const theme of ["light", "dark"]) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: "America/Guayaquil" })
    await context.addInitScript((value) => localStorage.setItem("theme", value), theme)
    const page = await context.newPage()
    await page.clock.setFixedTime(new Date("2026-10-24T17:00:00Z"))
    async function capture(name, route) {
      await page.goto(`${origin}${route}`)
      await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible()
      await expect(page.locator('[data-slot="skeleton"]')).toHaveCount(0)
      if (name === "clinical") await page.frameLocator("iframe").locator("#toothGrid > *").first().waitFor()
      for (const width of widths) {
        await page.setViewportSize({ width, height: 1000 })
        await settle(page, name === "panel")
        measurements.push({ name, route, theme, ...(await snapshot(page)) })
        if (width === 390 || width === 1440) {
          const file = `${name}-${theme}-${width}.png`
          await page.screenshot({ path: path.join(output, file), animations: "disabled", caret: "hide" })
          shots.push({ name, route, theme, width, file })
        }
      }
    }
    for (const [name, route] of [["login", "/login"], ["recovery", "/recuperar-contrasena"], ["request", "/solicitar-acceso"]]) await capture(name, route)

    // Capture interactive states separately, using the same viewport each time.
    await page.setViewportSize({ width: 390, height: 1000 })
    await page.goto(`${origin}/login`)
    for (const [state, locator, action] of [
      ["hover", page.locator(".auth-submit"), "hover"],
      ["focus", page.locator("#email"), "focus"],
    ]) {
      await locator[action]()
      await page.evaluate(async () => { await Promise.all(document.getAnimations().filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity).map((animation) => animation.finished.catch(() => undefined))) })
      measurements.push({ name: `login-${state}`, route: "/login", theme, ...(await snapshot(page)) })
      await page.mouse.move(0, 0)
    }
    await page.locator("#email").fill("admin@clinica.com")
    await page.locator("#password").fill("admin123")
    await page.getByRole("button", { name: "Ingresar", exact: true }).click()
    await page.getByRole("button", { name: "Continuar", exact: true }).waitFor()
    await capture("setup", "/perfil-usuario")
    await page.getByRole("button", { name: "Continuar", exact: true }).click()
    await page.waitForURL(`${origin}/`)
    for (const [name, route] of [
      ["panel", "/"], ["patients", "/pacientes"], ["appointments", "/citas"],
      ["finance", "/finanzas"], ["profile", "/perfil-usuario"], ["institution", "/perfil-institucion"],
      ["clinical", "/historial-clinico/paciente/pat_1?visita=hist_1"],
    ]) await capture(name, route)

    await page.goto(`${origin}/citas`)
    await page.getByRole("button", { name: "Nueva cita", exact: true }).click()
    const dialog = page.getByRole("dialog")
    await dialog.getByLabel("Notas", { exact: true }).fill("Referencia visual sin guardar")
    for (const width of [390, 768, 1440]) {
      await page.setViewportSize({ width, height: 1000 })
      await settle(page)
      measurements.push({ name: "appointment-dialog", route: "/citas", theme, ...(await snapshot(page)) })
    }
    await context.close()
  }
  await writeFile(path.join(output, "computed.json"), JSON.stringify(measurements))
  await writeFile(path.join(output, "manifest.json"), JSON.stringify(shots, null, 2))
  console.log(JSON.stringify({ phase, measurements: measurements.length, screenshots: shots.length, output }))
} finally {
  await browser.close()
}
