import { expect, test, type Page } from "@playwright/test"
import type { InstitutionBranch, InstitutionProfile } from "../src/modules/institution/types/institution.types"

const storageKey = "clinicapp.institution-profile"
const widths = [320, 360, 375, 390, 430, 600, 768, 1024, 1280, 1440, 1920]
const photo = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII="
const initial: InstitutionProfile = {
  name: "Clínica de origen", legalName: "Grupo Dental S.A.", ruc: "1798765432001", phone: "+593 98 123 4567",
  email: "contacto@clinica.test", address: "Av. Amazonas, Quito", website: "https://clinica.test", logoText: "CA", logoImage: null,
  notes: "Atención odontológica integral.", hours: "Lunes a viernes: 08:00 - 18:00\nSábados: 08:00 - 13:00", branches: [],
}
const branches = (count: number): InstitutionBranch[] => Array.from({ length: count }, (_, index) => ({
  id: `existing-${index}`, name: index === 0 ? "Sede Central" : `Sede ${index + 1}`,
  address: `Av. de la República N${index + 10}-120, edificio de atención odontológica, Quito`,
  phone: `+593 98 123 456${index % 10}`, hours: "Lunes a viernes: 08:00 - 18:00\nSábados: 08:00 - 13:00", isMain: index === 0,
}))

async function enter(page: Page, theme: "light" | "dark", locations = branches(2)) {
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = function (key, value) {
      if (key === "clinicapp.institution-profile" && (window as Window & { failInstitution?: boolean }).failInstitution) {
        throw new DOMException("Simulated full storage", "QuotaExceededError")
      }
      original.call(this, key, value)
    }
  })
  await page.goto("/login")
  await page.getByRole("button", { name: theme === "light" ? "Tema claro" : "Tema oscuro", exact: true }).click()
  await page.locator("#email").fill("admin@clinica.com")
  await page.locator("#password").fill("admin123")
  await page.getByRole("button", { name: "Ingresar", exact: true }).click()
  await page.getByRole("button", { name: "Continuar", exact: true }).click()
  await page.evaluate(({ key, data }) => localStorage.setItem(key, JSON.stringify(data)), { key: storageKey, data: { ...initial, branches: locations } })
  await page.goto("/perfil-institucion")
  await expect(page.getByRole("heading", { name: "Perfil institucional", exact: true })).toBeVisible()
}
const stored = (page: Page): Promise<InstitutionProfile> => page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), storageKey)
const failWrites = (page: Page, value: boolean) => page.evaluate((fail) => Object.assign(window, { failInstitution: fail }), value)
async function action(page: Page, name: string, operation: "Editar sede" | "Eliminar sede") {
  await page.getByRole("button", { name: `Acciones de sede ${name}`, exact: true }).click()
  await page.getByRole("menuitem", { name: operation, exact: true }).click()
}
async function create(page: Page, name: string) {
  await page.getByRole("button", { name: "Crear sede", exact: true }).click()
  const dialog = page.getByRole("dialog", { name: "Nueva sede", exact: true })
  await dialog.getByLabel("Nombre de la sede", { exact: true }).fill(name)
  await dialog.getByRole("button", { name: "Guardar sede", exact: true }).click()
  await expect(dialog).not.toBeVisible()
}

