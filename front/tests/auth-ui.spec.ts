import { expect, test } from "@playwright/test"

const screens = [
  { path: "/login", title: "Iniciar sesión" },
  { path: "/recuperar-contrasena", title: "Recuperar contraseña" },
  { path: "/solicitar-acceso", title: "Solicitar acceso" },
] as const
const widths = [320, 360, 375, 390, 430, 600, 768, 1024, 1280, 1440, 1920]

test("light is the default even with a dark OS; the shared preference survives navigation and reload", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" })
  await page.goto("/login")
  await expect(page.getByRole("button", { name: "Tema claro", exact: true })).toHaveAttribute("aria-pressed", "true")
  await expect(page.locator(".auth-shell")).toHaveCSS("background-color", "rgb(247, 247, 248)")
  await expect(page.locator(".auth-submit")).toHaveCSS("background-color", "rgb(83, 80, 204)")
  const logo = page.locator('[data-slot="brand-logo"]')
  const submit = page.locator(".auth-submit")
  async function checkSharedSource() {
    const before = [await logo.boundingBox(), await submit.boundingBox()]
    const semanticColors = () => page.evaluate(() => {
      const style = getComputedStyle(document.documentElement)
      return ["--destructive", "--success", "--warning", "--info"].map((token) => style.getPropertyValue(token))
    })
    const statuses = await semanticColors()
    // A future primary-token change must update both components automatically.
    await page.evaluate(() => {
      document.documentElement.style.setProperty("--primary", "rgb(7, 89, 133)")
      document.documentElement.style.setProperty("--primary-foreground", "rgb(255, 251, 235)")
    })
    for (const component of [logo, submit]) {
      await expect(component).toHaveCSS("background-color", "rgb(7, 89, 133)")
      await expect(component).toHaveCSS("color", "rgb(255, 251, 235)")
    }
    expect([await logo.boundingBox(), await submit.boundingBox()]).toEqual(before)
    expect(await semanticColors()).toEqual(statuses)
    await page.evaluate(() => {
      document.documentElement.style.removeProperty("--primary")
      document.documentElement.style.removeProperty("--primary-foreground")
    })
  }
  await expect(logo).toHaveCSS("background-color", "rgb(83, 80, 204)")
  await checkSharedSource()
  await page.locator(".auth-submit").hover()
  await expect(page.locator(".auth-submit")).toHaveCSS("background-color", "rgb(64, 60, 213)")
  await expect(page.locator(".auth-submit")).toHaveCSS("color", "rgb(255, 255, 255)")
  await page.mouse.move(0, 0)
  await page.getByRole("button", { name: "Tema oscuro", exact: true }).click()
  await expect(page.locator(".auth-submit")).toHaveCSS("background-color", "rgb(228, 242, 34)")
  await expect(logo).toHaveCSS("background-color", "rgb(228, 242, 34)")
  await checkSharedSource()
  await page.locator(".auth-submit").hover()
  await expect(page.locator(".auth-submit")).toHaveCSS("background-color", "rgb(213, 227, 29)")
  await expect(page.locator(".auth-submit")).toHaveCSS("color", "rgb(8, 9, 10)")
  await page.mouse.move(0, 0)
  await expect.poll(() => page.evaluate(() => localStorage.getItem("theme"))).toBe("dark")
  await page.reload()
  await expect(page.getByRole("button", { name: "Tema oscuro", exact: true })).toHaveAttribute("aria-pressed", "true")
  await page.getByRole("link", { name: "Solicitar acceso", exact: true }).click()
  await expect(page).toHaveURL(/\/solicitar-acceso$/)
  await expect(page.locator(".auth-shell")).toHaveCSS("background-color", "rgb(8, 9, 10)")
  await page.getByRole("link", { name: "Iniciar sesión", exact: true }).click()
  await page.getByRole("link", { name: "¿Olvidaste tu contraseña?", exact: true }).click()
  await expect(page).toHaveURL(/\/recuperar-contrasena$/)
  await expect(page.locator(".auth-shell")).toHaveCSS("background-color", "rgb(8, 9, 10)")
  await page.getByRole("button", { name: "Tema claro", exact: true }).click()
  await page.getByRole("link", { name: "Volver a iniciar sesión", exact: true }).click()
  await page.reload()
  await expect.poll(() => page.evaluate(() => localStorage.getItem("theme"))).toBe("light")
})

test("saved preference is applied before the React entry point loads", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("theme", "dark"))
  await page.route(
    (url) => url.pathname === "/src/main.tsx" || /^\/assets\/app-[^/]+\.js$/.test(url.pathname),
    (route) => route.abort(),
  )
  await page.goto("/login")
  await expect(page.locator("#root")).toBeEmpty()
  await expect(page.locator("html")).toHaveClass(/dark/)
  await expect(page.locator("html")).toHaveCSS("color-scheme", "dark")
})

test("access screens still work when browser storage is unavailable", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", { get() { throw new Error("Storage blocked") } })
  })
  await page.goto("/login")
  await expect(page.getByRole("heading", { name: "Iniciar sesión", exact: true })).toBeVisible()
  await expect(page.locator("html")).toHaveClass(/light/)
  await page.getByRole("button", { name: "Tema oscuro", exact: true }).click()
  await expect(page.locator(".auth-shell")).toHaveCSS("background-color", "rgb(8, 9, 10)")
})

