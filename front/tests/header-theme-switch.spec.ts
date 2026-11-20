import { setAccessTheme } from "./helpers/access-theme"
import { expect, test, type Page } from "@playwright/test"

async function login(page: Page, theme: "light" | "dark") {
  await page.goto("/login")
  await setAccessTheme(page, theme === "light" ? "light" : "dark")
  await page.locator("#email").fill("admin@clinica.com")
  await page.locator("#password").fill("admin123")
  await page.getByRole("button", { name: "Ingresar", exact: true }).click()
  await page.getByRole("button", { name: "Continuar", exact: true }).click()
  await expect(page.getByRole("button", { name: /^Notificaciones: \d+ sin leer/ })).toBeVisible()
}

const control = (page: Page) => page.getByRole("switch", { name: "Modo oscuro", exact: true })
const thumb = (page: Page) => control(page).locator('[data-slot="switch-thumb"]')
const offset = (page: Page) => control(page).evaluate((node) => {
  const thumb = node.querySelector('[data-slot="switch-thumb"]')!
  return Math.round(thumb.getBoundingClientRect().left - node.getBoundingClientRect().left)
})

async function expectTheme(page: Page, dark: boolean, allowDefault = false) {
  await expect(control(page)).toHaveAttribute("aria-checked", String(dark))
  await expect.poll(() => page.locator("html").evaluate((node) => node.classList.contains("dark"))).toBe(dark)
  await expect.poll(() => offset(page)).toBe(dark ? 34 : 6)
  await expect.poll(() => page.evaluate((allowDefault) => localStorage.getItem("theme") ?? (allowDefault ? "light" : null), allowDefault)).toBe(dark ? "dark" : "light")
  await expect(thumb(page)).toHaveCSS("background-color", "rgba(0, 0, 0, 0)")
  await expect(thumb(page)).toHaveCSS("background-image", "none")
  await expect(thumb(page)).toHaveCSS("box-shadow", "none")
  await expect(thumb(page)).toHaveCSS("border-width", "2px")
  await expect(thumb(page)).toHaveCSS("border-color", dark ? "rgb(228, 242, 34)" : "rgb(83, 80, 204)")
}

