import { expect, test, type Locator, type Page } from "@playwright/test"
import { loginArchive, openArchive } from "./helpers/clinical-archive"

async function openUpload(page: Page) {
  await openArchive(page)
  await page.getByRole("button", { name: "Adjuntar archivos", exact: true }).click()
  const modal = page.getByRole("dialog", { name: "Adjuntar archivos clínicos", exact: true })
  const pngs = await page.evaluate(() => ["red", "blue"].map(color => { const canvas = document.createElement("canvas"); canvas.width = 40; canvas.height = 40; const ctx = canvas.getContext("2d")!; ctx.fillStyle = color; ctx.fillRect(0, 0, 40, 40); return canvas.toDataURL("image/png").split(",")[1] }))
  await modal.locator('input[type="file"]').setInputFiles(["superior.png", "inferior.png"].map((name, index) => ({ name, mimeType: "image/png", buffer: Buffer.from(pngs[index], "base64") })))
  return modal
}
async function linkedError(control: Locator) {
  await expect(control).toHaveAttribute("aria-invalid", "true")
  const ids = (await control.getAttribute("aria-describedby"))?.split(/\s+/) ?? []
  expect(ids.length).toBeGreaterThan(0)
  for (const id of ids) expect(await control.page().locator(`[id="${id}"]`).count()).toBe(1)
}
async function visibleInBody(control: Locator, modal: Locator) {
  await expect.poll(async () => {
    const a = await control.boundingBox(), b = await modal.locator('[data-slot="dialog-body"]').boundingBox()
    return !!a && !!b && a.y >= b.y && a.y + a.height <= b.y + b.height
  }).toBe(true)
}

