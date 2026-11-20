import { expect, test, type Page } from "@playwright/test"
import { accessRequestDetailsSchema, prepareAccessRequest } from "../src/modules/auth/lib/access-request-form"
import { accessRequestSchema } from "../src/modules/auth/types/access-form.types"
import { initialInstitutionProfile } from "../src/modules/institution/types/institution.types"
import { setAccessTheme } from "./helpers/access-theme"

test.use({ reducedMotion: "reduce", hasTouch: true })
const first = (page: Page) => page.getByLabel("Nombres", { exact: true })
const last = (page: Page) => page.getByLabel("Apellidos", { exact: true })
const email = (page: Page) => page.getByLabel("Correo electrónico", { exact: true })
const institution = (page: Page) => page.getByLabel(/Nombre de la clínica o institución/)
const message = (page: Page) => page.getByLabel(/Mensaje adicional/)
const submit = (page: Page) => page.getByRole("button", { name: "Enviar solicitud", exact: true })
const snapshot = (page: Page) => page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } }))

test("separate name fields prepare the existing fullName contract without changing their input", () => {
  const values = { firstName: "  María José  ", lastName: "  D'Ávila Pérez-López  ", email: "maria@example.com", institution: "Laboratorio Dental", message: "Solicito información." }
  const before = JSON.stringify(values)
  const expected = { fullName: "María José D'Ávila Pérez-López", email: values.email, institution: values.institution, message: values.message }
  expect(prepareAccessRequest(values)).toEqual(expected)
  expect(accessRequestDetailsSchema.parse(values)).toEqual(expected)
  expect(accessRequestSchema.parse(expected)).toEqual(expected)
  expect(JSON.stringify(values)).toBe(before)
})

test("both name parts are required and existing full names are never guessed into fields", () => {
  const base = { firstName: "Juan Carlos", lastName: "Pérez López", email: "juan@example.com", institution: "", message: "" }
  for (const key of ["firstName", "lastName"] as const) {
    const result = accessRequestDetailsSchema.safeParse({ ...base, [key]: "   " })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.issues.some((issue) => issue.path[0] === key)).toBe(true)
  }
  expect(accessRequestDetailsSchema.safeParse({ fullName: "Juan Carlos Pérez López", email: base.email, institution: "", message: "" }).success).toBe(false)
})

