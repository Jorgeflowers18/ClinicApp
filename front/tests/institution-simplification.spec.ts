import { setAccessTheme } from "./helpers/access-theme"
import { expect, test, type Page } from "@playwright/test"
import { initialInstitutionProfile } from "../src/modules/institution/types/institution.types"
import { institutionInitials } from "../src/modules/institution/lib/institution-initials"
import { logoutFromHeader } from "./helpers/app-navigation"

test.use({ reducedMotion: "reduce", hasTouch: true })
const key = "clinicapp.institution-profile"
const original = { ...initialInstitutionProfile, name: "Laboratorio Dental", subtitle: "Prótesis y rehabilitación", logoText: "ZZ" }
const brand = (page: Page) => page.locator("#desktop-sidebar [data-institution-brand]")
const preview = (page: Page) => page.locator("[data-institution-preview]")
const help = (page: Page) => page.getByRole("button", { name: "Información del subtítulo institucional", exact: true })
const tooltip = (page: Page) => page.getByRole("tooltip").filter({ hasText: "Este texto aparecerá debajo del nombre institucional en el menú lateral" })
const name = (page: Page) => page.getByLabel("Nombre de la clínica o institución", { exact: true })
const subtitle = (page: Page) => page.getByLabel("Subtítulo institucional", { exact: true })

async function enter(page: Page, theme: "light" | "dark") {
  await page.goto("/login")
  await setAccessTheme(page, theme === "light" ? "light" : "dark")
  await page.locator("#email").fill("admin@clinica.com"); await page.locator("#password").fill("admin123")
  await page.getByRole("button", { name: "Ingresar", exact: true }).click()
  await page.getByRole("button", { name: "Continuar", exact: true }).click()
  await expect(page).toHaveURL(/\/$/)
  await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key, value: original })
  await page.goto("/perfil-institucion")
  await expect(subtitle(page)).toBeVisible()
}

test("the shared initials follow the institutional examples, brand convention and Unicode names", () => {
  for (const [value, expected] of [
    ["ClinicApp", "CA"], ["ClinicApp Odontología", "CA"], ["clinicapp", "CA"], ["Dental Sonrisas", "DS"],
    ["Laboratorio Dental", "LD"], ["Odonto Vida", "OV"], ["Clínica San José", "CS"], ["Dental", "DE"],
    ["   Élite    Álamo   ", "ÉÁ"], ["E\u0301lite A\u0301lamo", "ÉÁ"], ["Á", "ÁÁ"], ["a", "AA"],
    ["", "CA"], ["   ", "CA"], ["OdontoSur", "OD"],
  ]) expect(institutionInitials(value!)).toBe(expected)
})

for (const theme of ["light", "dark"] as const) {
  test(`automatic initials agree across preview, saved Sidebar, Login and access request in ${theme}`, async ({ page }) => {
    await enter(page, theme)
    await expect(page.getByLabel("Texto del logo", { exact: true })).toHaveCount(0)
    await expect(page.locator('input[name="logoText"]')).toHaveCount(0)
    await expect(page.getByRole("button", { name: "Subir logo", exact: true })).toBeVisible()
    await expect(page.getByText("Iniciales generadas automáticamente", { exact: true })).toBeVisible()
    let previous = "LD"
    for (const [value, expected] of [["ClinicApp", "CA"], ["Clínica San José", "CS"], ["Dental", "DE"], [" Élite   Álamo ", "ÉÁ"], ["A", "AA"], ["Odonto Vida", "OV"]]) {
      await name(page).fill(value!)
      await expect(preview(page).locator("[data-institution-initials]")).toHaveText(expected!)
      await expect(brand(page).locator("[data-institution-initials]")).toHaveText(previous)
      await page.getByRole("button", { name: "Guardar cambios", exact: true }).click()
      await expect(brand(page).locator("[data-institution-initials]")).toHaveText(expected!)
      expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).logoText, key)).toBe("ZZ")
      previous = expected!
    }
    await page.reload()
    await expect(preview(page).locator("[data-institution-initials]")).toHaveText("OV")
    await logoutFromHeader(page)
    await expect(page).toHaveURL(/\/login$/)
    const mark = page.locator(".auth-brand .clinic-institution-mark")
    await expect(mark).toHaveText("OV")
    await expect(mark).toHaveCSS("background-color", theme === "light" ? "rgb(83, 80, 204)" : "rgb(228, 242, 34)")
    await page.getByRole("link", { name: "Solicitar acceso", exact: true }).click()
    await expect(mark).toHaveText("OV")
    await page.reload()
    await expect(mark).toHaveText("OV")
    await expect(page.locator(".auth-brand h1")).toHaveText("Odonto Vida")
  })

  test(`subtitle help works with mouse, keyboard and touch without shifting fields or hiding validation in ${theme}`, async ({ page }, info) => {
    await enter(page, theme)
    for (const width of [320,375,390,430,600,768,1024,1440,1920]) {
      await page.setViewportSize({ width, height: 1000 })
      await help(page).scrollIntoViewIfNeeded()
      const first = (await name(page).boundingBox())!, second = (await subtitle(page).boundingBox())!
      expect(first.height).toBe(second.height)
      if (second.x > first.x + 5) expect(Math.abs(first.y - second.y)).toBeLessThan(1)
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
      await expect(page.locator("#institution-hint-subtitle")).toHaveCount(0)
      if ([320,1440].includes(width)) {
        await help(page).hover(); await expect(tooltip(page)).toBeVisible()
        expect(await subtitle(page).boundingBox()).toEqual(second)
        await page.keyboard.press("Escape"); await expect(tooltip(page)).not.toBeVisible()
        await help(page).tap(); await expect(tooltip(page)).toBeVisible()
        expect(await subtitle(page).boundingBox()).toEqual(second)
        await name(page).click(); await expect(tooltip(page)).not.toBeVisible()
      }
      if ([375,1440].includes(width)) await page.screenshot({ path: info.outputPath(`simplified-${theme}-${width}.png`) })
    }
    await help(page).focus(); await page.keyboard.press("Tab"); await page.keyboard.press("Shift+Tab")
    await expect(help(page)).toBeFocused(); await expect(tooltip(page)).toBeVisible()
    await page.keyboard.press("Escape"); await expect(tooltip(page)).not.toBeVisible()
    await name(page).fill(""); await page.getByRole("button", { name: "Guardar cambios", exact: true }).click()
    await expect(name(page)).toHaveAttribute("aria-invalid", "true")
    await expect(page.getByRole("alert")).toContainText("Introduce el nombre")
    await expect(name(page)).toHaveAccessibleDescription("Introduce el nombre de la clínica o institución.")
    const invalid = (await name(page).boundingBox())!, other = (await subtitle(page).boundingBox())!
    expect(invalid.y).toBe(other.y)
    expect((await page.getByRole("alert").boundingBox())!.y).toBeGreaterThanOrEqual(invalid.y + invalid.height)
  })
}