for (const theme of ["light", "dark"] as const) {
  test(`batch errors belong to each file, focus the real field, preserve metadata and save in ${theme}`, async ({ page }) => {
    await loginArchive(page, theme)
    const modal = await openUpload(page)
    await page.setViewportSize({ width: 390, height: 650 })
    const background = await page.evaluate(() => scrollY)
    await modal.getByRole("button", { name: "Guardar archivos", exact: true }).click()
    const type = modal.locator('[data-validation-field$=".clinicalType"]')
    await expect(type).toBeFocused()
    await linkedError(type)
    await visibleInBody(type, modal)
    await expect(modal.getByText("Selecciona el tipo clínico del archivo.", { exact: true })).toBeVisible()
    await expect(modal.locator('[data-validation-field$=".displayName"]')).toHaveValue("superior.png")
    await expect(modal.locator('[data-validation-field$=".displayName"]')).toHaveAttribute("aria-invalid", "false")
    await expect(modal.getByText("Hay 2 campos que requieren atención.", { exact: true })).toBeVisible()
    await type.click()
    await page.getByRole("option", { name: "Fotografía clínica", exact: true }).click()
    await expect(type).toHaveAttribute("aria-invalid", "false")
    await modal.locator('[data-validation-field$=".notes"]').fill("Metadatos que deben conservarse")
    await modal.getByRole("button", { name: "Guardar archivos", exact: true }).click()
    await expect(modal.locator('[data-validation-field$=".displayName"]')).toHaveValue("inferior.png")
    await expect(type).toBeFocused()
    await type.click()
    await page.getByRole("option", { name: "Fotografía clínica", exact: true }).click()
    await modal.getByRole("button", { name: /superior.png.*Revisar|^superior.png$/ }).click()
    await expect(modal.locator('[data-validation-field$=".notes"]')).toHaveValue("Metadatos que deben conservarse")
    expect(await page.evaluate(() => scrollY)).toBe(background)
    await modal.getByRole("button", { name: "Guardar archivos", exact: true }).click()
    await expect(modal.getByText("2 de 2 archivos guardados en el archivo clínico.")).toBeVisible()
    await expect(modal.locator('[aria-invalid="true"]')).toHaveCount(0)
  })

  test(`error controls and modal scroller fit all requested widths in ${theme}`, async ({ page }, info) => {
    await loginArchive(page, theme)
    const modal = await openUpload(page)
    await modal.getByRole("button", { name: "Guardar archivos", exact: true }).click()
    const type = modal.locator('[data-validation-field$=".clinicalType"]')
    await expect(type).toBeFocused()
    for (const width of [320, 360, 390, 430, 768, 1024, 1280, 1440, 1920]) {
      await page.setViewportSize({ width, height: 600 })
      await modal.getByRole("button", { name: "Ir al primer error", exact: true }).click()
      await expect(type).toBeFocused()
      await visibleInBody(type, modal)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      expect(await modal.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
      if ([320, 768, 1440].includes(width)) await page.screenshot({ path: info.outputPath(`invalid-${theme}-${width}.png`) })
    }
  })
}

test("patient errors retain valid fields, reveal closed sections and clear progressively", async ({ page }) => {
  await loginArchive(page)
  await page.goto("/pacientes")
  await page.getByRole("button", { name: "Nuevo paciente", exact: true }).click()
  const modal = page.getByRole("dialog", { name: "Nuevo paciente", exact: true })
  await modal.locator("#firstName").fill("Nombre conservado")
  await modal.getByRole("button", { name: "Crear paciente", exact: true }).click()
  await expect(modal.locator("#lastName")).toBeFocused()
  await linkedError(modal.locator("#lastName"))
  await expect(modal.locator("#firstName")).not.toHaveAttribute("aria-invalid", "true")
  await modal.locator("#lastName").fill("Apellido")
  await expect(modal.locator("#lastName")).not.toHaveAttribute("aria-invalid", "true")
  await expect(modal.locator("#documentId")).toHaveAttribute("aria-invalid", "true")
  await expect(modal.locator("#firstName")).toHaveValue("Nombre conservado")
})

test("appointment required and crossed-time errors identify the actual controls and preserve the draft", async ({ page }) => {
  await loginArchive(page)
  await page.goto("/citas")
  await page.getByRole("button", { name: "Nueva cita", exact: true }).click()
  const modal = page.getByRole("dialog", { name: "Nueva cita", exact: true })
  await modal.getByRole("button", { name: "Agendar cita", exact: true }).click()
  await expect(modal.locator("#patientId")).toBeFocused()
  await linkedError(modal.locator("#patientId"))
  await modal.locator("#startTime").fill("16:00")
  await modal.locator("#endTime").fill("15:00")
  await modal.getByRole("button", { name: "Agendar cita", exact: true }).click()
  await linkedError(modal.locator("#startTime"))
  await linkedError(modal.locator("#endTime"))
  await expect(modal.locator("#startTime")).toHaveValue("16:00")
})

test("server field errors focus only recognized fields and retain the appointment values", async ({ page }) => {
  await loginArchive(page)
  await page.goto("/citas")
  await page.evaluate(async () => {
    const apiPath = "/src/modules/appointments/api/appointments.api.ts", errorPath = "/src/shared/types/common.ts"
    const [{ appointmentsApi }, { ApiError }] = await Promise.all([import(apiPath), import(errorPath)])
    appointmentsApi.create = async () => { throw new ApiError("La disponibilidad cambió. Revisa el profesional.", 422, [
      { field: "unknownInternalField", message: "Un campo ajeno al formulario" },
      { field: "professionalId", message: "Selecciona otro profesional disponible." },
      { field: "patientId", message: "Revisa el paciente seleccionado." },
    ]) }
  })
  await page.getByRole("button", { name: "Nueva cita", exact: true }).click()
  const modal = page.getByRole("dialog", { name: "Nueva cita", exact: true })
  for (const [id, option] of [["patientId", /Valentina Suárez/], ["professionalId", /Carla Ríos/]] as const) {
    await modal.locator(`#${id}`).click()
    await page.getByRole("option", { name: option }).click()
  }
  await modal.locator("#date").fill("2026-12-01")
  await modal.locator("#startTime").fill("10:00")
  await modal.locator("#endTime").fill("10:30")
  await modal.locator("#notes").fill("Conservar este borrador")
  await modal.getByRole("button", { name: "Agendar cita", exact: true }).click()
  await expect(modal.locator("#patientId")).toBeFocused()
  await linkedError(modal.locator("#patientId"))
  await linkedError(modal.locator("#professionalId"))
  await expect(modal.getByText("Selecciona otro profesional disponible.", { exact: true })).toBeVisible()
  await expect(modal.getByText("Un campo ajeno al formulario", { exact: true })).toHaveCount(0)
  await expect(modal.locator("#notes")).toHaveValue("Conservar este borrador")
  await expect(modal.locator("#date")).toHaveValue("2026-12-01")
  await modal.locator("#notes").fill("Otro dato sigue siendo editable")
  await expect(modal.getByText("Selecciona otro profesional disponible.", { exact: true })).toBeVisible()
})

test("correcting a related field clears the crossed validation without another submission", async ({ page }) => {
  await loginArchive(page)
  await page.goto("/citas")
  await page.getByRole("button", { name: "Bloquear horario", exact: true }).click()
  const modal = page.getByRole("dialog", { name: "Bloquear horario", exact: true })
  await modal.locator("#date").fill("2026-12-02")
  await modal.locator("#startTime").fill("10:00")
  await modal.locator("#endTime").fill("11:00")
  await modal.locator("#reason").fill("Mantenimiento de prueba")
  await modal.getByRole("button", { name: "Bloquear horario", exact: true }).click()
  await linkedError(modal.locator("#professionalId"))
  await linkedError(modal.locator("#roomId"))
  await modal.locator("#professionalId").click()
  await page.getByRole("option", { name: /Carla Ríos/ }).click()
  await expect(modal.locator("#professionalId")).not.toHaveAttribute("aria-invalid", "true")
  await expect(modal.locator("#roomId")).not.toHaveAttribute("aria-invalid", "true")
  await expect(modal.locator("#reason")).toHaveValue("Mantenimiento de prueba")
})

test("a rejected original is identified and focused without marking valid metadata or dropping files", async ({ page }) => {
  await loginArchive(page)
  const modal = await openUpload(page)
  await modal.locator('input[type="file"]').setInputFiles({ name: "vacio.png", mimeType: "image/png", buffer: Buffer.alloc(0) })
  await modal.getByRole("button", { name: /^Clasificación clínica/ }).click()
  await modal.locator('[data-validation-field="clinicalType"]').click()
  await page.getByRole("option", { name: "Fotografía clínica", exact: true }).click()
  await modal.getByRole("button", { name: "Guardar archivos", exact: true }).click()
  const failure = modal.locator('[data-file-invalid="true"]').getByRole("alert")
  await expect(failure).toContainText(/vacío/i)
  await expect(failure).toBeFocused()
  await expect(modal.locator('[aria-invalid="true"]')).toHaveCount(0)
  await expect(modal.getByText("2 de 3 archivos guardados en el archivo clínico.")).toBeVisible()
  await expect(modal.getByText("vacio.png", { exact: true })).toHaveCount(2)
})
