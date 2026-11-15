import { test, expect, type Page } from "@playwright/test"

test.use({ timezoneId: "America/Guayaquil", reducedMotion: "reduce" })
const widths = [320, 360, 375, 390, 430, 600, 768, 1024, 1280, 1440, 1920]
async function login(page: Page, theme = "light") {
  await page.goto("/login")
  await page.getByRole("button", { name: theme === "light" ? "Tema claro" : "Tema oscuro", exact: true }).click()
  await page.locator("#email").fill("admin@clinica.com")
  await page.locator("#password").fill("admin123")
  await page.getByRole("button", { name: "Ingresar", exact: true }).click()
  await page.getByRole("button", { name: "Continuar", exact: true }).click()
  await expect(page).toHaveURL(/\/$/)
}
const editor = (page: Page) => page.getByRole("dialog", { name: "Editar paciente", exact: true })
async function profile(page: Page) {
  await page.goto("/pacientes/pat_5")
  await expect(page.getByRole("heading", { name: "Valentina Suárez", exact: true })).toBeVisible()
}
async function open(page: Page) {
  await page.getByRole("button", { name: "Editar", exact: true }).click()
  await expect(editor(page).locator("#firstName")).toHaveValue("Valentina")
}
async function section(page: Page, name: string, expanded = true) {
  const trigger = editor(page).locator(`#patient-section-${name} [data-patient-section-trigger]`)
  if ((await trigger.getAttribute("aria-expanded") === "true") !== expanded) await trigger.click()
}
async function close(page: Page, way: string) {
  if (way === "cancel") await editor(page).getByRole("button", { name: "Cancelar", exact: true }).click()
  else if (way === "x") await editor(page).getByRole("button", { name: "Cerrar edición de paciente", exact: true }).click()
  else if (way === "escape") await page.keyboard.press("Escape")
  else await page.mouse.click(4, 4)
}

