import { expect, test, type Page } from "@playwright/test"

test.use({ timezoneId: "America/Guayaquil", reducedMotion: "reduce" })
const widths = [320, 360, 375, 390, 430, 600, 768, 1024, 1280, 1440, 1920]
const modal = (page: Page) => page.getByRole("dialog", { name: /^(Nuevo|Editar) paciente$/ })
const trigger = (page: Page, key: string) => page.locator(`#patient-section-${key} [data-patient-section-trigger]`)
async function login(page: Page, theme: string) {
  await page.clock.install({ time: new Date("2026-11-14T17:00:00Z") })
  await page.goto("/login")
  await page.getByRole("button", { name: theme === "light" ? "Tema claro" : "Tema oscuro", exact: true }).click()
  await page.locator("#email").fill("admin@clinica.com")
  await page.locator("#password").fill("admin123")
  await page.getByRole("button", { name: "Ingresar", exact: true }).click()
  await page.getByRole("button", { name: "Continuar", exact: true }).click()
  await expect(page).toHaveURL(/\/$/)
  await page.goto("/pacientes")
}
async function openSection(page: Page, key: string) {
  if (await trigger(page, key).getAttribute("aria-expanded") !== "true") await trigger(page, key).click()
  await expect(page.locator('[data-patient-section-trigger][aria-expanded="true"]')).toHaveCount(1)
}
async function required(page: Page) {
  await openSection(page, "personal")
  await page.locator("#firstName").fill("Elena")
  await page.locator("#lastName").fill("Guerrero")
  await page.locator("#documentId").fill("0100000009")
  await page.locator("#birthDate").fill("1995-11-14")
}
async function readPatient(page: Page, documentId: string) {
  return page.evaluate(async value => {
    const path = "/src/modules/patients/api/patients.api.ts"
    const { patientsApi } = await import(path)
    return (await patientsApi.list({ search: value, pageSize: 100 })).items[0]
  }, documentId)
}

