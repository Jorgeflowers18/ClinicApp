import { setAccessTheme } from "./helpers/access-theme"
import { expect, test, type Page } from "@playwright/test"
import { initialInstitutionProfile } from "../src/modules/institution/types/institution.types"

test.use({ reducedMotion: "reduce" })
const key = "clinicapp.institution-profile"
const initial = { ...initialInstitutionProfile, name: "Laboratorio Dental", subtitle: "Prótesis y rehabilitación", legalName: "Servicios Profesionales S.A.", logoText: "OTRO" }
const brand = (page: Page) => page.locator("#desktop-sidebar [data-institution-brand]")
const preview = (page: Page) => page.locator("[data-institution-preview]")
const name = (page: Page) => page.getByLabel("Nombre de la clínica o institución", { exact: true })
const subtitle = (page: Page) => page.getByLabel("Subtítulo institucional", { exact: true })
const save = (page: Page) => page.getByRole("button", { name: "Guardar cambios", exact: true })
const stored = (page: Page) => page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), key)
const image = (color: string) => ({ name: "logo.svg", mimeType: "image/svg+xml", buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="60"><rect width="120" height="60" fill="' + color + '"/></svg>') })
const src = (color: string) => "data:image/svg+xml;base64," + image(color).buffer.toString("base64")

async function enter(page: Page, theme: "light" | "dark", value: object = initial) {
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = function (key, value) {
      if (key === "clinicapp.institution-profile" && (window as Window & { rejectIdentityWrite?: boolean }).rejectIdentityWrite) throw new DOMException("Full storage", "QuotaExceededError")
      original.call(this, key, value)
    }
  })
  await page.goto("/login")
  await setAccessTheme(page, theme === "light" ? "light" : "dark")
  await page.locator("#email").fill("admin@clinica.com"); await page.locator("#password").fill("admin123")
  await page.getByRole("button", { name: "Ingresar", exact: true }).click()
  await page.getByRole("button", { name: "Continuar", exact: true }).click()
  await expect(page).toHaveURL(/\/$/)
  await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key, value })
  await page.goto("/perfil-institucion")
  await expect(subtitle(page)).toBeVisible()
}