for (const theme of ["light", "dark"]) {
  test(`profile editing uses one shared modal, preserves context and synchronizes the saved patient in ${theme}`, async ({ page }) => {
    await login(page, theme)
    await profile(page)
    await page.getByRole("tab", { name: "Citas", exact: true }).click()
    await open(page)
    await expect(page).toHaveURL(/\/pacientes\/pat_5$/)
    await expect(editor(page)).toContainText("HC-000005")
    await page.locator("#firstName").fill("Valentina Editada")
    await section(page, "contact")
    await page.locator("#phone").fill("0981122334")
    await section(page, "contact", false)
    await section(page, "contact")
    await expect(page.locator("#phone")).toHaveValue("0981122334")
    await editor(page).getByRole("button", { name: "Guardar cambios", exact: true }).click()
    await expect(editor(page)).toHaveCount(0)
    await expect(page.getByRole("heading", { name: "Valentina Editada Suárez", exact: true })).toBeVisible()
    await expect(page.getByRole("tab", { name: "Citas", exact: true })).toHaveAttribute("aria-selected", "true")
    await expect(page).toHaveURL(/\/pacientes\/pat_5$/)
    await page.getByRole("button", { name: "Acciones del paciente Valentina Editada Suárez", exact: true }).click()
    await page.getByRole("menuitem", { name: "Editar paciente", exact: true }).click()
    await expect(editor(page).locator("#firstName")).toHaveValue("Valentina Editada")
    await expect(editor(page).locator("#phone")).not.toBeVisible()
    await section(page, "contact")
    await expect(editor(page).locator("#phone")).toHaveValue("0981122334")
    await editor(page).getByRole("button", { name: "Cancelar", exact: true }).click()
    await expect(page.getByRole("button", { name: "Acciones del paciente Valentina Editada Suárez", exact: true })).toBeFocused()
  })

  test(`clean closing, every dirty dismissal and discard confirmation preserve the draft in ${theme}`, async ({ page }) => {
    await login(page, theme)
    await profile(page)
    for (const way of ["cancel", "x", "escape", "outside"]) {
      await open(page)
      await close(page, way)
      await expect(editor(page)).toHaveCount(0)
      await expect(page.getByRole("button", { name: "Editar", exact: true })).toBeFocused()
      await open(page)
      await editor(page).locator("#firstName").fill("Borrador")
      await close(page, way)
      const confirm = page.getByRole("alertdialog", { name: "¿Descartar los cambios?", exact: true })
      await expect(confirm).toContainText("Tienes modificaciones que todavía no se han guardado")
      await confirm.getByRole("button", { name: "Continuar editando", exact: true }).click()
      await expect(confirm).not.toBeVisible()
      await expect(editor(page).locator("#firstName")).toHaveValue("Borrador")
      await close(page, way)
      await confirm.getByRole("button", { name: "Descartar cambios", exact: true }).click()
      await expect(editor(page)).toHaveCount(0)
      await expect(page.getByRole("button", { name: "Editar", exact: true })).toBeFocused()
      await expect(page.getByRole("heading", { name: "Valentina Suárez", exact: true })).toBeVisible()
    }
  })

  test(`patient dialog has one scroller, integrated actions and safe focus at eleven widths in ${theme}`, async ({ page }, testInfo) => {
    const errors: string[] = []
    page.on("pageerror", error => errors.push(error.message))
    await login(page, theme)
    await profile(page)
    await open(page)
    if (await page.locator(".tsqd-parent-container").count()) await expect(page.locator(".tsqd-parent-container")).toHaveCSS("display", "none")
    for (const name of ["contact", "emergency", "preferences"]) await section(page, name)
    const measurements = []
    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 })
      await expect.poll(async () => Math.round((await editor(page).boundingBox())!.width)).toBe(width < 768 ? width : Math.min(1088, width - 48))
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
      const box = (await editor(page).boundingBox())!
      expect(box.y).toBeGreaterThanOrEqual(-1)
      expect(box.y + box.height).toBeLessThanOrEqual(901)
      await expect(editor(page)).toHaveCSS("overflow-y", "hidden")
      const scrollers = await editor(page).evaluate(node => [...node.querySelectorAll("*")].filter(el => ["auto", "scroll"].includes(getComputedStyle(el).overflowY) && el.scrollHeight > el.clientHeight).map(el => el.className))
      expect(scrollers.length).toBeLessThanOrEqual(1)
      if (scrollers.length) expect(scrollers).toEqual(["patient-form-sections"])
      await editor(page).locator("#notes").focus()
      const field = (await editor(page).locator("#notes").boundingBox())!
      const footer = (await editor(page).locator("[data-form-actions]").boundingBox())!
      expect(field.y + field.height).toBeLessThanOrEqual(footer.y + 1)
      expect(footer.y + footer.height).toBeLessThanOrEqual(901)
      await expect(editor(page).locator("[data-form-actions]")).toHaveCSS("border-radius", "0px")
      await expect(editor(page).locator("[data-form-actions]")).toHaveCSS("border-left-width", "0px")
      await expect(editor(page).getByRole("button", { name: "Guardar cambios", exact: true })).toHaveCSS("min-height", width < 1024 ? "44px" : "40px")
      const outside = await editor(page).locator("input, textarea, button, summary").evaluateAll(nodes => nodes.filter(n => n.getClientRects().length).filter(n => { const b = n.getBoundingClientRect(); return b.left < -1 || b.right > innerWidth + 1 }).map(n => n.id || n.textContent))
      expect(outside).toEqual([])
      measurements.push({ width, box, footer })
    }
    await page.setViewportSize({ width: 375, height: 360 })
    await section(page, "emergency")
    await editor(page).locator("#emergencyContactPhone").focus()
    const field = (await editor(page).locator("#emergencyContactPhone").boundingBox())!
    const footer = (await editor(page).locator("[data-form-actions]").boundingBox())!
    expect(field.y + field.height).toBeLessThanOrEqual(footer.y + 1)
    expect(footer.y + footer.height).toBeLessThanOrEqual(361)
    await page.setViewportSize({ width: 1440, height: 900 })
    for (let index = 0; index < 35; index++) {
      await page.keyboard.press("Tab")
      expect(await editor(page).evaluate(node => node.contains(document.activeElement))).toBe(true)
    }
    const background = await page.locator("main").evaluate(node => node.scrollTop)
    await page.mouse.move(3, 3)
    await page.mouse.wheel(0, 700)
    expect(await page.locator("main").evaluate(node => node.scrollTop)).toBe(background)
    expect(errors).toEqual([])
    await testInfo.attach("modal-responsive-matrix", { body: JSON.stringify(measurements), contentType: "application/json" })
  })
}