for (const theme of ["light", "dark"]) {
  test(`create and list edit share an exclusive accordion and preserve all fields and filters in ${theme}`, async ({ page }) => {
    await login(page, theme)
    await page.getByRole("textbox", { name: "Buscar pacientes", exact: true }).fill("Elena")
    await page.locator("#patient-status-filter").click()
    await page.getByRole("option", { name: "Activo", exact: true }).click()
    await page.getByRole("button", { name: "Nuevo paciente", exact: true }).click()
    await expect(modal(page)).toBeVisible()
    await expect(page).toHaveURL(/\/pacientes$/)
    await expect(trigger(page, "personal")).toHaveAttribute("aria-expanded", "true")
    await page.locator("#firstName").fill("Elena")
    await openSection(page, "contact")
    await expect(trigger(page, "personal")).toHaveAttribute("aria-expanded", "false")
    await page.locator("#phone").fill("+593 99 123 4567")
    await page.locator("#email").fill("elena@example.com")
    await page.locator("#address").fill("Calle de prueba 12")
    await page.locator("#city").fill("Quito")
    await openSection(page, "emergency")
    await expect(trigger(page, "contact")).toHaveAttribute("aria-expanded", "false")
    for (const [id, value] of [["emergencyContactName", "Ana Guerrero"], ["emergencyContactPhone", "0987654321"], ["emergencyContactRelationship", "Hermana"], ["insuranceProvider", "Convenio"], ["insurancePolicy", "POL-TEST"]]) await page.locator(`#${id}`).fill(value)
    await openSection(page, "personal")
    await expect(page.locator("#firstName")).toHaveValue("Elena")
    await required(page)
    await expect(page.locator("output")).toHaveText("31 años")
    for (const [id, value] of [["occupation", "Administradora"], ["company", "Clínica de prueba"], ["nationality", "Ecuatoriana"]]) await page.locator(`#${id}`).fill(value)
    await openSection(page, "contact")
    await expect(page.locator("#phone")).toHaveValue("+593 99 123 4567")
    await openSection(page, "preferences")
    await page.locator("#notes").fill("Prefiere la tarde")
    await page.getByRole("switch", { name: /^Consentimiento informado firmado/ }).click()
    await page.getByRole("switch", { name: /^Notificaciones habilitadas/ }).click()
    await trigger(page, "preferences").click()
    await expect(page.locator('[data-patient-section-trigger][aria-expanded="true"]')).toHaveCount(0)
    await modal(page).getByRole("button", { name: "Crear paciente", exact: true }).click()
    await expect(modal(page)).toHaveCount(0)
    await expect(page).toHaveURL(/\/pacientes$/)
    await expect(page.getByRole("textbox", { name: "Buscar pacientes", exact: true })).toHaveValue("Elena")
    await expect(page.locator("#patient-status-filter")).toContainText("Activo")
    await expect(page.getByRole("row", { name: "Abrir detalles del paciente Elena Guerrero", exact: true })).toBeVisible()
    const created = await readPatient(page, "0100000009")
    expect(created).toMatchObject({ firstName: "Elena", lastName: "Guerrero", documentType: "cedula", phone: "+593 99 123 4567", email: "elena@example.com", address: "Calle de prueba 12", city: "Quito", occupation: "Administradora", company: "Clínica de prueba", nationality: "Ecuatoriana", emergencyContactName: "Ana Guerrero", emergencyContactRelationship: "Hermana", emergencyContactPhone: "0987654321", insuranceProvider: "Convenio", insurancePolicy: "POL-TEST", consentSigned: true, notificationsEnabled: false, notes: "Prefiere la tarde", lastVisitAt: "" })
    await page.getByRole("button", { name: "Acciones del paciente Elena Guerrero", exact: true }).click()
    await page.getByRole("menuitem", { name: "Editar paciente", exact: true }).click()
    await expect(modal(page)).toHaveAccessibleName("Editar paciente")
    await expect(trigger(page, "personal")).toHaveAttribute("aria-expanded", "true")
    await page.locator("#firstName").fill("Elena María")
    await openSection(page, "contact")
    await page.locator("#phone").fill("")
    await openSection(page, "emergency")
    await expect(page.locator("#insurancePolicy")).toHaveValue("POL-TEST")
    await openSection(page, "personal")
    await expect(page.locator("#firstName")).toHaveValue("Elena María")
    await modal(page).getByRole("button", { name: "Guardar cambios", exact: true }).click()
    await expect(modal(page)).toHaveCount(0)
    await expect(page.getByRole("row", { name: "Abrir detalles del paciente Elena María Guerrero", exact: true })).toBeVisible()
    expect(await readPatient(page, "0100000009")).toEqual({ ...created, firstName: "Elena María", phone: "" })
  })

  test(`multi-section validation reveals only the first error and marks other affected headers in ${theme}`, async ({ page }) => {
    await login(page, theme)
    await page.getByRole("button", { name: "Nuevo paciente", exact: true }).click()
    await openSection(page, "contact")
    await page.locator("#phone").fill("abc")
    await page.locator("#email").fill("invalido")
    await openSection(page, "preferences")
    await modal(page).getByRole("button", { name: "Crear paciente", exact: true }).click()
    await expect(trigger(page, "personal")).toHaveAttribute("aria-expanded", "true")
    await expect(page.locator("#firstName")).toBeFocused()
    await expect(trigger(page, "personal").locator("[data-errors]")).toHaveText("Revisar")
    await expect(trigger(page, "contact").locator("[data-errors]")).toHaveText("Revisar")
    await expect(page.locator('[data-patient-section-trigger][aria-expanded="true"]')).toHaveCount(1)
    await required(page)
    await modal(page).getByRole("button", { name: "Crear paciente", exact: true }).click()
    await expect(trigger(page, "contact")).toHaveAttribute("aria-expanded", "true")
    await expect(page.locator("#phone")).toBeFocused()
    await expect(page.locator("#phone-error")).toBeVisible()
    await page.locator("#phone").fill("0987654321")
    await page.locator("#email").fill("elena@example.com")
    await modal(page).getByRole("button", { name: "Crear paciente", exact: true }).click()
    await expect(modal(page)).toHaveCount(0)
    expect((await readPatient(page, "0100000009")).email).toBe("elena@example.com")
  })

  test(`both modal modes fit eleven widths with keyboard access and a single optional scroller in ${theme}`, async ({ page }, testInfo) => {
    const panelWarnings: string[] = []
    page.on("console", message => { if (message.text().includes("Collapsible or Accordion panel")) panelWarnings.push(message.text()) })
    await login(page, theme)
    const results = []
    for (const mode of ["create", "edit"]) {
      if (mode === "create") await page.getByRole("button", { name: "Nuevo paciente", exact: true }).click()
      else { await page.getByRole("button", { name: "Acciones del paciente Valentina Suárez", exact: true }).click(); await page.getByRole("menuitem", { name: "Editar paciente", exact: true }).click() }
      for (const width of widths) {
        await page.setViewportSize({ width, height: 900 })
        await expect.poll(async () => Math.round((await modal(page).boundingBox())!.width)).toBe(width < 768 ? width : Math.min(1088, width - 48))
        for (const key of ["personal", "contact", "emergency", "preferences"]) {
          await openSection(page, key)
          expect(await page.locator(".patient-section-panel").evaluateAll(nodes => nodes.filter(node => node.getClientRects().length).length)).toBe(1)
          expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
        }
        const header = (await modal(page).locator(".patient-edit-heading").boundingBox())!
        const footer = (await modal(page).locator("[data-form-actions]").boundingBox())!
        expect(header.y).toBeGreaterThanOrEqual(-1)
        expect(footer.y + footer.height).toBeLessThanOrEqual(901)
        const scrollers = await modal(page).evaluate(node => [...node.querySelectorAll("*")].filter(el => ["auto", "scroll"].includes(getComputedStyle(el).overflowY) && el.scrollHeight > el.clientHeight).map(el => el.className))
        expect(scrollers.length).toBeLessThanOrEqual(1)
        if (scrollers.length) expect(scrollers).toEqual(["patient-form-sections"])
        const outside = await modal(page).locator("input, button, textarea").evaluateAll(nodes => nodes.filter(node => node.getClientRects().length).filter(node => { const box = node.getBoundingClientRect(); return box.left < -1 || box.right > innerWidth + 1 }).map(node => node.id))
        expect(outside).toEqual([])
        results.push({ mode, width, header, footer })
      }
      await page.setViewportSize({ width: 375, height: 360 })
      await openSection(page, "emergency")
      await page.locator("#emergencyContactPhone").focus()
      const field = (await page.locator("#emergencyContactPhone").boundingBox())!
      const footer = (await modal(page).locator("[data-form-actions]").boundingBox())!
      expect(field.y + field.height).toBeLessThanOrEqual(footer.y + 1)
      await trigger(page, "emergency").focus()
      await page.keyboard.press("Space")
      await expect(trigger(page, "emergency")).toHaveAttribute("aria-expanded", "false")
      await modal(page).getByRole("button", { name: "Cancelar", exact: true }).click()
      await expect(modal(page)).toHaveCount(0)
      await page.setViewportSize({ width: 1440, height: 900 })
    }
    expect(panelWarnings).toEqual([])
    await testInfo.attach("both-modes-responsive-matrix", { body: JSON.stringify(results), contentType: "application/json" })
  })
}

