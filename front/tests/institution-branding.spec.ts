import { expect, test, type Page } from "@playwright/test"
import { initialInstitutionProfile } from "../src/modules/institution/types/institution.types"

const key = "clinicapp.institution-profile"
const original = { ...initialInstitutionProfile, name: "Clínica Dental Norte", logoText: "OTRO", branches: [] }
const image = (color: string) => ({ name: "logo.svg", mimeType: "image/svg+xml", buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="96" height="64"><rect width="96" height="64" fill="' + color + '"/></svg>') })
const src = (color: string) => "data:image/svg+xml;base64," + image(color).buffer.toString("base64")
const brand = (page: Page) => page.locator("#desktop-sidebar [data-institution-brand]")
const stored = (page: Page) => page.evaluate((storageKey) => JSON.parse(localStorage.getItem(storageKey)!), key)
const failWrites = (page: Page, fail: boolean) => page.evaluate((value) => Object.assign(window, { failInstitutionBrand: value }), fail)

async function enter(page: Page, theme: "light" | "dark", logoImage: string | null = null) {
  await page.addInitScript(() => {
    const set = Storage.prototype.setItem
    Storage.prototype.setItem = function (key, value) {
      if (key === "clinicapp.institution-profile" && (window as Window & { failInstitutionBrand?: boolean }).failInstitutionBrand) throw new DOMException("Full storage", "QuotaExceededError")
      set.call(this, key, value)
    }
  })
  await page.goto("/login")
  await page.getByRole("button", { name: theme === "light" ? "Tema claro" : "Tema oscuro", exact: true }).click()
  await page.locator("#email").fill("admin@clinica.com"); await page.locator("#password").fill("admin123")
  await page.getByRole("button", { name: "Ingresar", exact: true }).click()
  await page.getByRole("button", { name: "Continuar", exact: true }).click()
  await expect(page).toHaveURL(/\/$/)
  await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key, value: { ...original, logoImage } })
  await page.goto("/perfil-institucion")
  await expect(page.getByRole("heading", { name: "Perfil institucional", exact: true })).toBeVisible()
}