test("validation reveals closed sections, update failure preserves values and duplicate submissions are blocked", async ({ page }) => {
  await login(page)
  await profile(page)
  await page.evaluate(async () => {
    const apiPath = "/src/modules/patients/api/patients.api.ts", errorPath = "/src/shared/types/common.ts"
    const [{ patientsApi }, { ApiError }] = await Promise.all([import(apiPath), import(errorPath)])
    const original = patientsApi.update
    const state = window as unknown as { patientUpdateCalls: number }
    state.patientUpdateCalls = 0
    patientsApi.update = async (...args: Parameters<typeof original>) => {
      state.patientUpdateCalls++
      await new Promise(resolve => setTimeout(resolve, 900))
      if (state.patientUpdateCalls === 1) throw new ApiError("Error de guardado de prueba", 500, [{ field: "phone", message: "Teléfono rechazado por el servidor" }])
      return original(...args)
    }
  })
  await open(page)
  await editor(page).locator("#firstName").fill("Valentina Guardada")
  await section(page, "contact")
  await editor(page).locator("#email").fill("invalido")
  await section(page, "contact", false)
  await editor(page).getByRole("button", { name: "Guardar cambios", exact: true }).click()
  await expect(editor(page).locator("#email-error")).toBeVisible()
  await expect(editor(page).locator("#email")).toBeFocused()
  expect(await page.evaluate(() => (window as unknown as { patientUpdateCalls: number }).patientUpdateCalls)).toBe(0)
  await editor(page).locator("#email").fill("valentina.suarez@mail.com")
  await section(page, "contact", false)
  await editor(page).locator("form").evaluate((form: HTMLFormElement) => { form.requestSubmit(); form.requestSubmit() })
  await expect(editor(page).getByRole("button", { name: "Guardando…", exact: true })).toBeDisabled()
  await page.keyboard.press("Escape")
  await expect(editor(page)).toBeVisible()
  await expect(page.getByRole("alertdialog")).toHaveCount(0)
  await expect(editor(page).locator("#phone-error")).toHaveText("Teléfono rechazado por el servidor")
  await expect(editor(page).locator("#firstName")).toHaveValue("Valentina Guardada")
  expect(await page.evaluate(() => (window as unknown as { patientUpdateCalls: number }).patientUpdateCalls)).toBe(1)
  await editor(page).getByRole("button", { name: "Guardar cambios", exact: true }).click()
  await expect(editor(page)).toHaveCount(0)
  await expect(page.getByRole("heading", { name: "Valentina Guardada Suárez", exact: true })).toBeVisible()
  expect(await page.evaluate(() => (window as unknown as { patientUpdateCalls: number }).patientUpdateCalls)).toBe(2)
})

test("direct edit routes remain pages, while list and profile shortcuts open the corresponding modal", async ({ page }) => {
  await login(page)
  await page.goto("/pacientes/pat_5/editar?seccion=emergency")
  await expect(page.locator("#emergencyContactName")).toHaveValue("Ricardo Suárez")
  await expect(page.getByRole("dialog")).toHaveCount(0)
  await page.getByRole("button", { name: "Cancelar", exact: true }).click()
  await page.getByRole("button", { name: "Editar información de contacto", exact: true }).click()
  await expect(editor(page).locator("#patient-section-contact [data-patient-section-trigger]")).toHaveAttribute("aria-expanded", "true")
  await expect(page).toHaveURL(/\/pacientes\/pat_5$/)
  await editor(page).getByRole("button", { name: "Cancelar", exact: true }).click()
  await page.getByRole("button", { name: "Volver a pacientes", exact: true }).click()
  await page.getByRole("button", { name: "Acciones del paciente Valentina Suárez", exact: true }).click()
  await page.getByRole("menuitem", { name: "Editar paciente", exact: true }).click()
  await expect(page).toHaveURL(/\/pacientes$/)
  await expect(editor(page)).toBeVisible()
  await editor(page).getByRole("button", { name: "Cancelar", exact: true }).click()
  await page.goto("/pacientes/nuevo")
  await expect(page.getByRole("heading", { name: "Nuevo paciente", exact: true })).toBeVisible()
  await expect(page.getByRole("dialog")).toHaveCount(0)
})