for (const theme of ["light", "dark"] as const) {
  test(`independent compound names validate and unavailable requests never send or persist in ${theme}`, async ({ page }) => {
    const writes: string[] = []
    page.on("request", (request) => { if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method())) writes.push(request.url()) })
    await page.goto("/solicitar-acceso"); await setAccessTheme(page, theme)
    const before = await snapshot(page)
    await expect(page.getByLabel("Nombre completo", { exact: true })).toHaveCount(0)
    for (const [control, autocomplete] of [[first(page), "given-name"], [last(page), "family-name"]] as const) {
      await expect(control).toHaveAttribute("required", "")
      await expect(control).toHaveAttribute("autocomplete", autocomplete)
      await expect(control).not.toHaveAttribute("maxlength")
      await expect(control).not.toHaveAttribute("pattern")
      await control.fill("   "); await control.press("Tab")
      await expect(control).toHaveAttribute("aria-invalid", "true")
    }
    await first(page).fill("María José"); await last(page).fill("D'Ávila Pérez-López")
    await email(page).fill("no-es-correo"); await email(page).press("Tab")
    await expect(email(page)).toHaveAccessibleDescription("Ingresa un correo válido")
    await email(page).fill("maria@example.com")
    await institution(page).fill("Laboratorio Dental"); await message(page).fill("Necesito acceso para organizar la agenda.")
    await expect(page.getByRole("alert")).toHaveCount(0)
    await expect(institution(page)).not.toHaveAttribute("required")
    await expect(message(page)).not.toHaveAttribute("required")
    await expect(submit(page)).toBeDisabled()
    await expect(submit(page)).toHaveAccessibleDescription("El envío de solicitudes aún no está disponible.")
    await last(page).press("Enter")
    await expect(page).toHaveURL(/\/solicitar-acceso$/)
    expect(writes).toEqual([]); expect(await snapshot(page)).toEqual(before)
    await expect(first(page)).toHaveValue("María José"); await expect(last(page)).toHaveValue("D'Ávila Pérez-López")
    await page.reload()
    await expect(first(page)).toHaveValue(""); await expect(last(page)).toHaveValue("")
  })

  test(`request columns, optional labels and natural scrolling fit all widths in ${theme}`, async ({ page }, info) => {
    await page.goto("/solicitar-acceso"); await setAccessTheme(page, theme)
    await first(page).fill("Juan Carlos"); await last(page).fill("Pérez López")
    const errors: string[] = []; page.on("pageerror", (error) => errors.push(error.message))
    for (const width of [320,360,375,390,430,768,1024,1280,1440,1920]) {
      await page.setViewportSize({ width, height: 1000 })
      await page.evaluate(async () => { await document.fonts.ready; await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))) })
      const a = (await first(page).boundingBox())!, b = (await last(page).boundingBox())!, c = (await email(page).boundingBox())!, card = (await page.locator(".auth-card").boundingBox())!
      expect(a.height).toBe(44); expect(b.height).toBe(44)
      expect(a.width).toBe(b.width)
      if (width >= 600) { expect(a.y).toBe(b.y); expect(b.x).toBeGreaterThan(a.x); expect(c.width).toBeGreaterThan(a.width) }
      else expect(b.y).toBeGreaterThan(a.y + a.height)
      expect(c.width).toBe((await institution(page).boundingBox())!.width)
      expect(Math.abs(card.x + card.width / 2 - width / 2)).toBeLessThan(1)
      expect(card.width).toBeLessThanOrEqual(520)
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
      await expect(page.locator(".auth-navigation svg")).toHaveCount(0)
      await expect(page.locator("#request-institution-hint")).toHaveCount(0)
      await expect(message(page)).toHaveAttribute("rows", "3")
      await expect(first(page)).toHaveValue("Juan Carlos"); await expect(last(page)).toHaveValue("Pérez López")
      if ([375,1440].includes(width)) await page.screenshot({ path: info.outputPath(`request-${theme}-${width}.png`), fullPage: true })
    }
    const longMessage = "Información con acentos y nombres compuestos. ".repeat(120)
    await message(page).fill(longMessage)
    expect((await message(page).boundingBox())!.height).toBeLessThanOrEqual(200)
    await setAccessTheme(page, theme === "light" ? "dark" : "light")
    await expect(message(page)).toHaveValue(longMessage)
    await page.setViewportSize({ width: 320, height: 480 })
    await submit(page).scrollIntoViewIfNeeded(); await expect(submit(page)).toBeVisible()
    await page.locator(".auth-footer").scrollIntoViewIfNeeded(); await expect(page.locator(".auth-footer")).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320)
    expect(errors).toEqual([])
  })

  test(`public access identity is dynamic and excludes private institutional fields in ${theme}`, async ({ page }) => {
    await page.goto("/solicitar-acceso")
    const data = { ...initialInstitutionProfile, name: "Laboratorio Dental", subtitle: "Prótesis y rehabilitación", notes: "PRIVATE-INSTITUTION-NOTES", ruc: "PRIVATE-RUC", phone: "PRIVATE-PHONE" }
    await page.evaluate((data) => localStorage.setItem("clinicapp.institution-profile", JSON.stringify(data)), data)
    await page.reload(); await setAccessTheme(page, theme)
    await first(page).fill("Juan Carlos"); await last(page).fill("Pérez López")
    await expect(page.locator(".auth-brand h1")).toHaveText(data.name)
    await expect(page.locator(".auth-brand p")).toHaveText(data.subtitle)
    await expect(page.locator(".auth-brand .clinic-institution-mark")).toHaveText("LD")
    await expect(page.locator("body")).not.toContainText("PRIVATE-")
    const other = await page.context().newPage(); await other.goto("/login")
    await other.evaluate((data) => localStorage.setItem("clinicapp.institution-profile", JSON.stringify({ ...data, name: "Ortho Center", subtitle: "" })), data)
    await expect(page.locator(".auth-brand h1")).toHaveText("Ortho Center")
    await expect(page.locator(".auth-brand p")).toHaveCount(0)
    await expect(first(page)).toHaveValue("Juan Carlos"); await expect(last(page)).toHaveValue("Pérez López")
    await expect(page).toHaveTitle("Solicitar acceso · Ortho Center")
    await other.close()
    await page.getByRole("link", { name: "Iniciar sesión", exact: true }).click()
    await expect(page.locator(".auth-brand h1")).toHaveText("Ortho Center")
    await page.getByRole("link", { name: "¿Olvidaste tu contraseña?", exact: true }).click()
    await expect(page.locator(".auth-brand .clinic-institution-mark")).toHaveText("OC")
    await expect(page.getByRole("button", { name: "Enviar instrucciones", exact: true })).toBeDisabled()
  })
}