for (const theme of ["light", "dark"] as const) {
  test(`hollow selector, exposed icon and smooth reversible movement in ${theme}`, async ({ page }) => {
    await login(page, theme)
    const dark = theme === "dark"
    const bell = page.getByRole("button", { name: /^Notificaciones:/ })
    const originalCount = await bell.getAttribute("aria-label")
    await expectTheme(page, dark, true)
    const row = control(page).locator("..")
    await expect(row.locator(".lucide-sun")).toHaveCSS("opacity", dark ? "0" : "1")
    await expect(row.locator(".lucide-moon")).toHaveCSS("opacity", dark ? "1" : "0")
    const track = await control(page).evaluate((node) => ({ color: getComputedStyle(node, "::before").backgroundColor, image: getComputedStyle(node, "::before").backgroundImage }))
    expect(track).toEqual({ color: dark ? "rgb(8, 9, 10)" : "rgb(255, 255, 255)", image: "none" })
    const icon = row.locator(dark ? ".lucide-moon" : ".lucide-sun")
    const color = dark ? "rgb(228, 242, 34)" : "rgb(83, 80, 204)"
    await expect(icon).toHaveCSS("color", color)
    await expect(icon).toHaveCSS("fill", "none")
    await expect(icon).toHaveCSS("stroke", color)
    await expect(icon).toHaveCSS("stroke-width", "2px")
    await expect(icon).toHaveCSS("stroke-linecap", "round")
    await expect(icon).toHaveCSS("stroke-linejoin", "round")
    await expect(icon).toHaveCSS("background-color", "rgba(0, 0, 0, 0)")
    await expect(icon).toHaveCSS("width", "20px")
    await expect(icon).toHaveCSS("height", "20px")
    const iconBox = (await icon.boundingBox())!, thumbBox = (await thumb(page).boundingBox())!
    expect(dark ? iconBox.x + iconBox.width <= thumbBox.x : thumbBox.x + thumbBox.width <= iconBox.x).toBe(true)
    if (dark) await expect(thumb(page)).toHaveCSS("border-color", "rgb(228, 242, 34)")
    else await expect(row.locator(".lucide-sun")).toHaveCSS("color", "rgb(83, 80, 204)")

    // Sample the actual animation halfway without relying on machine timing.
    const movement = await control(page).evaluate(async (node) => {
      const thumb = node.querySelector<HTMLElement>('[data-slot="switch-thumb"]')!
      node.click()
      const animation = thumb.getAnimations()[0]
      if (!animation) return { animated: false, duration: 0, middle: 0 }
      const duration = Number(animation.effect!.getTiming().duration)
      animation.pause()
      animation.currentTime = duration / 2
      await new Promise(requestAnimationFrame)
      const middle = thumb.getBoundingClientRect().left - node.getBoundingClientRect().left
      const row = node.parentElement!
      const icon = row.querySelector(node.getAttribute("aria-checked") === "true" ? ".lucide-moon" : ".lucide-sun")!
      const visible = getComputedStyle(icon)
      const uncovered = Number(visible.zIndex) > Number(getComputedStyle(thumb).zIndex) && visible.opacity === "1"
      const backing = visible.backgroundColor
      animation.finish()
      return { animated: true, duration, middle, uncovered, backing }
    })
    expect(movement.animated).toBe(true)
    expect(movement.duration).toBeGreaterThanOrEqual(150)
    expect(movement.duration).toBeLessThanOrEqual(300)
    expect(movement.middle).toBeGreaterThan(6)
    expect(movement.middle).toBeLessThan(34)
    expect(movement.uncovered).toBe(true)
    expect(movement.backing).toBe("rgba(0, 0, 0, 0)")
    await expectTheme(page, !dark)

    for (let index = 0; index < 8; index++) await control(page).click()
    await expectTheme(page, !dark)
    await expect(bell).toHaveAttribute("aria-label", originalCount!)
    await control(page).focus()
    await page.keyboard.press("Tab")
    await page.keyboard.press("Shift+Tab")
    await expect(control(page)).toBeFocused()
    await expect(control(page)).toHaveCSS("outline-style", "solid")
    await expect(control(page)).toHaveCSS("outline-width", "2px")
    await page.keyboard.press("Space")
    await expectTheme(page, dark)
    await page.mouse.move(0, 899)
    await control(page).hover()
    await expect(page.locator('[data-slot="tooltip-content"]').filter({ hasText: dark ? "Cambiar a modo claro" : "Cambiar a modo oscuro" })).toBeVisible()
    await page.reload()
    await expectTheme(page, dark)
    expect(await thumb(page).evaluate((node) => node.getAnimations().length)).toBe(0)
    await expect(bell).toHaveAttribute("aria-label", originalCount!)
    await bell.click()
    await expect(page.getByRole("dialog", { name: "Notificaciones", exact: true })).toBeVisible()
  })

  test(`reduced motion changes the real theme immediately in ${theme}`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" })
    await login(page, theme)
    await control(page).click()
    await expectTheme(page, theme === "light")
    expect(await thumb(page).evaluate((node) => node.getAnimations().length)).toBe(0)
    await control(page).focus()
    await page.keyboard.press("Space")
    await expectTheme(page, theme === "dark")
    expect(await thumb(page).evaluate((node) => node.getAnimations().length)).toBe(0)
  })
}

test("touch target stays unique in the Header and taps persist on a phone", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true, baseURL: test.info().project.use.baseURL })
  try {
    const page = await context.newPage()
    await login(page, "light")
    await expect(control(page)).toHaveCount(1)
    const bounds = (await control(page).boundingBox())!
    expect(bounds.width).toBeGreaterThanOrEqual(44)
    expect(bounds.height).toBeGreaterThanOrEqual(44)
    await control(page).tap()
    await expectTheme(page, true)
    await page.reload()
    await expectTheme(page, true)
    await control(page).tap()
    await expectTheme(page, false)
    await page.getByRole("button", { name: "Abrir menú", exact: true }).tap()
    await expect(page.locator(".clinic-app-sidebar-panel").getByRole("switch")).toHaveCount(0)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375)
  } finally { await context.close() }
})
