import { expect, test, type Page } from "@playwright/test"

const widths = [320, 360, 375, 390, 430, 600, 768, 1024, 1280, 1440, 1920]
const icons = [
  ["Panel", "layout-dashboard"], ["Pacientes", "users-round"], ["Citas", "calendar-days"],
  ["Historial clínico", "clipboard-list"], ["Tratamientos", "stethoscope"], ["Inventario", "package"],
  ["Finanzas", "wallet"], ["Reportes", "chart-no-axes-combined"], ["Mensajería", "messages-square"],
]
const toggle = (page: Page) => page.locator("[data-sidebar-toggle]")
const drawer = (page: Page) => page.locator("#mobile-sidebar")

async function login(page: Page, theme: "light" | "dark") {
  await page.goto("/login")
  await page.getByRole("button", { name: theme === "light" ? "Tema claro" : "Tema oscuro", exact: true }).click()
  await page.locator("#email").fill("admin@clinica.com")
  await page.locator("#password").fill("admin123")
  await page.getByRole("button", { name: "Ingresar", exact: true }).click()
  await page.getByRole("button", { name: "Continuar", exact: true }).click()
  await expect(toggle(page)).toBeVisible()
}

async function expectToggle(page: Page, open: boolean) {
  await expect(toggle(page)).toHaveAttribute("aria-expanded", String(open))
  await expect(toggle(page).locator(".clinic-navigation-menu-icon")).toHaveCSS("opacity", open ? "0" : "1")
  await expect(toggle(page).locator(".clinic-navigation-close-icon")).toHaveCSS("opacity", open ? "1" : "0")
  await expect(toggle(page)).toHaveCount(1)
}