test("create failure keeps the draft, marks server errors exclusively and permits a real retry", async ({ page }) => {
  await login(page, "dark")
  await page.evaluate(async () => {
    const path = "/src/modules/patients/api/patients.api.ts", common = "/src/shared/types/common.ts"
    const [{ patientsApi }, { ApiError }] = await Promise.all([import(path), import(common)])
    const original = patientsApi.create
    let calls = 0
    patientsApi.create = async (values: Parameters<typeof original>[0]) => {
      if (++calls === 1) throw new ApiError("Fallo de registro de prueba", 500, [{ field: "email", message: "Correo rechazado" }, { field: "emergencyContactPhone", message: "Contacto rechazado" }])
      return original(values)
    }
  })
  await page.getByRole("button", { name: "Nuevo paciente", exact: true }).click()
  await required(page)
  await modal(page).getByRole("button", { name: "Crear paciente", exact: true }).click()
  await expect(modal(page)).toBeVisible()
  await expect(page.locator("#email-error")).toHaveText("Correo rechazado")
  await expect(page.locator("#email")).toBeFocused()
  await expect(trigger(page, "emergency").locator("[data-errors]")).toHaveText("Revisar")
  await expect(page.locator('[data-patient-section-trigger][aria-expanded="true"]')).toHaveCount(1)
  await openSection(page, "personal")
  await expect(page.locator("#firstName")).toHaveValue("Elena")
  await modal(page).getByRole("button", { name: "Crear paciente", exact: true }).click()
  await expect(modal(page)).toHaveCount(0)
  expect((await readPatient(page, "0100000009")).firstName).toBe("Elena")
})

test("new patient cancellation protects drafts and reopens with the original defaults", async ({ page }) => {
  await login(page, "light")
  for (const close of ["cancel", "x", "escape", "outside"]) {
    await page.getByRole("button", { name: "Nuevo paciente", exact: true }).click()
    await page.locator("#firstName").fill("Borrador")
    if (close === "cancel") await modal(page).getByRole("button", { name: "Cancelar", exact: true }).click()
    else if (close === "x") await modal(page).getByRole("button", { name: "Cerrar creación de paciente", exact: true }).click()
    else if (close === "escape") await page.keyboard.press("Escape")
    else await page.mouse.click(3, 3)
    const confirm = page.getByRole("alertdialog", { name: "¿Descartar los cambios?", exact: true })
    await confirm.getByRole("button", { name: "Continuar editando", exact: true }).click()
    await expect(page.locator("#firstName")).toHaveValue("Borrador")
    await modal(page).getByRole("button", { name: "Cancelar", exact: true }).click()
    await confirm.getByRole("button", { name: "Descartar cambios", exact: true }).click()
    await expect(modal(page)).toHaveCount(0)
    await expect(page.getByRole("button", { name: "Nuevo paciente", exact: true })).toBeFocused()
  }
  await page.getByRole("button", { name: "Nuevo paciente", exact: true }).click()
  await expect(page.locator("#firstName")).toHaveValue("")
  await expect(page.locator("#gender")).toContainText("Femenino")
  await expect(trigger(page, "personal")).toHaveAttribute("aria-expanded", "true")
})