for (const theme of ["light", "dark"] as const) {
  test(`confirmed institution identity syncs immediately, survives reload and preserves personal identity in ${theme}`, async ({ page }) => {
    await enter(page, theme)
    const avatar = page.locator('[data-user-avatar="header"]')
    const personalBefore = await avatar.innerHTML()
    await expect(brand(page).locator("[data-institution-initials]")).toHaveText("CN")
    await expect(brand(page)).toContainText(original.name)
    const name = page.getByLabel("Nombre de la clínica", { exact: true })
    await name.fill("OdontoSur")
    await expect(page.locator("main [data-institution-initials]")).toHaveText("OD")
    await expect(brand(page)).toContainText(original.name)
    await page.getByRole("button", { name: "Crear sede", exact: true }).click()
    const dialog = page.getByRole("dialog", { name: "Nueva sede", exact: true })
    await dialog.getByRole("button", { name: "Guardar sede", exact: true }).click()
    await expect(dialog).not.toBeVisible()
    await expect(brand(page)).toContainText(original.name)
    expect((await stored(page)).name).toBe(original.name)
    await failWrites(page, true)
    await page.getByRole("button", { name: "Guardar cambios", exact: true }).click()
    await expect(page.getByRole("alert")).toContainText("No se pudieron guardar")
    await expect(brand(page)).toContainText(original.name)
    await failWrites(page, false)
    await page.getByRole("button", { name: "Guardar cambios", exact: true }).click()
    await expect(brand(page)).toContainText("OdontoSur")
    await expect(brand(page).locator("[data-institution-initials]")).toHaveText("OD")
    expect(await avatar.innerHTML()).toBe(personalBefore)
    await page.reload()
    await expect(brand(page)).toContainText("OdontoSur")
    expect((await stored(page)).branches).toHaveLength(1)
    expect((await stored(page)).logoText).toBe("OTRO")
    for (const [name, initials] of [["  Clínica   Álamo  ", "CÁ"], ["B", "BB"], ["Dental", "DE"]]) {
      await page.getByLabel("Nombre de la clínica", { exact: true }).fill(name!)
      await page.getByRole("button", { name: "Guardar cambios", exact: true }).click()
      await expect(brand(page).locator("[data-institution-initials]")).toHaveText(initials!)
    }
    await page.getByRole("button", { name: "Cerrar menú", exact: true }).click()
    await expect(brand(page).locator("[data-institution-initials]")).toHaveText("DE")
    await expect(brand(page)).not.toContainText("Dental")
    await page.getByRole("button", { name: "Abrir menú", exact: true }).click()
    await expect(brand(page)).toContainText("Dental")
  })

  test(`valid logo replacement and removal update the Sidebar only on successful save in ${theme}`, async ({ page }) => {
    await enter(page, theme, src("#1643aa"))
    const input = page.getByLabel("Imagen institucional", { exact: true })
    const preview = page.locator('main img[alt="Logo de la clínica"]')
    const sidebarImage = brand(page).getByRole("img", { name: "Logo de la clínica", exact: true })
    await expect(sidebarImage).toHaveAttribute("src", src("#1643aa"))
    const personalBefore = await page.locator('[data-user-avatar="header"]').innerHTML()
    for (const invalid of [{ name: "not-image.txt", mimeType: "text/plain", buffer: Buffer.from("not an image") }, { name: "corrupt.png", mimeType: "image/png", buffer: Buffer.from("not a png") }]) {
      await input.setInputFiles(invalid)
      await expect(page.getByRole("alert")).toContainText("El logo anterior se conserva")
      await expect(preview).toHaveAttribute("src", src("#1643aa"))
      await expect(sidebarImage).toHaveAttribute("src", src("#1643aa"))
    }
    await input.setInputFiles(image("#bb3322"))
    await expect(preview).toHaveAttribute("src", src("#bb3322"))
    await expect(sidebarImage).toHaveAttribute("src", src("#1643aa"))
    await failWrites(page, true)
    await page.getByRole("button", { name: "Guardar cambios", exact: true }).click()
    await expect(page.getByRole("alert")).toContainText("No se pudieron guardar")
    await expect(preview).toHaveAttribute("src", src("#bb3322"))
    await expect(sidebarImage).toHaveAttribute("src", src("#1643aa"))
    await failWrites(page, false)
    await page.getByRole("button", { name: "Guardar cambios", exact: true }).click()
    await expect(sidebarImage).toHaveAttribute("src", src("#bb3322"))
    await expect(page.getByText("Logo institucional guardado.", { exact: true })).toBeVisible()
    await expect(page.getByText("Imagen lista. Pulsa Guardar cambios para aplicarla.", { exact: true })).toHaveCount(0)
    await page.getByRole("switch", { name: "Modo oscuro", exact: true }).click()
    await expect(sidebarImage).toHaveAttribute("src", src("#bb3322"))
    await page.reload()
    await expect(preview).toHaveAttribute("src", src("#bb3322"))
    await expect(sidebarImage).toHaveAttribute("src", src("#bb3322"))
    await page.getByRole("button", { name: "Quitar imagen institucional", exact: true }).click()
    await expect(page.locator("main [data-institution-initials]")).toHaveText("CN")
    await expect(sidebarImage).toHaveAttribute("src", src("#bb3322"))
    await page.getByRole("button", { name: "Guardar cambios", exact: true }).click()
    await expect(brand(page).locator("[data-institution-initials]")).toHaveText("CN")
    expect((await stored(page)).logoImage).toBeNull()
    expect(await page.locator('[data-user-avatar="header"]').innerHTML()).toBe(personalBefore)
    await page.reload()
    await expect(brand(page).locator("[data-institution-initials]")).toHaveText("CN")
  })

  test(`slow or failed image reads cannot overwrite the latest choice in ${theme}`, async ({ page }) => {
    await page.addInitScript(() => {
      const original = FileReader.prototype.readAsDataURL
      FileReader.prototype.readAsDataURL = function (blob) {
        if ((blob as File).name === "slow.svg") setTimeout(() => original.call(this, blob), 900)
        else if ((blob as File).name === "unreadable.svg") throw new DOMException("Read failed", "NotReadableError")
        else original.call(this, blob)
      }
    })
    await enter(page, theme, src("#1643aa"))
    const input = page.getByLabel("Imagen institucional", { exact: true })
    const save = page.getByRole("button", { name: "Guardar cambios", exact: true })
    await input.setInputFiles({ ...image("red"), name: "slow.svg" })
    await expect(save).toBeDisabled()
    await input.setInputFiles(image("green"))
    await expect(save).toBeEnabled()
    await expect(page.locator('main img[alt="Logo de la clínica"]')).toHaveAttribute("src", src("green"))
    await page.waitForTimeout(1100) // Let the superseded read finish; it must not replace the newer draft.
    await expect(page.locator('main img[alt="Logo de la clínica"]')).toHaveAttribute("src", src("green"))
    await input.setInputFiles({ ...image("red"), name: "unreadable.svg" })
    await expect(page.getByRole("alert")).toContainText("El logo anterior se conserva")
    await expect(page.locator('main img[alt="Logo de la clínica"]')).toHaveAttribute("src", src("green"))
    await input.setInputFiles([])
    await expect(page.locator('main img[alt="Logo de la clínica"]')).toHaveAttribute("src", src("green"))
    await save.click()
    await expect(brand(page).getByRole("img")).toHaveAttribute("src", src("green"))
  })

  test(`institution updates from another tab and storage clearing reach the Sidebar in ${theme}`, async ({ page }) => {
    await enter(page, theme)
    const other = await page.context().newPage()
    await other.goto("/login")
    const value = { ...original, name: "Centro Dental Sur", logoImage: src("orange") }
    await other.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key, value })
    await expect(brand(page)).toContainText(value.name)
    await expect(brand(page).getByRole("img")).toHaveAttribute("src", value.logoImage)
    await other.evaluate((storageKey) => localStorage.removeItem(storageKey), key)
    await expect(brand(page)).toContainText(initialInstitutionProfile.name)
    await expect(brand(page).locator("[data-institution-initials]")).toHaveText("CO")
    await other.close()
  })

  test(`required name and optional email errors preserve all saved institution data in ${theme}`, async ({ page }) => {
    await enter(page, theme)
    const before = await stored(page)
    const name = page.getByLabel("Nombre de la clínica", { exact: true })
    await name.fill("   ")
    await page.getByRole("button", { name: "Guardar cambios", exact: true }).click()
    await expect(name).toBeFocused(); await expect(name).toHaveAttribute("aria-invalid", "true")
    await expect(page.getByRole("alert")).toContainText("Introduce el nombre")
    expect(await stored(page)).toEqual(before)
    await name.fill("Clínica Nueva")
    await page.getByLabel("Correo electrónico", { exact: true }).fill("correo incorrecto")
    await page.getByRole("button", { name: "Guardar cambios", exact: true }).click()
    await expect(page.getByRole("alert")).toContainText("correo electrónico válido")
    expect(await stored(page)).toEqual(before)
    await expect(brand(page)).toContainText(before.name)
    await page.getByLabel("Correo electrónico", { exact: true }).fill("")
    await page.getByLabel("RUC", { exact: true }).fill("Registro histórico libre")
    await page.getByRole("button", { name: "Guardar cambios", exact: true }).click()
    expect(await stored(page)).toMatchObject({ name: "Clínica Nueva", email: "", ruc: "Registro histórico libre" })
  })

  test(`compact layout, empty state and mobile Sidebar preserve the institutional identity in ${theme}`, async ({ page }, testInfo) => {
    await enter(page, theme)
    const measures = []
    for (const width of [320, 375, 390, 430, 768, 1024, 1440, 1920]) {
      await page.setViewportSize({ width, height: 1000 })
      await expect(page.getByRole("button", { name: "Crear primera sede", exact: true })).toBeVisible()
      await page.getByRole("heading", { name: "Perfil institucional", exact: true }).scrollIntoViewIfNeeded()
      const general = (await page.getByRole("heading", { name: "Información general", exact: true }).boundingBox())!
      const identity = (await page.getByRole("heading", { name: "Identidad visual", exact: true }).boundingBox())!
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
      expect(scrollWidth).toBeLessThanOrEqual(width)
      if (width >= 1440) expect(Math.abs(general.y - identity.y)).toBeLessThan(2)
      else expect(identity.y).toBeGreaterThan(general.y)
      const actions = page.getByRole("button", { name: "Guardar cambios", exact: true })
      await actions.scrollIntoViewIfNeeded()
      await expect(actions).toHaveCSS("background-color", theme === "light" ? "rgb(83, 80, 204)" : "rgb(228, 242, 34)")
      const footer = (await actions.locator("..").boundingBox())!
      expect(footer.height).toBeLessThan(footer.width < 400 ? 100 : 70)
      measures.push({ width, scrollWidth, generalY: general.y, identityY: identity.y, actionHeight: footer.height })
      if (width < 768) {
        await page.getByRole("button", { name: "Abrir menú", exact: true }).click()
        const mobile = page.locator("#mobile-sidebar [data-institution-brand]")
        await expect(mobile).toContainText(original.name)
        await expect(mobile.locator("[data-institution-initials]")).toHaveText("CN")
        await expect(mobile.locator("[data-institution-initials]")).toHaveCSS("background-color", theme === "light" ? "rgb(83, 80, 204)" : "rgb(228, 242, 34)")
        await page.getByRole("button", { name: "Cerrar menú", exact: true }).click()
      }
    }
    await testInfo.attach("institution-layout-" + theme, { body: JSON.stringify(measures, null, 2), contentType: "application/json" })
  })
}