for (const theme of ["light", "dark"] as const) {
  test(`exact outline icons and consistent interactive colors in ${theme}`, async ({ page }, testInfo) => {
    await login(page, theme)
    await page.mouse.move(500, 800)
    const sidebar = page.locator(".clinic-app-sidebar")
    const primary = theme === "light" ? "rgb(83, 80, 204)" : "rgb(228, 242, 34)"
    for (const [label, icon] of icons) {
      const svg = sidebar.getByRole("link", { name: label, exact: true }).locator("svg")
      await expect(svg).toHaveClass(new RegExp(`lucide-${icon}(?: |$)`))
      await expect(svg).toHaveCSS("width", "22px")
      await expect(svg).toHaveCSS("height", "22px")
      await expect(svg).toHaveCSS("fill", "none")
      await expect(svg).toHaveCSS("stroke-width", "2px")
      await expect(svg).toHaveCSS("stroke-linecap", "round")
      await expect(svg).toHaveCSS("stroke-linejoin", "round")
    }
    await expect(sidebar.getByRole("link", { name: "Panel", exact: true }).locator("svg")).toHaveCSS("color", primary)
    const patients = sidebar.getByRole("link", { name: "Pacientes", exact: true })
    await expect(patients.locator("svg")).not.toHaveCSS("color", primary)
    if (theme === "dark") await expect(patients.locator("svg")).toHaveCSS("color", "rgb(208, 214, 224)")
    await patients.hover()
    await expect(patients.locator("svg")).toHaveCSS("color", primary)
    if (theme === "dark") await expect(patients).toHaveCSS("background-color", "rgb(35, 37, 42)")
    await patients.click()
    await expect(page).toHaveURL(/\/pacientes$/)
    await page.mouse.move(500, 800)
    await expect(patients).toHaveAttribute("aria-current", "page")
    await expect(patients.locator("svg")).toHaveCSS("color", primary)
    await expect(patients).toHaveCSS("box-shadow", `${primary} 3px 0px 0px 0px inset`)
    await expect(sidebar.locator('a[aria-current="page"]')).toHaveCount(1)
    for (const name of ["General", "Atención clínica", "Gestión", "Comunicación"]) await expect(sidebar.getByRole("region", { name, exact: true })).toHaveCount(1)
    await page.screenshot({ path: testInfo.outputPath(`icons-${theme}.png`), animations: "disabled" })
  })

  test(`one Menu/X button controls every viewport without duplicate mobile close buttons in ${theme}`, async ({ page }, testInfo) => {
    test.setTimeout(120000)
    await login(page, theme)
    const measurements = []
    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 })
      if (await toggle(page).getAttribute("aria-expanded") === "true") await toggle(page).click()
      await expectToggle(page, false)
      const original = await toggle(page).elementHandle()
      const before = (await toggle(page).boundingBox())!
      await toggle(page).click()
      await expectToggle(page, true)
      expect(await toggle(page).evaluate((node, previous) => node === previous, original)).toBe(true)
      await expect(page.getByRole("button", { name: "Cerrar menú", exact: true })).toHaveCount(1)
      if (width < 768) {
        await expect(drawer(page)).toBeVisible()
        await expect(drawer(page).getByRole("button", { name: /Cerrar/ })).toHaveCount(0)
        await expect(drawer(page)).toHaveCSS("top", "64px")
        // The first-login toast can still be animating over the Header after setup.
        await expect.poll(() => toggle(page).evaluate((node) => {
          const box = node.getBoundingClientRect()
          const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)
          return hit === node || node.contains(hit)
        })).toBe(true)
      } else await expect(page.locator(".clinic-app-sidebar")).toHaveCSS("width", "268px")
      const after = (await toggle(page).boundingBox())!
      expect(after.width).toBe(before.width)
      expect(after.height).toBe(before.height)
      if ([390, 768, 1440].includes(width)) await page.screenshot({ path: testInfo.outputPath(`open-${theme}-${width}.png`), animations: "disabled" })
      await toggle(page).click()
      await expectToggle(page, false)
      if (width < 768) await expect(drawer(page)).not.toBeVisible()
      else await expect(page.locator(".clinic-app-sidebar")).toHaveCSS("width", "72px")
      expect(await toggle(page).evaluate((node, previous) => node === previous, original)).toBe(true)
      const pageWidth = await page.evaluate(() => document.documentElement.scrollWidth)
      expect(pageWidth).toBeLessThanOrEqual(width)
      measurements.push({ width, pageWidth, buttonWidth: after.width, buttonHeight: after.height })
      if (width < 768) {
        await toggle(page).focus()
        await page.keyboard.press("Enter")
        await expect(drawer(page)).toBeVisible()
        await page.keyboard.press("Escape")
        await expect(drawer(page)).not.toBeVisible()
        await expect(toggle(page)).toBeFocused()
      }
      await original?.dispose()
    }
    await testInfo.attach("responsive.json", { body: JSON.stringify(measurements, null, 2), contentType: "application/json" })
  })

  test(`touch, outside dismissal, reduced motion and Header notifications remain usable in ${theme}`, async ({ browser }) => {
    const context = await browser.newContext({ baseURL: test.info().project.use.baseURL, viewport: { width: 390, height: 480 }, hasTouch: true, isMobile: true, reducedMotion: "reduce" })
    try {
      const page = await context.newPage()
      const errors: string[] = []
      page.on("pageerror", (error) => errors.push(error.message))
      await login(page, theme)
      const bell = page.getByRole("button", { name: /^Notificaciones:/ })
      await expect(bell).toHaveAttribute("aria-label", /\d+ sin leer/)
      const count = await bell.getAttribute("aria-label")
      await toggle(page).tap()
      await expectToggle(page, true)
      const durations = await toggle(page).locator(".clinic-navigation-close-icon").evaluate((node) => getComputedStyle(node).transitionDuration.split(",").map((value) => parseFloat(value)))
      expect(Math.max(...durations)).toBeLessThanOrEqual(.001)
      await toggle(page).tap()
      await expectToggle(page, false)
      await toggle(page).tap()
      await expect(drawer(page)).toBeVisible()
      await page.touchscreen.tap(380, 150)
      await expect(drawer(page)).not.toBeVisible()
      await toggle(page).tap()
      await expect(drawer(page)).toBeVisible()
      await bell.tap()
      await expect(drawer(page)).not.toBeVisible()
      await expect(page.getByRole("dialog", { name: "Notificaciones", exact: true })).toBeVisible()
      await expect(bell).toHaveAttribute("aria-label", count!)
      await page.keyboard.press("Escape")
      await toggle(page).tap()
      await drawer(page).getByRole("link", { name: "Pacientes", exact: true }).tap()
      await expect(page).toHaveURL(/\/pacientes$/)
      await expectToggle(page, false)
      expect(errors).toEqual([])
    } finally { await context.close() }
  })
}