for (const theme of ["light", "dark"] as const) {
  test(`institution metadata, free-text hours and logo persist in ${theme}`, async ({ page }) => {
    await enter(page, theme)
    for (const key of ["name", "legalName", "ruc", "website", "notes", "phone", "email", "address"] as const) {
      await expect(page.locator(`#institution-profile-${key}`)).toHaveValue(initial[key])
    }
    await expect(page.getByLabel("Horarios de atención", { exact: true })).toHaveValue(initial.hours)
    const next = { ...initial, name: "Clínica Renovada", legalName: "Nueva Razón S.A.", ruc: "RUC libre como antes", website: "https://nueva.test", notes: "Descripción editada", phone: "0987654321", email: "nueva@clinica.test", address: "Calle Nueva 123", hours: "Atención con cita previa\nSábados: 09:00 - 12:00", logoText: "CD", logoImage: `data:image/png;base64,${photo}`, branches: branches(2) }
    for (const key of ["name", "legalName", "ruc", "website", "notes", "phone", "email", "address", "logoText"] as const) {
      await page.locator(`#institution-profile-${key}`).fill(next[key])
    }
    await page.getByLabel("Horarios de atención", { exact: true }).fill(next.hours)
    await page.locator('input[type="file"]').setInputFiles({ name: "clinic.png", mimeType: "image/png", buffer: Buffer.from(photo, "base64") })
    const logo = page.locator('main img[alt="Logo de la clínica"]')
    await expect(logo).toHaveAttribute("src", next.logoImage)
    await expect(page.getByText("Cambios sin guardar", { exact: true })).toBeVisible()
    expect(await stored(page)).toEqual({ ...initial, branches: branches(2) })
    await page.getByRole("button", { name: "Guardar cambios", exact: true }).click()
    expect(await stored(page)).toEqual(next)
    await page.reload()
    await expect(page.locator("#institution-profile-name")).toHaveValue(next.name)
    await expect(page.getByLabel("Horarios de atención", { exact: true })).toHaveValue(next.hours)
    await expect(logo).toHaveAttribute("src", next.logoImage)
    await page.getByRole("switch", { name: "Modo oscuro", exact: true }).click()
    await expect(logo).toHaveAttribute("src", next.logoImage)
    expect((await stored(page)).logoImage).toBe(next.logoImage)
  })

  test(`branch create, edit, cancel, delete and isolated persistence in ${theme}`, async ({ page }) => {
    await enter(page, theme, [])
    const section = page.locator("[data-institution-branches]")
    await expect(section.getByText("Aún no hay sedes registradas", { exact: true })).toBeVisible()
    const first = page.getByRole("button", { name: "Crear primera sede", exact: true })
    await first.click()
    let dialog = page.getByRole("dialog", { name: "Nueva sede", exact: true })
    await dialog.getByLabel("Nombre de la sede", { exact: true }).fill("Descartar")
    await dialog.getByRole("button", { name: "Cancelar", exact: true }).click()
    expect((await stored(page)).branches).toEqual([])
    await expect(first).toBeFocused()
    await page.locator("#institution-profile-name").fill("Nombre todavía pendiente")
    await page.getByRole("button", { name: "Crear sede", exact: true }).click()
    dialog = page.getByRole("dialog", { name: "Nueva sede", exact: true })
    await dialog.getByLabel("Nombre de la sede", { exact: true }).fill("Sede Norte")
    await dialog.getByLabel("Dirección", { exact: true }).fill("Av. Norte 123")
    await dialog.getByLabel("Teléfono", { exact: true }).fill("0991234567")
    await dialog.getByLabel("Horarios", { exact: true }).fill("Lunes a viernes 09:00 - 17:00")
    await dialog.getByRole("button", { name: "Guardar sede", exact: true }).click()
    await expect(dialog).not.toBeVisible()
    const confirmed = (await stored(page)).branches[0]!
    expect(confirmed).toMatchObject({ name: "Sede Norte", address: "Av. Norte 123", phone: "0991234567", hours: "Lunes a viernes 09:00 - 17:00", isMain: true })
    expect((await stored(page)).name).toBe(initial.name)
    await expect(page.locator("#institution-profile-name")).toHaveValue("Nombre todavía pendiente")
    await expect(section.getByRole("cell", { name: "Principal", exact: true })).toBeVisible()
    await action(page, "Sede Norte", "Editar sede")
    const edit = page.getByRole("dialog", { name: "Editar sede", exact: true })
    for (const [label, key] of [["Nombre de la sede", "name"], ["Dirección", "address"], ["Teléfono", "phone"], ["Horarios", "hours"]] as const) {
      await expect(edit.getByLabel(label, { exact: true })).toHaveValue(confirmed[key])
    }
    await edit.getByLabel("Nombre de la sede", { exact: true }).fill("No guardar")
    await edit.getByRole("button", { name: "Cancelar", exact: true }).click()
    expect((await stored(page)).branches).toEqual([confirmed])
    await expect(page.getByRole("button", { name: "Acciones de sede Sede Norte", exact: true })).toBeFocused()
    await action(page, "Sede Norte", "Editar sede")
    await edit.getByLabel("Nombre de la sede", { exact: true }).fill("Sede Norte editada")
    await edit.getByRole("button", { name: "Guardar sede", exact: true }).click()
    expect((await stored(page)).branches).toEqual([{ ...confirmed, name: "Sede Norte editada" }])
    await create(page, "Sede Sur")
    expect((await stored(page)).branches.map((b) => b.isMain)).toEqual([true, false])
    await page.getByRole("button", { name: "Guardar cambios", exact: true }).click()
    expect((await stored(page)).branches).toHaveLength(2)
    await page.reload()
    await expect(page.locator("#institution-profile-name")).toHaveValue("Nombre todavía pendiente")
    await action(page, "Sede Norte editada", "Eliminar sede")
    const confirmation = page.getByRole("alertdialog")
    await expect(confirmation).toContainText("Sede Norte editada")
    await confirmation.getByRole("button", { name: "Cancelar", exact: true }).click()
    expect((await stored(page)).branches).toHaveLength(2)
    await action(page, "Sede Norte editada", "Eliminar sede")
    await confirmation.getByRole("button", { name: "Eliminar sede", exact: true }).click()
    // Existing rule: deleting the principal is allowed and does not promote another.
    expect((await stored(page)).branches).toMatchObject([{ name: "Sede Sur", isMain: false }])
    await expect(page.getByRole("button", { name: "Crear sede", exact: true })).toBeFocused()
    await page.reload()
    await expect(section.getByRole("cell", { name: "Sede Sur", exact: true })).toBeVisible()
    await action(page, "Sede Sur", "Eliminar sede")
    await confirmation.getByRole("button", { name: "Eliminar sede", exact: true }).click()
    await expect(section.getByText("Aún no hay sedes registradas", { exact: true })).toBeVisible()
    expect((await stored(page)).branches).toEqual([])
  })

  test(`failed writes retain records, drafts and dialogs, then allow retry in ${theme}`, async ({ page }) => {
    await enter(page, theme)
    const original = await stored(page)
    await failWrites(page, true)
    await page.locator("#institution-profile-name").fill("Borrador protegido")
    await page.getByRole("button", { name: "Guardar cambios", exact: true }).click()
    await expect(page.getByRole("alert")).toContainText("No se pudieron guardar")
    expect(await stored(page)).toEqual(original)
    await expect(page.locator("#institution-profile-name")).toHaveValue("Borrador protegido")
    await page.getByRole("button", { name: "Crear sede", exact: true }).click()
    const createDialog = page.getByRole("dialog", { name: "Nueva sede", exact: true })
    await createDialog.getByLabel("Nombre de la sede", { exact: true }).fill("Sede en espera")
    await createDialog.getByRole("button", { name: "Guardar sede", exact: true }).click()
    await expect(createDialog.getByRole("alert")).toContainText("No se pudo guardar la sede")
    await expect(createDialog.getByLabel("Nombre de la sede", { exact: true })).toHaveValue("Sede en espera")
    expect(await stored(page)).toEqual(original)
    await expect(page.getByText("Sede creada", { exact: true })).toHaveCount(0)
    await failWrites(page, false)
    await createDialog.getByRole("button", { name: "Guardar sede", exact: true }).click()
    await expect(createDialog).not.toBeVisible()
    expect((await stored(page)).name).toBe(initial.name)
    await action(page, "Sede Central", "Editar sede")
    const editDialog = page.getByRole("dialog", { name: "Editar sede", exact: true })
    await editDialog.getByLabel("Dirección", { exact: true }).fill("Dirección pendiente")
    await failWrites(page, true)
    await editDialog.getByRole("button", { name: "Guardar sede", exact: true }).click()
    await expect(editDialog.getByRole("alert")).toContainText("No se pudo guardar la sede")
    expect((await stored(page)).branches[0]).toEqual(original.branches[0])
    await editDialog.getByRole("button", { name: "Cancelar", exact: true }).click()
    await failWrites(page, false)
    await action(page, "Sede Central", "Editar sede")
    await expect(editDialog.getByLabel("Dirección", { exact: true })).toHaveValue(original.branches[0]!.address)
    await editDialog.getByLabel("Dirección", { exact: true }).fill("Dirección confirmada")
    await editDialog.getByRole("button", { name: "Guardar sede", exact: true }).click()
    expect((await stored(page)).branches[0]).toEqual({ ...original.branches[0], address: "Dirección confirmada" })
    await action(page, "Sede Central", "Eliminar sede")
    const confirmation = page.getByRole("alertdialog")
    await failWrites(page, true)
    const beforeDelete = await stored(page)
    await confirmation.getByRole("button", { name: "Eliminar sede", exact: true }).click()
    await expect(confirmation.getByRole("alert")).toContainText("La sede se conserva")
    expect(await stored(page)).toEqual(beforeDelete)
    await expect(page.getByText("Sede eliminada", { exact: true })).toHaveCount(0)
    await failWrites(page, false)
    await confirmation.getByRole("button", { name: "Eliminar sede", exact: true }).click()
    await expect(confirmation).not.toBeVisible()
    expect((await stored(page)).branches.map((b) => b.name)).toEqual(["Sede 2", "Sede en espera"])
    await page.getByRole("button", { name: "Guardar cambios", exact: true }).click()
    expect((await stored(page)).name).toBe("Borrador protegido")
    await page.reload()
    await expect(page.locator("#institution-profile-name")).toHaveValue("Borrador protegido")
    expect((await stored(page)).branches).toHaveLength(2)
  })

  test(`ten branches remain readable and a single accessible editor fits all widths in ${theme}`, async ({ page }, testInfo) => {
    await enter(page, theme, branches(10))
    const measurements = []
    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 })
      const section = page.locator("[data-institution-branches]")
      await expect(section.locator("input")).toHaveCount(0)
      await expect(page.getByRole("button", { name: /^Acciones de sede / })).toHaveCount(10)
      const visibleTable = await page.getByRole("table", { name: "Sedes de la institución", exact: true }).isVisible()
      if (visibleTable) {
        await expect(section.getByRole("row")).toHaveCount(11)
        await expect(section.getByRole("cell", { name: "Principal", exact: true })).toBeVisible()
      } else {
        await expect(section.getByRole("listitem")).toHaveCount(10)
        await expect(section.getByRole("heading", { name: "Sede 10", exact: true })).toBeVisible()
      }
      const overflow = await page.evaluate(() => ({ viewport: innerWidth, scroll: document.documentElement.scrollWidth }))
      expect(overflow.scroll).toBeLessThanOrEqual(width)
      await page.getByRole("button", { name: "Crear sede", exact: true }).click()
      const dialog = page.getByRole("dialog", { name: "Nueva sede", exact: true })
      await expect(dialog).toHaveCount(1)
      await expect(dialog.getByLabel("Nombre de la sede", { exact: true })).toBeFocused()
      const expectedWidth = width < 600 ? width - 24 : Math.min(600, width - 32)
      await expect.poll(async () => Math.round((await dialog.boundingBox())!.width)).toBe(expectedWidth)
      const rect = (await dialog.boundingBox())!
      expect(Math.round(rect.x)).toBe(Math.round((width - expectedWidth) / 2))
      expect(rect.height).toBeLessThan(850)
      const save = dialog.getByRole("button", { name: "Guardar sede", exact: true })
      await page.mouse.move(0, 0)
      const saveRect = (await save.boundingBox())!
      expect(saveRect.y + saveRect.height).toBeLessThanOrEqual(900)
      expect(saveRect.height).toBeGreaterThanOrEqual(width < 600 ? 44 : 40)
      await expect(save).toHaveCSS("background-color", theme === "light" ? "rgb(83, 80, 204)" : "rgb(228, 242, 34)")
      // Tab remains inside the dialog and Escape restores the actual trigger.
      for (let i = 0; i < 9; i++) {
        await page.keyboard.press("Tab")
        expect(await dialog.evaluate((root) => root.contains(document.activeElement))).toBe(true)
      }
      await dialog.getByLabel("Horarios", { exact: true }).fill("Borrador descartable")
      await page.keyboard.press("Escape")
      await expect(dialog).not.toBeVisible()
      await expect(page.getByRole("button", { name: "Crear sede", exact: true })).toBeFocused()
      await action(page, "Sede Central", "Editar sede")
      const edit = page.getByRole("dialog", { name: "Editar sede", exact: true })
      await expect(edit.getByLabel("Dirección", { exact: true })).toHaveValue(branches(10)[0]!.address)
      await page.keyboard.press("Escape")
      await expect(edit).not.toBeVisible()
      await expect(page.getByRole("button", { name: "Acciones de sede Sede Central", exact: true })).toBeFocused()
      measurements.push({ width, visibleTable, dialogWidth: rect.width, footerBottom: saveRect.y + saveRect.height, ...overflow })
    }
    expect((await stored(page)).branches).toEqual(branches(10))
    await testInfo.attach(`responsive-${theme}.json`, { body: JSON.stringify(measurements, null, 2), contentType: "application/json" })
  })

  test(`short mobile viewport keeps editor footer accessible in ${theme}`, async ({ page }) => {
    await enter(page, theme)
    await page.setViewportSize({ width: 320, height: 480 })
    await page.getByRole("button", { name: "Crear sede", exact: true }).click()
    const dialog = page.getByRole("dialog", { name: "Nueva sede", exact: true })
    await expect.poll(async () => Math.round((await dialog.boundingBox())!.x)).toBe(12)
    await dialog.getByLabel("Horarios", { exact: true }).fill("Atención matutina")
    const field = (await dialog.getByLabel("Horarios", { exact: true }).boundingBox())!
    const footer = (await dialog.locator('[data-institution-editor-actions]').boundingBox())!
    expect(field.y + field.height).toBeLessThanOrEqual(footer.y + 1)
    expect(footer.y + footer.height).toBeLessThanOrEqual(480)
    await dialog.getByRole("button", { name: "Guardar sede", exact: true }).click()
    expect((await stored(page)).branches.at(-1)!.hours).toBe("Atención matutina")
  })
}
