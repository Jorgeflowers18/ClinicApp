import { setAccessTheme } from "./helpers/access-theme"
import { expect, test, type Page } from "@playwright/test"

test.use({ timezoneId: "America/Guayaquil" })
test.describe.configure({ mode: "parallel" })
const widths = [320, 360, 375, 390, 430, 600, 768, 1024, 1280, 1440, 1920]
const photo = (color: string) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="96" height="96" fill="${color}"/><circle cx="48" cy="35" r="20" fill="white"/></svg>`)

async function enter(page: Page, theme: "light" | "dark") {
  await page.goto("/login")
  await setAccessTheme(page, theme === "light" ? "light" : "dark")
  await page.locator("#email").fill("admin@clinica.com")
  await page.locator("#password").fill("admin123")
  await page.getByRole("button", { name: "Ingresar", exact: true }).click()
  await expect(page.getByRole("heading", { name: "Completa tu perfil", exact: true })).toBeVisible()
}

async function session(page: Page) {
  return page.evaluate(() => JSON.parse(sessionStorage.getItem("clinicapp.mock-session")!))
}

for (const theme of ["light", "dark"] as const) {
  test(`two initials follow real names and the theme keeps the draft and legacy profile data in ${theme}`, async ({ page }) => {
    await enter(page, theme)
    const before = await session(page)
    const initials = page.locator('[data-profile-initials="profile"]')
    const name = page.getByLabel("Nombre completo", { exact: true })
    const primary = theme === "light" ? "rgb(83, 80, 204)" : "rgb(228, 242, 34)"
    const submit = page.getByRole("button", { name: "Continuar", exact: true })
    await expect(submit).toHaveCSS("background-color", primary)
    await expect(page.getByRole("button", { name: /^Seleccionar color/ })).toHaveCount(0)
    for (const [fullName, expected] of [
      ["Fernando Padilla", "FP"], ["Ana Morales", "AM"], ["Carlos Pérez", "CP"], ["María González", "MG"],
      ["   José   Luis   García   Pérez   ", "JP"], ["Ana", "AN"], ["A", "A"], ["   ", ""], ["E\u0301mile Durand", "ÉD"],
    ]) {
      await name.fill(fullName)
      if (expected) await expect(initials).toHaveText(expected)
      else await expect(page.locator('[data-user-avatar="profile"]').getByRole("img", { name: "Usuario sin nombre", exact: true })).toBeVisible()
      await expect(name).toHaveValue(fullName)
    }
    await name.fill("  Fernando Padilla  ")
    await page.getByLabel("Cargo", { exact: true }).fill("  Director  ")
    await page.getByLabel("Especialidad", { exact: true }).fill("  Odontología  ")
    const longBio = `  ${"Atención integral. ".repeat(30)}  `
    await page.getByLabel("Biografía breve", { exact: true }).fill(longBio)
    await expect(page.locator("#user-profile-bio-count")).toHaveText(`${longBio.length} caracteres`)
    await expect(name).not.toHaveAttribute("required")
    await expect(page.getByLabel("Biografía breve", { exact: true })).not.toHaveAttribute("maxlength")
    await page.getByRole("button", { name: theme === "light" ? "Cambiar a tema oscuro" : "Cambiar a tema claro", exact: true }).click()
    await expect(name).toHaveValue("  Fernando Padilla  ")
    await expect(initials).toHaveText("FP")
    await expect(page.getByLabel("Biografía breve", { exact: true })).toHaveValue(longBio)
    expect(await session(page)).toEqual(before)
    await submit.click()
    await expect(page).toHaveURL(/\/$/)
    const saved = await session(page)
    expect(saved.accessToken).toBe(before.accessToken)
    expect(saved.user.role).toBe(before.user.role)
    expect(saved.user.profile).toEqual({ fullName: "Fernando Padilla", title: "Director", specialty: "Odontología", bio: longBio.trim(), avatarColor: "#1f2937", avatarImage: null })
    await page.reload()
    await page.goto("/perfil-usuario")
    await expect(name).toHaveValue("Fernando Padilla")
    await expect(initials).toHaveText("FP")
  })

  test(`photo upload, replacement and a stored image cleared to null use the existing persistence in ${theme}`, async ({ page }) => {
    await enter(page, theme)
    const before = await session(page)
    const firstPhoto = photo("#5350cc"), nextPhoto = photo("#007384")
    const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.getByRole("button", { name: "Subir foto", exact: true }).click()])
    await chooser.setFiles({ name: "avatar.svg", mimeType: "image/svg+xml", buffer: firstPhoto })
    expect(await session(page)).toEqual(before)
    await page.getByRole("dialog", { name: "Vista previa de fotografía", exact: true }).getByRole("button", { name: "Confirmar fotografía", exact: true }).click()
    const image = page.getByRole("img", { name: "Avatar del usuario", exact: true })
    await expect(image).toHaveAttribute("src", `data:image/svg+xml;base64,${firstPhoto.toString("base64")}`)
    await expect(page.getByRole("button", { name: "Cambiar foto", exact: true })).toBeVisible()
    await expect(page.locator('[data-profile-initials="profile"]')).toHaveCount(0)
    await page.getByRole("button", { name: "Continuar", exact: true }).click()
    await page.goto("/perfil-usuario")
    await expect(image).toBeVisible()
    await page.locator('input[type="file"]').setInputFiles({ name: "replacement.svg", mimeType: "image/svg+xml", buffer: nextPhoto })
    await page.getByRole("dialog", { name: "Vista previa de fotografía", exact: true }).getByRole("button", { name: "Confirmar fotografía", exact: true }).click()
    await expect(image).toHaveAttribute("src", `data:image/svg+xml;base64,${nextPhoto.toString("base64")}`)
    await page.getByRole("button", { name: "Guardar cambios", exact: true }).click()
    await page.reload()
    await page.goto("/perfil-usuario")
    await expect(image).toHaveAttribute("src", `data:image/svg+xml;base64,${nextPhoto.toString("base64")}`)
    await page.getByRole("button", { name: "Opciones de fotografía", exact: true }).click()
    await page.getByRole("menuitem", { name: "Eliminar fotografía", exact: true }).click()
    await page.getByRole("alertdialog", { name: "Eliminar fotografía", exact: true }).getByRole("button", { name: "Eliminar fotografía", exact: true }).click()
    await page.reload()
    await expect(image).toHaveCount(0)
    await expect(page.locator('[data-profile-initials="profile"]')).toHaveText("AM")
    expect((await session(page)).user.profile.avatarColor).toBe("#1f2937")
  })

  test(`profile columns and touch controls fit all eleven widths during setup and editing in ${theme}`, async ({ page }, testInfo) => {
    await enter(page, theme)
    const records = []
    for (const mode of ["setup", "editing"]) {
      if (mode === "editing") {
        await page.getByRole("button", { name: "Continuar", exact: true }).click()
        await page.goto("/perfil-usuario")
        await expect(page.getByRole("heading", { name: "Mi perfil", exact: true })).toBeVisible()
      }
      for (const width of widths) {
        await page.setViewportSize({ width, height: 1000 })
        const identity = page.getByRole("region", { name: "Identidad del usuario", exact: true })
        const fields = page.getByRole("region", { name: "Información del perfil", exact: true })
        await expect(identity).toBeVisible()
        const left = await identity.boundingBox(), right = await fields.boundingBox(), columns = await page.locator("[data-profile-columns]").boundingBox()
        if (columns!.width >= 640) {
          expect(Math.abs(left!.y - right!.y)).toBeLessThanOrEqual(1)
          expect(left!.x + left!.width).toBeLessThan(right!.x)
          expect(right!.width).toBeGreaterThan(left!.width)
        } else {
          expect(right!.y).toBeGreaterThan(left!.y + left!.height)
          expect(Math.abs(left!.x - right!.x)).toBeLessThanOrEqual(1)
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
        const controls = page.locator('[data-profile-columns] input:not([type="file"]), [data-profile-columns] textarea, [data-profile-columns] button, .clinic-file-upload')
        for (const control of await controls.all()) {
          const bounds = await control.boundingBox()
          expect(bounds!.x).toBeGreaterThanOrEqual(0)
          expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width + 1)
          if (width < 1024) expect(bounds!.height).toBeGreaterThanOrEqual(44)
        }
        records.push({ mode, width, identity: left, fields: right, columns })
      }
    }
    await testInfo.attach("profile-responsive-matrix", { body: JSON.stringify(records, null, 2), contentType: "application/json" })
  })
}

test("presentation initials handle empty, Unicode and single-character names without modifying stored data", async ({ page }) => {
  await page.goto("/login")
  const actual = await page.evaluate(async () => {
    const source = "/src/modules/auth/components/profile-initials.ts"
    const { getProfileInitials } = await import(source)
    return ["", "  ", "Ana", "A", "Å", "E\u0301mile Durand", "Ana\tMaría\nMorales", "José Luis García Pérez"].map(getProfileInitials)
  })
  expect(actual).toEqual(["", "", "AN", "A", "Å", "ÉD", "AM", "JP"])
})