test("pending forms validate on blur and never send or save their values", async ({ page }) => {
  const writes: string[] = []
  page.on("request", (request) => {
    if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method())) writes.push(request.url())
  })
  await page.goto("/solicitar-acceso")
  const before = await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } }))
  const name = page.getByRole("textbox", { name: "Nombre completo", exact: true })
  await expect(name).toHaveAttribute("required", "")
  await name.fill("   ")
  await name.press("Tab")
  await expect(page.getByRole("alert")).toHaveText("El nombre completo es obligatorio")
  await expect(name).toHaveAttribute("aria-describedby", "request-name-error")
  await name.fill("María Ejemplo")
  const email = page.getByRole("textbox", { name: "Correo electrónico", exact: true })
  await email.fill("correo-invalido")
  await email.press("Tab")
  await expect(page.getByRole("alert")).toHaveText("Ingresa un correo válido")
  await email.fill("maria@example.com")
  await page.getByRole("textbox", { name: "Nombre de la clínica o institución", exact: true }).fill("Clínica de ejemplo")
  await page.getByRole("textbox", { name: /Mensaje adicional/ }).fill("Necesito acceso para organizar la agenda.")
  await expect(page.getByRole("alert")).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Enviar solicitud", exact: true })).toBeDisabled()
  await expect(page.locator("#auth-unavailable")).toHaveText("El envío de solicitudes estará disponible próximamente.")
  await email.press("Enter")
  await expect(page).toHaveURL(/\/solicitar-acceso$/)
  await page.getByRole("link", { name: "Iniciar sesión", exact: true }).click()
  await expect(page.getByRole("checkbox", { name: "Recordarme", exact: true })).toBeDisabled()
  await expect(page.locator("#remember-status")).toHaveText("Recordarme aún no está disponible.")
  await expect(page.locator(".auth-options")).not.toContainText("Próximamente")
  await page.getByRole("link", { name: "¿Olvidaste tu contraseña?", exact: true }).click()
  const recoveryEmail = page.getByRole("textbox", { name: "Correo electrónico", exact: true })
  await recoveryEmail.fill("invalido")
  await recoveryEmail.press("Tab")
  await expect(page.getByRole("alert")).toHaveText("Ingresa un correo válido")
  await recoveryEmail.fill("maria@example.com")
  await expect(page.getByRole("alert")).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Enviar instrucciones", exact: true })).toBeDisabled()
  await expect(page.locator("#auth-unavailable")).toHaveText("El envío de instrucciones aún no está disponible.")
  await recoveryEmail.press("Enter")
  expect(writes).toEqual([])
  expect(await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } }))).toEqual(before)
})

test("keyboard navigation exposes the password and associated validation errors", async ({ page }) => {
  await page.goto("/login")
  const email = page.getByRole("textbox", { name: "Correo electrónico", exact: true })
  await email.focus()
  await expect(email).toHaveCSS("outline-style", "solid")
  await email.press("Tab")
  await expect(page.locator("#password")).toBeFocused()
  await page.locator("#password").fill("prueba-local")
  await page.keyboard.press("Tab")
  await expect(page.getByRole("button", { name: "Mostrar contraseña", exact: true })).toBeFocused()
  await page.keyboard.press("Space")
  await expect(page.locator("#password")).toHaveAttribute("type", "text")
  await page.keyboard.press("Space")
  await expect(page.locator("#password")).toHaveAttribute("type", "password")
  await page.keyboard.press("Tab")
  await expect(page.getByRole("link", { name: "¿Olvidaste tu contraseña?", exact: true })).toBeFocused()
  await page.keyboard.press("Enter")
  await expect(page.getByRole("heading", { name: "Recuperar contraseña", exact: true })).toBeFocused()
  await page.getByRole("link", { name: "Volver a iniciar sesión", exact: true }).click()
  await page.getByRole("button", { name: "Ingresar", exact: true }).click()
  await expect(page.getByRole("alert")).toHaveCount(2)
  await expect(email).toHaveAttribute("aria-describedby", "email-error")
  await page.getByRole("button", { name: "Tema oscuro", exact: true }).focus()
  await page.keyboard.press("Enter")
  await expect(page.locator("html")).toHaveClass(/dark/)
})

test("existing login, redirects, errors and application theme remain functional", async ({ page }) => {
  await page.goto("/login")
  await page.getByRole("button", { name: "Tema oscuro", exact: true }).click()
  await page.locator("#email").fill("admin@clinica.com")
  await page.locator("#password").fill("incorrecta")
  await page.getByRole("button", { name: "Ingresar", exact: true }).click()
  await expect(page.getByRole("alert")).toHaveText("Correo o contraseña incorrectos")
  await page.locator("#password").fill("admin123")
  await page.getByRole("button", { name: "Ingresar", exact: true }).click()
  await page.getByRole("button", { name: "Continuar", exact: true }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect(page).toHaveTitle("ClinicApp")
  await page.getByRole("button", { name: "Modo oscuro", exact: true }).click()
  await page.getByRole("button", { name: "Salir", exact: true }).click()
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole("button", { name: "Tema claro", exact: true })).toHaveAttribute("aria-pressed", "true")
})

