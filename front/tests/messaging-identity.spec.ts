import { expect, test, type Page } from "@playwright/test"
import { setAccessTheme } from "./helpers/access-theme"

test.use({ timezoneId: "America/Guayaquil", reducedMotion: "reduce" })
async function login(page: Page, theme: "light" | "dark" = "dark", role = "admin") {
  await page.addInitScript(() => { window.messagingModule = path => {
    const resource = performance.getEntriesByType("resource").findLast(entry => new URL(entry.name).pathname === path)
    return import(/* @vite-ignore */ resource?.name ?? path)
  } })
  await page.goto("/login")
  await setAccessTheme(page, theme)
  await page.locator("#email").fill(`${role}@clinica.com`)
  await page.locator("#password").fill(`${role}123`)
  await page.getByRole("button", { name: "Ingresar", exact: true }).click()
  await page.waitForURL(url => url.pathname === "/" || url.pathname === "/perfil-usuario")
  if (new URL(page.url()).pathname === "/perfil-usuario") await page.getByRole("button", { name: "Continuar", exact: true }).click()
  await expect(page).toHaveURL(/\/$/)
}
async function institution(page: Page, name = "Clínica Río Azul", logoImage: string | null = null) {
  await page.evaluate(async ({ name, logoImage }) => {
    const { readInstitutionProfile, writeInstitutionProfile } = await window.messagingModule("/src/modules/institution/types/institution.types.ts")
    writeInstitutionProfile({ ...readInstitutionProfile(), name, logoImage })
  }, { name, logoImage })
}
async function editor(page: Page) {
  await page.getByRole("link", { name: "Mensajería", exact: true }).click()
  await page.getByRole("tab", { name: "Plantillas de mensajes", exact: true }).click()
  await expect(page.getByLabel("Mensaje", { exact: true })).toBeVisible()
  return page.getByRole("region", { name: "Vista previa del mensaje", exact: true })
}
async function realMode(page: Page) {
  await page.getByLabel("Vista previa con:", { exact: true }).click()
  await page.getByRole("option", { name: "Cita existente", exact: true }).click()
}
async function chooseAppointment(page: Page, id: string) {
  await page.getByRole("textbox", { name: "Buscar cita por paciente o fecha", exact: true }).fill(id)
  await page.getByLabel("Cita", { exact: true }).click()
  await expect(page.getByRole("option")).toHaveCount(1)
  await page.getByRole("option").click()
  await expect(page.locator("[data-message-body]")).toBeVisible()
}
async function seedSecond(page: Page) {
  await page.evaluate(async () => {
    const { mockAppointments } = await window.messagingModule("/src/modules/appointments/api/appointments.mock-data.ts")
    mockAppointments.push({ ...mockAppointments[0], id: "identity_second", professionalId: "prof_3", start: "2026-12-05T20:30:00Z", end: "2026-12-05T21:00:00Z", status: "programada" })
  })
}
async function prepare(page: Page, id: string, type = "recordatorio_cita") {
  return page.evaluate(async ({ id, type }) => {
    const { prepareAppointmentMessage } = await window.messagingModule("/src/modules/notifications/lib/prepare-appointment-message.ts")
    try { return { result: await prepareAppointmentMessage(id, type), error: null } }
    catch (error: any) { return { result: null, error: { message: error.message, status: error.status, fields: error.fieldErrors } } }
  }, { id, type })
}

