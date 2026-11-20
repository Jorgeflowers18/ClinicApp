import { expect, test } from "@playwright/test"
import { setAccessTheme } from "./helpers/access-theme"

test.use({ reducedMotion: "reduce" })

for (const theme of ["light", "dark"] as const) {
  test(`login blocks concurrent submissions, keeps values on errors and permits retry in ${theme}`, async ({ page }) => {
    await page.goto("/login"); await setAccessTheme(page, theme)
    const savedTheme = await page.evaluate(() => localStorage.getItem("theme"))
    await page.locator("#email").fill("admin@clinica.com"); await page.locator("#password").fill("admin123")
    await page.evaluate(async () => {
      const path = "/src/modules/auth/api/auth.api.ts"
      const { authApi } = await import(/* @vite-ignore */ path)
      const original = authApi.login
      const probe = { calls: 0, reject: () => {}, restore: () => { authApi.login = original } }
      Object.assign(window, { authProbe: probe })
      authApi.login = async () => {
        probe.calls++
        return await new Promise((_resolve, reject) => { probe.reject = () => reject(new Error("PRIVATE-STACK https://internal.invalid/server")) })
      }
      const form = document.querySelector<HTMLFormElement>(".auth-form")!
      form.requestSubmit(); form.requestSubmit(); form.requestSubmit()
    })
    const pending = page.getByRole("button", { name: "Ingresando...", exact: true })
    await expect(pending).toBeDisabled()
    await expect(page.locator(".auth-form")).toHaveAttribute("aria-busy", "true")
    await page.locator("#password").press("Enter")
    expect(await page.evaluate(() => (window as unknown as { authProbe: { calls: number } }).authProbe.calls)).toBe(1)
    await page.evaluate(() => (window as unknown as { authProbe: { reject: () => void } }).authProbe.reject())
    await expect(page.getByRole("alert")).toHaveText("No se pudo iniciar sesión. Inténtalo de nuevo.")
    await expect(page.locator("body")).not.toContainText("PRIVATE-STACK")
    await expect(page.locator("#email")).toHaveValue("admin@clinica.com")
    await expect(page.locator("#password")).toHaveValue("admin123")
    await page.evaluate(() => (window as unknown as { authProbe: { restore: () => void } }).authProbe.restore())
    await page.getByRole("button", { name: "Ingresar", exact: true }).click()
    await expect(page).toHaveURL(/\/perfil-usuario$/)
    expect(await page.evaluate(() => localStorage.getItem("theme"))).toBe(savedTheme)
    await expect(page.locator("html")).toHaveClass(new RegExp(theme))
  })

  test(`Chrome autofill retains the theme surface, text and password-manager attributes in ${theme}`, async ({ page }) => {
    await page.goto("/login"); await setAccessTheme(page, theme)
    await page.locator("#email").fill("maria@example.com"); await page.locator("#password").fill("prueba-local")
    const client = await page.context().newCDPSession(page)
    await client.send("DOM.enable"); await client.send("CSS.enable")
    const { root } = await client.send("DOM.getDocument")
    for (const selector of ["#email", "#password"]) {
      const { nodeId } = await client.send("DOM.querySelector", { nodeId: root.nodeId, selector })
      await client.send("CSS.forcePseudoState", { nodeId, forcedPseudoClasses: ["autofill"] })
      for (const mode of [theme, theme === "light" ? "dark" : "light"]) {
        await setAccessTheme(page, mode)
        const normal = selector === "#email" ? "#password" : "#email"
        const colors = await page.evaluate(({ selector, normal }) => {
          const field = getComputedStyle(document.querySelector(selector)!), reference = getComputedStyle(document.querySelector(normal)!)
          return { shadow: field.boxShadow, text: field.webkitTextFillColor, surface: reference.backgroundColor, foreground: getComputedStyle(document.querySelector(".auth-shell")!).color }
        }, { selector, normal })
        expect(colors.shadow).toContain(colors.surface)
        expect(colors.text).toBe(colors.foreground)
      }
      await client.send("CSS.forcePseudoState", { nodeId, forcedPseudoClasses: [] })
    }
    await expect(page.locator("#email")).toHaveAttribute("autocomplete", "email")
    await expect(page.locator("#password")).toHaveAttribute("autocomplete", "current-password")
    await expect(page.locator("#email")).toHaveValue("maria@example.com")
    await expect(page.locator("#password")).toHaveValue("prueba-local")
    await client.detach()
  })
}