for (const theme of ["light", "dark"] as const) {
  for (const screen of screens) {
    test(`${screen.title} in ${theme}: responsive layout and readable contrast`, async ({ page }, testInfo) => {
      await page.goto(screen.path)
      await page.getByRole("button", { name: theme === "dark" ? "Tema oscuro" : "Tema claro", exact: true }).click()
      for (const width of widths) {
        await page.setViewportSize({ width, height: 1000 })
        await expect(page.getByRole("heading", { name: screen.title, exact: true })).toBeVisible()
        const layout = await page.evaluate(() => {
          const card = document.querySelector(".auth-card")!.getBoundingClientRect()
          const brand = document.querySelector(".auth-brand")!.getBoundingClientRect()
          const logo = document.querySelector('[data-slot="brand-logo"]')!
          const mark = logo.getBoundingClientRect()
          const controls = [...document.querySelectorAll<HTMLElement>(".auth-shell input:not([type=checkbox]), .auth-shell textarea, .auth-shell button:not([disabled]), .auth-link")]
            .map((element) => element.getBoundingClientRect()).filter((rect) => rect.width > 0)
            .map((rect) => ({ left: rect.left, right: rect.right, height: rect.height }))
          const options = document.querySelector(".auth-options")
          return {
            overflow: document.documentElement.scrollWidth > innerWidth,
            centerOffset: Math.abs((card.left + card.width / 2) - innerWidth / 2),
            brandOffset: Math.abs((brand.left + brand.width / 2) - (card.left + card.width / 2)),
            logo: { width: mark.width, height: mark.height, centerOffset: Math.abs(mark.left + mark.width / 2 - innerWidth / 2), background: getComputedStyle(logo).backgroundColor, foreground: getComputedStyle(logo).color },
            optionsDirection: options ? getComputedStyle(options).flexDirection : null,
            controls,
          }
        })
        expect(layout.overflow, `${width}px horizontal overflow`).toBe(false)
        expect(layout.centerOffset).toBeLessThan(1)
        expect(layout.brandOffset).toBeLessThan(1)
        expect(layout.logo.width).toBe(layout.logo.height)
        expect(layout.logo.centerOffset).toBeLessThan(1)
        expect(layout.logo.background).toBe(theme === "light" ? "rgb(83, 80, 204)" : "rgb(228, 242, 34)")
        expect(layout.logo.foreground).toBe(theme === "light" ? "rgb(255, 255, 255)" : "rgb(8, 9, 10)")
        for (const control of layout.controls) {
          expect(control.left).toBeGreaterThanOrEqual(0)
          expect(control.right).toBeLessThanOrEqual(width)
          expect(control.height).toBeGreaterThanOrEqual(44)
        }
        if (screen.path === "/login" && width <= 430) expect(layout.optionsDirection).toBe("column")
        if (width === 375 || width === 1440) await page.screenshot({ path: testInfo.outputPath(`${screen.path.slice(1)}-${theme}-${width}.png`), fullPage: true })
      }
      const contrast = await page.evaluate(() => {
        function luminance(color: string) {
          const channels = color.match(/[\d.]+/g)!.slice(0, 3).map(Number).map((channel) => {
            const value = channel / 255
            return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
          })
          return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
        }
        function ratio(first: string, second: string) {
          const values = [luminance(first), luminance(second)].sort((a, b) => b - a)
          return (values[0] + 0.05) / (values[1] + 0.05)
        }
        function background(element: Element): string {
          const color = getComputedStyle(element).backgroundColor
          return color === "rgba(0, 0, 0, 0)" && element.parentElement ? background(element.parentElement) : color
        }
        const text = [...document.querySelectorAll(".auth-brand h1, .auth-brand p, [data-slot=brand-logo], .auth-card h2, .auth-card-header p, .auth-link, .auth-notice, .auth-footer, .auth-remember-help, .auth-optional, .auth-shell label, .auth-submit")]
          .map((element) => ({ text: element.textContent, ratio: ratio(getComputedStyle(element).color, background(element)) }))
        const inputs = [...document.querySelectorAll(".auth-shell input:not([type=checkbox]), .auth-shell textarea")].map((element) => {
          const style = getComputedStyle(element)
          return {
            text: ratio(style.color, style.backgroundColor),
            placeholder: ratio(getComputedStyle(element, "::placeholder").color, style.backgroundColor),
            border: ratio(style.borderTopColor, background(element.parentElement!)),
          }
        })
        return { text, inputs }
      })
      for (const item of contrast.text) expect(item.ratio, String(item.text)).toBeGreaterThanOrEqual(4.5)
      for (const input of contrast.inputs) {
        expect(input.text).toBeGreaterThanOrEqual(4.5)
        expect(input.placeholder).toBeGreaterThanOrEqual(4.5)
        expect(input.border).toBeGreaterThanOrEqual(3)
      }
    })
  }
}