for (const theme of ["light", "dark"] as const) {
  test(`only saved institutional name and logo synchronize across tabs without replacing the draft in ${theme}`, async ({ page, context }) => {
    await login(page, theme)
    await page.getByRole("button", { name: /Menú de usuario:/ }).click()
    await page.getByRole("menuitem", { name: "Perfil institucional", exact: true }).click()
    await page.getByLabel("Nombre de la clínica o institución", { exact: true }).fill("Institución confirmada")
    await page.getByRole("button", { name: "Guardar cambios", exact: true }).click()
    await expect(page.getByText("Perfil de la institución actualizado", { exact: true })).toBeVisible()
    const preview = await editor(page)
    await expect(preview.locator(".messaging-preview-brand")).toContainText("Institución confirmada")
    const message = page.getByLabel("Mensaje", { exact: true })
    await message.fill("Borrador [nombre de la clínica] para [nombre del cliente] sin perder.")
    const draft = await message.inputValue()
    const second = await context.newPage()
    await login(second, theme)
    await second.goto("/perfil-institucion")
    await second.getByLabel("Nombre de la clínica o institución", { exact: true }).fill("Nombre aún sin guardar")
    await expect(preview.locator(".messaging-preview-brand")).toContainText("Institución confirmada")
    await second.getByLabel("Nombre de la clínica o institución", { exact: true }).fill("Consultorio del Norte")
    await second.getByRole("button", { name: "Guardar cambios", exact: true }).click()
    await expect(preview.locator(".messaging-preview-brand")).toContainText("Consultorio del Norte")
    await expect(preview.locator("[data-message-body]")).toContainText("Borrador Consultorio del Norte para María González")
    await expect(preview.locator("[data-institution-initials]")).toHaveText("CD")
    await expect(page.locator('[data-slot="page-header"]')).toContainText("Consultorio del Norte")
    const png = await second.evaluate(() => { const canvas = document.createElement("canvas"); canvas.width = 20; canvas.height = 20; canvas.getContext("2d")!.fillRect(0, 0, 20, 20); return canvas.toDataURL().split(",")[1] })
    await second.getByLabel("Imagen institucional", { exact: true }).setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: Buffer.from(png, "base64") })
    await expect(second.getByText("Imagen lista. Pulsa Guardar cambios para aplicarla.")).toBeVisible()
    await expect(preview.locator(".messaging-preview-brand img")).toHaveCount(0)
    await second.getByRole("button", { name: "Guardar cambios", exact: true }).click()
    await expect(preview.locator(".messaging-preview-brand img")).toHaveAttribute("src", /^data:image/)
    await expect(message).toHaveValue(draft)
    await second.close()
  })

  test(`each appointment resolves its own professional and updates future preparations without touching history in ${theme}`, async ({ page }) => {
    await login(page, theme)
    await institution(page)
    await seedSecond(page)
    const before = await page.evaluate(async () => JSON.stringify((await window.messagingModule("/src/modules/notifications/api/notifications.mock-data.ts")).mockNotifications))
    const preview = await editor(page)
    const savedTemplate = await page.getByLabel("Mensaje", { exact: true }).inputValue()
    await realMode(page)
    await expect(preview).toContainText("Selecciona una cita para generar la vista previa")
    await expect(preview.locator("[data-message-body]")).toHaveCount(0)
    await chooseAppointment(page, "apt_1")
    await expect(preview.locator("[data-message-body]")).toContainText("Dra. Carla Ríos")
    await chooseAppointment(page, "identity_second")
    await expect(preview.locator("[data-message-body]")).toContainText("Dra. Paula Nieto")
    await expect(preview.locator("[data-message-body]")).not.toContainText("Carla")
    const prepared = await prepare(page, "identity_second")
    expect(prepared.result.message).toContain("Dra. Paula Nieto")
    await page.evaluate(async () => {
      const { appointmentsApi } = await window.messagingModule("/src/modules/appointments/api/appointments.api.ts")
      const { queryClient } = await window.messagingModule("/src/shared/lib/query-client.ts")
      await appointmentsApi.update("identity_second", { patientId: "pat_1", professionalId: "prof_2", roomId: "", treatmentId: "", date: "2026-12-10", startTime: "13:15", endTime: "13:45", notes: "" })
      await queryClient.invalidateQueries({ queryKey: ["appointments", "list"] })
    })
    await expect(preview.locator("[data-message-body]")).toContainText("Dr. Andrés Vega")
    await expect(preview.locator("[data-message-body]")).toContainText("10 de diciembre de 2026")
    const updated = await prepare(page, "identity_second")
    expect(updated.result.message).toContain("Dr. Andrés Vega")
    expect(updated.result.message).not.toContain("Dra. Paula Nieto")
    expect(updated.result.message).not.toMatch(/\[[^\]]+\]/)
    await expect(page.getByLabel("Mensaje", { exact: true })).toHaveValue(savedTemplate)
    expect(await page.evaluate(async () => JSON.stringify((await window.messagingModule("/src/modules/notifications/api/notifications.mock-data.ts")).mockNotifications))).toBe(before)
    await page.evaluate(async () => { const { appointmentsApi } = await window.messagingModule("/src/modules/appointments/api/appointments.api.ts"); await appointmentsApi.updateStatus("identity_second", "cancelada") })
    expect((await prepare(page, "identity_second")).error.fields[0].field).toBe("appointmentId")
  })

  test(`example and real previews fit mobile, tablet and desktop in ${theme}`, async ({ page }, info) => {
    await login(page, theme)
    await expect(page.getByText("Perfil guardado", { exact: true })).toBeHidden()
    await institution(page, "Institución odontológica del norte con nombre extenso")
    const preview = await editor(page)
    for (const mode of ["example", "appointment"]) {
      if (mode === "appointment") { await realMode(page); await chooseAppointment(page, "apt_1") }
      for (const width of [320, 360, 390, 430, 768, 1024, 1280, 1440, 1920]) {
        await page.setViewportSize({ width, height: 740 })
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
        const box = await preview.boundingBox()
        expect(box!.x).toBeGreaterThanOrEqual(0)
        expect(box!.x + box!.width).toBeLessThanOrEqual(width + 1)
        await expect(preview.locator("[data-message-body]")).toBeVisible()
        if ([390, 1440].includes(width)) {
          await preview.locator("[data-message-body]").scrollIntoViewIfNeeded()
          await expect(preview.locator("[data-message-body]")).toBeInViewport()
          await page.screenshot({ path: info.outputPath(`preview-${theme}-${mode}-${width}.png`), fullPage: true })
        }
      }
    }
  })
}