for (const theme of ["light", "dark"] as const) {
  test(`name and subtitle change independently and together without altering other data in ${theme}`, async ({ page }) => {
    await enter(page, theme)
    const avatar = await page.locator('[data-user-avatar="header"]').innerHTML()
    let previous = initial
    for (const [nextName, nextSubtitle, initials] of [["Dental Sonrisas", initial.subtitle, "DS"], ["Dental Sonrisas", "Ortodoncia especializada", "DS"], ["Ortho Center", "Consultorio dental", "OC"]]) {
      await name(page).fill(nextName!); await subtitle(page).fill(nextSubtitle!)
      await expect(preview(page).locator("[data-institution-name]")).toHaveText(nextName!)
      await expect(preview(page).locator("[data-institution-subtitle]")).toHaveText(nextSubtitle!)
      await expect(brand(page).locator("[data-institution-name]")).toHaveText(previous.name)
      await expect(brand(page).locator("[data-institution-subtitle]")).toHaveText(previous.subtitle)
      expect(await stored(page)).toEqual(previous)
      await save(page).click()
      previous = { ...previous, name: nextName!, subtitle: nextSubtitle! }
      expect(await stored(page)).toEqual(previous)
      await expect(brand(page).locator("[data-institution-name]")).toHaveText(nextName!)
      await expect(brand(page).locator("[data-institution-subtitle]")).toHaveText(nextSubtitle!)
      await expect(brand(page).locator("[data-institution-initials]")).toHaveText(initials!)
    }
    await page.reload()
    await expect(subtitle(page)).toHaveValue(previous.subtitle)
    await expect(brand(page).locator("[data-institution-name]")).toHaveText(previous.name)
    expect(await page.locator('[data-user-avatar="header"]').innerHTML()).toBe(avatar)
  })

  test(`legacy profiles remain intact and an omitted subtitle creates no fixed secondary text in ${theme}`, async ({ page }) => {
    const { subtitle: omitted, ...legacy } = initial
    expect(omitted).not.toBe("")
    await enter(page, theme, legacy)
    await expect(subtitle(page)).toHaveValue("")
    await expect(subtitle(page)).not.toHaveAttribute("required")
    await expect(page.getByRole("button", { name: "Información del subtítulo institucional", exact: true })).toBeVisible()
    expect(await stored(page)).toEqual(legacy)
    await expect(brand(page).locator("[data-institution-subtitle]")).toHaveCount(0)
    const mark = (await brand(page).locator("[data-institution-initials]").boundingBox())!, label = (await brand(page).locator("[data-institution-name]").boundingBox())!
    expect(Math.abs(mark.y + mark.height / 2 - label.y - label.height / 2)).toBeLessThan(1)
    await subtitle(page).fill("Centro de salud oral"); await save(page).click()
    await expect(brand(page).locator("[data-institution-subtitle]")).toHaveText("Centro de salud oral")
    await subtitle(page).fill(""); await save(page).click(); await page.reload()
    expect(await stored(page)).toEqual({ ...legacy, subtitle: "" })
    await expect(subtitle(page)).toHaveValue("")
    await expect(brand(page).locator("[data-institution-subtitle]")).toHaveCount(0)
    await expect(preview(page).locator("[data-institution-subtitle]")).toHaveCount(0)
    await expect(brand(page).locator("[data-institution-name]")).toHaveText(legacy.name)
  })

  test(`failed saves and cancel preserve the confirmed name, subtitle and photograph in ${theme}`, async ({ page }) => {
    const confirmed = { ...initial, logoImage: src("#1643aa") }
    await enter(page, theme, confirmed)
    await name(page).fill("Dental Vida"); await subtitle(page).fill("Especialidades dentales")
    await page.getByLabel("Imagen institucional", { exact: true }).setInputFiles(image("#bb3322"))
    await expect(preview(page).getByRole("img")).toHaveAttribute("src", src("#bb3322"))
    await page.evaluate(() => Object.assign(window, { rejectIdentityWrite: true }))
    await save(page).click()
    await expect(page.getByRole("alert")).toContainText("No se pudieron guardar")
    expect(await stored(page)).toEqual(confirmed)
    await expect(brand(page).locator("[data-institution-subtitle]")).toHaveText(confirmed.subtitle)
    await expect(brand(page).getByRole("img")).toHaveAttribute("src", confirmed.logoImage)
    await expect(subtitle(page)).toHaveValue("Especialidades dentales")
    await page.getByRole("button", { name: "Cancelar", exact: true }).click()
    await expect(name(page)).toHaveValue(confirmed.name)
    await expect(subtitle(page)).toHaveValue(confirmed.subtitle)
    await expect(preview(page).getByRole("img")).toHaveAttribute("src", confirmed.logoImage)
    await expect(page.getByRole("alert")).toHaveCount(0)
    expect(await stored(page)).toEqual(confirmed)
    await page.evaluate(() => Object.assign(window, { rejectIdentityWrite: false }))
    await name(page).fill("Dental Vida"); await subtitle(page).fill("Clínica odontológica")
    await save(page).click()
    await expect(brand(page).locator("[data-institution-subtitle]")).toHaveText("Clínica odontológica")
    await page.getByRole("button", { name: "Quitar imagen institucional", exact: true }).click()
    await subtitle(page).fill("")
    await page.getByRole("button", { name: "Cancelar", exact: true }).click()
    await expect(preview(page).getByRole("img")).toHaveAttribute("src", confirmed.logoImage)
    await expect(subtitle(page)).toHaveValue("Clínica odontológica")
    expect(await stored(page)).toEqual({ ...confirmed, name: "Dental Vida", subtitle: "Clínica odontológica" })
    await page.reload()
    await expect(brand(page).getByRole("img")).toHaveAttribute("src", confirmed.logoImage)
  })

  test(`long institutional identity fits all widths and remains accessible when collapsed in ${theme}`, async ({ page }, info) => {
    const identity = { ...initial, name: "Laboratorio de rehabilitación y especialidades odontológicas del Centro Norte", subtitle: "Prótesis, ortodoncia y especialidades dentales de atención integral" }
    await enter(page, theme, identity)
    const errors: string[] = []
    page.on("pageerror", (error) => errors.push(error.message))
    for (const width of [320,375,390,430,768,1024,1440,1920]) {
      await page.setViewportSize({ width, height: 1000 })
      await name(page).scrollIntoViewIfNeeded()
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
      const first = (await name(page).boundingBox())!, second = (await subtitle(page).boundingBox())!
      if (width >= 1440) expect(Math.abs(first.y - second.y)).toBeLessThan(1)
      if (width < 430) expect(second.y).toBeGreaterThan(first.y + first.height)
      if (await page.getByRole("button", { name: "Abrir menú", exact: true }).isVisible()) await page.getByRole("button", { name: "Abrir menú", exact: true }).click()
      const visibleBrand = width < 768 ? page.locator("#mobile-sidebar [data-institution-brand]") : brand(page)
      await expect(visibleBrand.locator("[data-institution-name]")).toHaveText(identity.name)
      await expect(visibleBrand.locator("[data-institution-subtitle]")).toHaveText(identity.subtitle)
      await expect(visibleBrand.locator("[data-institution-initials]")).toHaveCSS("background-color", theme === "light" ? "rgb(83, 80, 204)" : "rgb(228, 242, 34)")
      expect(await visibleBrand.evaluate((root) => root.scrollWidth <= root.clientWidth)).toBe(true)
      if ([390,1440].includes(width)) await page.screenshot({ path: info.outputPath(`identity-${theme}-${width}.png`), fullPage: true })
      if (width < 768) await page.getByRole("button", { name: "Cerrar menú", exact: true }).click()
    }
    await page.getByRole("button", { name: "Cerrar menú", exact: true }).click()
    await expect(brand(page).locator("[data-institution-name]")).toHaveCount(0)
    await expect(brand(page).locator("[data-institution-initials]")).toBeVisible()
    await brand(page).focus()
    await page.keyboard.press("Tab"); await page.keyboard.press("Shift+Tab")
    await expect(brand(page)).toBeFocused()
    await expect(brand(page)).toHaveAccessibleName(identity.name + " · " + identity.subtitle)
    // Base UI makes the visual popup inert when hoverable content is disabled;
    // the trigger's accessible name provides the complete institutional identity.
    const tooltip = page.locator('[data-slot="tooltip-content"]').filter({ hasText: identity.name })
    await expect(tooltip).toBeVisible()
    await expect(tooltip).toContainText(identity.name)
    await expect(tooltip).toContainText(identity.subtitle)
    await page.keyboard.press("Escape")
    await page.getByRole("button", { name: "Abrir menú", exact: true }).click()
    await expect(brand(page).locator("[data-institution-subtitle]")).toHaveText(identity.subtitle)
    expect(errors).toEqual([])
  })

  test(`subtitle from another tab reaches the Sidebar and cancel restores the latest confirmed record in ${theme}`, async ({ page }) => {
    await enter(page, theme)
    await subtitle(page).fill("Borrador local pendiente")
    const other = await page.context().newPage()
    await other.goto("/login")
    const confirmed = { ...initial, subtitle: "Laboratorio odontológico", logoImage: src("#1643aa") }
    await other.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key, value: confirmed })
    await expect(brand(page).locator("[data-institution-subtitle]")).toHaveText(confirmed.subtitle)
    await expect(subtitle(page)).toHaveValue("Borrador local pendiente")
    await page.getByRole("button", { name: "Cancelar", exact: true }).click()
    await expect(subtitle(page)).toHaveValue(confirmed.subtitle)
    await expect(preview(page).getByRole("img")).toHaveAttribute("src", confirmed.logoImage)
    expect(await stored(page)).toEqual(confirmed)
    await other.close()
  })
}