test("missing institutional/professional data and unknown tokens never produce an operational message", async ({ page }) => {
  await login(page)
  const preview = await editor(page)
  await expect(preview).toContainText("Nombre institucional sin configurar")
  await expect(preview.locator("[data-message-body]")).not.toContainText("Grupo Odontológico Sonrisas")
  await expect(preview.getByRole("link", { name: "Configurar Perfil institucional" })).toBeVisible()
  expect((await prepare(page, "apt_1")).error.fields.some((field: any) => field.field === "institutionName")).toBe(true)
  await institution(page)
  await page.evaluate(async () => {
    const { mockAppointments } = await window.messagingModule("/src/modules/appointments/api/appointments.mock-data.ts")
    const { queryClient } = await window.messagingModule("/src/shared/lib/query-client.ts")
    mockAppointments[0] = { ...mockAppointments[0], professionalId: "" }
    await queryClient.invalidateQueries({ queryKey: ["appointments", "list"] })
  })
  await realMode(page)
  await chooseAppointment(page, "apt_1")
  await expect(preview.locator("[data-message-body]")).toContainText("Profesional pendiente de asignación")
  await expect(preview.locator("[data-message-body]")).not.toContainText("Carla")
  expect((await prepare(page, "apt_1")).error.fields.some((field: any) => field.field === "professionalId")).toBe(true)
  await page.getByLabel("Mensaje", { exact: true }).fill("Hola [nombre del cliente], este mensaje no usa profesional.")
  await page.getByRole("button", { name: "Guardar plantilla", exact: true }).click()
  await expect(page.getByRole("button", { name: "Guardar plantilla", exact: true })).toBeDisabled()
  expect((await prepare(page, "apt_1")).result.message).toContain("María González")
  await page.getByLabel("Mensaje", { exact: true }).fill("Hola, variable [desconocida] sin resolver.")
  await expect(preview.locator("[data-message-body]")).not.toContainText("[desconocida]")
  await page.getByRole("button", { name: "Guardar plantilla", exact: true }).click()
  await expect(page.getByRole("button", { name: "Guardar plantilla", exact: true })).toBeDisabled()
  expect((await prepare(page, "apt_1")).error.fields[0].field).toBe("message")
})

test("preparation keeps notification preferences and permissions and does not send or log", async ({ page }) => {
  await login(page)
  await institution(page)
  expect((await prepare(page, "")).error.fields[0].field).toBe("appointmentId")
  await page.evaluate(async () => { const { mockPatients } = await window.messagingModule("/src/modules/patients/api/patients.mock-data.ts"); mockPatients[0].notificationsEnabled = false })
  expect((await prepare(page, "apt_1")).error.fields[0].field).toBe("patientId")
  await page.evaluate(async () => { const { useAuthStore } = await window.messagingModule("/src/modules/auth/store/auth-store.ts"); useAuthStore.setState({ user: { ...useAuthStore.getState().user, role: "medico" } }) })
  expect((await prepare(page, "apt_1")).error.status).toBe(403)
})

test("the central resolver uses Ecuador time and rejects mismatched relations without changing literal values", async ({ page }) => {
  await login(page)
  const result = await page.evaluate(async () => {
    const { resolveAppointmentMessage } = await window.messagingModule("/src/modules/notifications/lib/message-template.ts")
    const appointment = { id: "test", patientId: "patient-a", professionalId: "doctor-a", start: "2026-12-02T02:30:00Z" }
    const template = "[nombre del cliente] | [nombre de la clínica] | [fecha de la cita] | [hora de la cita] | [profesional]"
    return {
      valid: resolveAppointmentMessage(template, { institutionName: "Clínica $&", appointment, patient: { id: "patient-a", firstName: "Paciente", lastName: "Uno" }, professional: { id: "doctor-a", name: "Profesional Asignado" } }),
      invalid: resolveAppointmentMessage(template, { institutionName: "Clínica", appointment, patient: { id: "patient-b", firstName: "Otro", lastName: "Paciente" }, professional: { id: "doctor-b", name: "Otro profesional" } }),
    }
  })
  expect(result.valid.message).toContain("1 de diciembre de 2026")
  expect(result.valid.message).toMatch(/09:30|21:30/)
  expect(result.valid.message).toContain("Clínica $&")
  expect(result.valid.complete).toBe(true)
  expect(result.invalid.message).not.toContain("Otro")
  expect(result.invalid.complete).toBe(false)
})
