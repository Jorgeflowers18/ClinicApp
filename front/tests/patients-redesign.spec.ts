import { expect, test, type Page } from "@playwright/test"

test.use({ timezoneId: "America/Guayaquil" })
const widths = [320, 375, 430, 768, 1024, 1280, 1440, 1920]
async function login(page: Page, theme = "light", role = "admin") {
  await page.clock.install({ time: new Date("2026-11-14T17:00:00Z") })
  await page.goto("/login")
  await page.getByRole("button", { name: theme === "light" ? "Tema claro" : "Tema oscuro", exact: true }).click()
  await page.locator("#email").fill(`${role}@clinica.com`)
  await page.locator("#password").fill(`${role}123`)
  await page.getByRole("button", { name: "Ingresar", exact: true }).click()
  await page.getByRole("button", { name: "Continuar", exact: true }).click()
  await expect(page).toHaveURL(/\/$/)
}
async function choose(page: Page, id: string, label: string) {
  await page.locator(`#${id}`).click()
  await page.getByRole("option", { name: label, exact: true }).click()
}
async function section(page: Page, id: string, open = true) {
  const trigger = page.locator(`#patient-section-${id} [data-patient-section-trigger]`)
  if ((await trigger.getAttribute("aria-expanded") === "true") !== open) await trigger.click()
  await expect(trigger).toHaveAttribute("aria-expanded", String(open))
  const panel = page.locator(`#patient-section-${id} .patient-section-panel`)
  if (open) await expect.poll(() => panel.evaluate(node => node.getAnimations().filter(animation => animation.playState === "running").length)).toBe(0)
  else await expect(panel).toBeHidden()
}
async function baseFields(page: Page, document = "0100000009") {
  await page.locator("#firstName").fill("Elena")
  await page.locator("#lastName").fill("Guerrero")
  await page.locator("#documentId").fill(document)
  await page.locator("#birthDate").fill("1995-11-14")
}
async function savedPatient(page: Page, id: string) {
  return page.evaluate(async patientId => { const path = "/src/modules/patients/api/patients.api.ts"; const { patientsApi } = await import(path); return patientsApi.get(patientId) }, id)
}

for (const theme of ["light", "dark"]) {
  test(`patient list search, advanced filters, global totals and paging use the full source in ${theme}`, async ({ page }) => {
    await login(page, theme)
    await page.goto("/pacientes")
    const rows = page.getByRole("row", { name: /^Abrir detalles del paciente/ })
    await expect(rows).toHaveCount(5)
    await expect(page.getByRole("group", { name: "Resumen de pacientes", exact: true }).locator("strong")).toHaveText(["5", "2", "1", "1"])
    const search = page.getByRole("textbox", { name: "Buscar pacientes", exact: true })
    for (const term of ["maria gonzalez", "0991234567", "maria.gonzalez@mail.com", "0102030405"]) {
      await search.fill(term)
      await expect(rows).toHaveCount(1)
      await expect(rows.first()).toContainText("María González")
    }
    await page.getByRole("button", { name: "Limpiar", exact: true }).click()
    await choose(page, "patient-status-filter", "Activo")
    await expect(rows).toHaveCount(2)
    await page.getByRole("button", { name: "Filtros avanzados", exact: true }).click()
    await choose(page, "patient-gender-filter", "Otro")
    await page.locator("#patient-registered-from").fill("2026-02-20")
    await page.locator("#patient-registered-to").fill("2026-02-20")
    await expect(rows).toHaveCount(1)
    await expect(rows).toContainText("Valentina Suárez")
    await expect(page.getByRole("group", { name: "Resumen de pacientes", exact: true }).locator("strong")).toHaveText(["5", "2", "1", "1"])
    await page.getByRole("button", { name: "Limpiar", exact: true }).click()
    await expect(rows).toHaveCount(5)
    await page.evaluate(async () => {
      const path = "/src/modules/patients/api/patients.mock-data.ts", client = "/src/shared/lib/query-client.ts"
      const [{ mockPatients }, { queryClient }] = await Promise.all([import(path), import(client)])
      for (let index = 0; index < 20; index++) mockPatients.push({ ...mockPatients[0], id: `paging-${index}`, firstName: `Paginado ${index}`, documentId: `PAGE-${index}`, createdAt: new Date(Date.UTC(2026, 9, 1, 12, index)).toISOString() })
      await queryClient.invalidateQueries({ queryKey: ["patients"] })
    })
    await expect(rows).toHaveCount(10)
    await page.getByRole("button", { name: "Siguiente", exact: true }).click()
    await expect(page.getByText("Página 2 de 3", { exact: true })).toBeVisible()
    await search.fill("Valentina")
    await expect(rows).toHaveCount(1)
    await expect(rows).toContainText("Valentina Suárez")
    await expect(page.getByRole("navigation", { name: "Paginación de registros" })).toHaveCount(0)
  })

  test(`patient create and edit preserve every field, consent meaning, age and closed sections in ${theme}`, async ({ page }) => {
    await login(page, theme)
    await page.goto("/pacientes/nuevo")
    await baseFields(page)
    await expect(page.locator("output")).toHaveText("31 años")
    await page.locator("#occupation").fill("Administradora")
    await page.locator("#company").fill("Clínica de prueba")
    await page.locator("#nationality").fill("Ecuatoriana")
    await choose(page, "maritalStatus", "Casado/a")
    await section(page, "contact")
    await page.locator("#phone").fill("+593 99 123 4567")
    await page.locator("#email").fill("elena@example.com")
    await page.locator("#address").fill("Calle de prueba 12")
    await page.locator("#city").fill("Quito, Pichincha")
    await section(page, "contact", false)
    await section(page, "emergency")
    for (const [id, value] of [["emergencyContactName", "Ana Guerrero"], ["emergencyContactPhone", "0987654321"], ["emergencyContactRelationship", "Hermana"], ["insuranceProvider", "Convenio de prueba"], ["insurancePolicy", "POL-TEST"]]) await page.locator(`#${id}`).fill(value)
    await section(page, "preferences")
    await page.locator("#notes").fill("Prefiere horario de tarde")
    await page.getByRole("switch", { name: /^Consentimiento informado firmado/ }).click()
    await page.getByRole("switch", { name: /^Notificaciones habilitadas/ }).click()
    await section(page, "preferences", false)
    await page.getByRole("button", { name: "Crear paciente", exact: true }).click()
    await expect(page.getByRole("heading", { name: "Elena Guerrero", exact: true })).toBeVisible()
    const id = new URL(page.url()).pathname.split("/").at(-1)!
    const saved = await savedPatient(page, id)
    expect(saved).toMatchObject({ documentType: "cedula", documentId: "0100000009", clinicalRecordNumber: "HC-000006", occupation: "Administradora", company: "Clínica de prueba", nationality: "Ecuatoriana", maritalStatus: "casado", phone: "+593 99 123 4567", city: "Quito, Pichincha", notes: "Prefiere horario de tarde", emergencyContactName: "Ana Guerrero", emergencyContactRelationship: "Hermana", insurancePolicy: "POL-TEST", consentSigned: true, notificationsEnabled: false, lastVisitAt: "" })
    await page.getByRole("button", { name: "Editar", exact: true }).click()
    await expect(page.locator("#occupation")).toHaveValue("Administradora")
    await section(page, "contact")
    await expect(page.locator("#email")).toHaveValue("elena@example.com")
    await page.locator("#phone").fill("")
    await section(page, "personal")
    await page.locator("#firstName").fill("Elena María")
    await page.getByRole("button", { name: "Guardar cambios", exact: true }).click()
    await expect(page.getByRole("heading", { name: "Elena María Guerrero", exact: true })).toBeVisible()
    const edited = await savedPatient(page, id)
    expect(edited).toEqual({ ...saved, firstName: "Elena María", phone: "" })
    expect(await page.evaluate(async () => { const path = "/src/modules/clinical-history/lib/patient-data.ts"; const { patientDataSchema } = await import(path); return patientDataSchema.shape.phone.safeParse("").success })).toBe(true)
  })

  test(`patient screens, expanded sections, footer and tabs fit all eight widths in ${theme}`, async ({ page }, testInfo) => {
    const errors: string[] = []
    page.on("pageerror", error => errors.push(error.message))
    await login(page, theme)
    const results = []
    for (const route of ["/pacientes", "/pacientes/nuevo", "/pacientes/pat_1"]) {
      await page.goto(route)
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
      await expect(page.locator('main [data-slot="skeleton"]')).toHaveCount(0)
      if (route.endsWith("nuevo")) for (const id of ["contact", "emergency", "preferences"]) await section(page, id)
      for (const width of widths) {
        await page.setViewportSize({ width, height: 1000 })
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
        const outside = await page.locator('main button, main input, main textarea, main select, main summary').evaluateAll(nodes => nodes.filter(node => node.getClientRects().length && getComputedStyle(node).visibility !== "hidden" && !node.closest('[aria-hidden="true"], .sr-only, [data-slot="table-container"]')).filter(node => {
          const box = node.getBoundingClientRect()
          return box.left < -1 || box.right > innerWidth + 1
        }).map(node => node.id || node.textContent?.trim()))
        expect(outside).toEqual([])
        if (route.endsWith("nuevo")) {
          const submit = page.getByRole("button", { name: "Crear paciente", exact: true })
          await submit.scrollIntoViewIfNeeded()
          const box = (await submit.boundingBox())!
          expect(box.y).toBeGreaterThan(64)
          expect(box.y + box.height).toBeLessThanOrEqual(1000)
          await section(page, "emergency")
          await page.locator("#emergencyContactPhone").focus()
          const field = (await page.locator("#emergencyContactPhone").boundingBox())!
          expect(field.y + field.height).toBeLessThanOrEqual(1000)
          await expect(page.locator(".patient-form-footer")).toHaveCSS("position", "static")
          await expect(page.locator("#emergencyContactPhone")).toHaveCSS("min-height", width < 1024 ? "44px" : "40px")
        }
        results.push({ route, width })
      }
    }
    await page.setViewportSize({ width: 1440, height: 1000 })
    for (const name of ["Citas", "Historial clínico", "Tratamientos", "Finanzas", "Documentos", "Resumen"]) {
      const tab = page.getByRole("tab", { name, exact: true })
      if (!await tab.isVisible()) { await page.getByRole("button", { name: /^Más pestañas/ }).click(); await page.getByRole("menuitemradio", { name, exact: true }).click() }
      else await tab.click()
      await expect(page.getByRole("tabpanel")).toBeVisible()
    }
    expect(errors).toEqual([])
    await testInfo.attach("patient-responsive-matrix", { body: JSON.stringify(results, null, 2), contentType: "application/json" })
  })
}

test("patient validation reveals closed fields, preserves drafts, accepts passports and prevents normalized duplicates", async ({ page }) => {
  await login(page)
  await page.goto("/pacientes/nuevo")
  await baseFields(page, "0100000000")
  await page.getByRole("button", { name: "Crear paciente", exact: true }).click()
  await expect(page.locator("#documentId-error")).toContainText("dígito verificador")
  await expect(page.locator("#firstName")).toHaveValue("Elena")
  await choose(page, "documentType", "Pasaporte")
  await page.locator("#documentId").fill("PAS-TEST-001")
  await section(page, "contact")
  await page.locator("#email").fill("correo inválido")
  await section(page, "contact", false)
  await page.getByRole("button", { name: "Crear paciente", exact: true }).click()
  await expect(page.locator("#patient-section-contact [data-patient-section-trigger]")).toHaveAttribute("aria-expanded", "true")
  await expect(page.locator("#email-error")).toBeVisible()
  await page.locator("#email").fill("")
  await page.getByRole("button", { name: "Crear paciente", exact: true }).click()
  await expect(page.getByRole("heading", { name: "Elena Guerrero", exact: true })).toBeVisible()
  await page.getByRole("link", { name: "Pacientes", exact: true }).click()
  await page.getByRole("button", { name: "Nuevo paciente", exact: true }).click()
  await baseFields(page, " pas-test-001 ")
  await choose(page, "documentType", "Pasaporte")
  await page.getByRole("button", { name: "Crear paciente", exact: true }).click()
  await expect(page.locator("#documentId-error")).toHaveText("Ya existe un paciente con ese documento")
  await expect(page.locator("#lastName")).toHaveValue("Guerrero")
  const data = await page.evaluate(async () => { const path = "/src/modules/patients/api/patients.api.ts"; const { patientsApi } = await import(path); return patientsApi.list({ search: "PAS-TEST-001", pageSize: 100 }) })
  expect(data.totalItems).toBe(1)
})

test("deactivation and reactivation retain the patient and every related source", async ({ page }) => {
  await login(page)
  await page.goto("/pacientes")
  const before = await page.evaluate(async () => {
    const paths = ["/src/modules/appointments/api/appointments.mock-data.ts", "/src/modules/treatments/api/treatments.mock-data.ts", "/src/modules/clinical-history/api/clinical-history.api.ts"]
    const [{ mockAppointments }, { mockTreatmentAssignments }, { clinicalHistoryApi }] = await Promise.all(paths.map(path => import(path)))
    return { appointments: mockAppointments, assignments: mockTreatmentAssignments, history: await clinicalHistoryApi.getRecord("pat_1") }
  })
  const actions = () => page.getByRole("button", { name: "Acciones del paciente María González", exact: true })
  await actions().click()
  await page.getByRole("menuitem", { name: "Desactivar paciente", exact: true }).click()
  await page.getByRole("alertdialog", { name: "Desactivar paciente", exact: true }).getByRole("button", { name: "Cancelar", exact: true }).click()
  expect((await savedPatient(page, "pat_1")).treatmentStatus).toBe("en seguimiento")
  await actions().click()
  await page.getByRole("menuitem", { name: "Desactivar paciente", exact: true }).click()
  await page.getByRole("alertdialog").getByRole("button", { name: "Desactivar", exact: true }).click()
  await expect(page.getByRole("row", { name: "Abrir detalles del paciente María González", exact: true })).toContainText("Inactivo")
  await expect(page.getByRole("group", { name: "Resumen de pacientes" }).locator("strong")).toHaveText(["5", "2", "0", "2"])
  const after = await page.evaluate(async () => {
    const paths = ["/src/modules/appointments/api/appointments.mock-data.ts", "/src/modules/treatments/api/treatments.mock-data.ts", "/src/modules/clinical-history/api/clinical-history.api.ts"]
    const [{ mockAppointments }, { mockTreatmentAssignments }, { clinicalHistoryApi }] = await Promise.all(paths.map(path => import(path)))
    return { appointments: mockAppointments, assignments: mockTreatmentAssignments, history: await clinicalHistoryApi.getRecord("pat_1") }
  })
  expect(after).toEqual(before)
  await actions().click()
  await page.getByRole("menuitem", { name: "Reactivar paciente", exact: true }).click()
  await page.getByRole("alertdialog").getByRole("button", { name: "Reactivar", exact: true }).click()
  await expect(page.getByRole("row", { name: "Abrir detalles del paciente María González", exact: true })).toContainText("Activo")
  expect((await savedPatient(page, "pat_1")).clinicalRecordNumber).toBe("HC-000001")
})

test("scheduling from the patient reuses the appointment form and refreshes the patient appointments", async ({ page }) => {
  await login(page)
  await page.goto("/pacientes/pat_5")
  await page.getByRole("button", { name: "Agendar cita", exact: true }).click()
  const dialog = page.getByRole("dialog", { name: "Nueva cita", exact: true })
  await expect(dialog.locator("#patientId")).toContainText("Valentina Suárez")
  await dialog.locator("#professionalId").click()
  await page.getByRole("option").first().click()
  await dialog.locator("#date").fill("2026-12-10")
  await dialog.locator("#startTime").fill("10:00")
  await dialog.locator("#endTime").fill("10:30")
  await dialog.getByRole("button", { name: "Agendar cita", exact: true }).click()
  await expect(dialog).not.toBeVisible()
  await page.getByRole("tab", { name: "Citas", exact: true }).click()
  await expect(page.getByRole("tabpanel")).toContainText("10 dic 2026")
  expect(await page.evaluate(async () => { const path = "/src/modules/appointments/api/appointments.api.ts"; const { appointmentsApi } = await import(path); const appointments = await appointmentsApi.listByPatient("pat_5"); return appointments.some((item: { start: string }) => item.start.startsWith("2026-12-10")) })).toBe(true)
})

test("patient API validation is atomic for duplicate edits and legacy removal remains logical", async ({ page }) => {
  await page.goto("/login")
  const result = await page.evaluate(async () => {
    const apiPath = "/src/modules/patients/api/patients.api.ts", typesPath = "/src/modules/patients/types/patient.types.ts"
    const appointmentPath = "/src/modules/appointments/api/appointments.mock-data.ts", assignmentPath = "/src/modules/treatments/api/treatments.mock-data.ts"
    const financePath = "/src/modules/finance/api/finance.api.ts"
    const [{ patientsApi }, { toPatientFormValues }, { mockAppointments }, { mockTreatmentAssignments }, { financeApi }] = await Promise.all([import(apiPath), import(typesPath), import(appointmentPath), import(assignmentPath), import(financePath)])
    const original = await patientsApi.get("pat_1")
    const before = JSON.stringify(original)
    let duplicateStatus = 0, invalidStatus = 0
    try { await patientsApi.update("pat_1", { ...toPatientFormValues(original), documentId: "0203040506", documentType: "otro" }) } catch (error) { duplicateStatus = (error as { status: number }).status }
    const unchangedAfterFailure = JSON.stringify(await patientsApi.get("pat_1")) === before
    try { await patientsApi.create({ ...toPatientFormValues(original), documentId: "0100000000", documentType: "cedula" }) } catch (error) { invalidStatus = (error as { status: number }).status }
    const related = JSON.stringify({ appointments: mockAppointments, assignments: mockTreatmentAssignments })
    const finances = JSON.stringify(await financeApi.getPatientSummary("pat_1"))
    await patientsApi.remove("pat_1")
    const retained = await patientsApi.get("pat_1")
    const total = (await patientsApi.list({ pageSize: 100 })).totalItems
    return { duplicateStatus, invalidStatus, unchangedAfterFailure, status: retained.treatmentStatus, sameNumber: retained.clinicalRecordNumber === original.clinicalRecordNumber, total, relationsUnchanged: related === JSON.stringify({ appointments: mockAppointments, assignments: mockTreatmentAssignments }), financesUnchanged: finances === JSON.stringify(await financeApi.getPatientSummary("pat_1")) }
  })
  expect(result).toEqual({ duplicateStatus: 409, invalidStatus: 400, unchangedAfterFailure: true, status: "inactivo", sameNumber: true, total: 5, relationsUnchanged: true, financesUnchanged: true })
})

for (const role of ["admin", "medico", "recepcion"]) {
  test(`patient tabs respect clinical access and last visit comes from completed sources for ${role}`, async ({ page }) => {
    await login(page, "dark", role)
    await page.goto("/pacientes/pat_1")
    await expect(page.getByRole("heading", { name: "María González", exact: true })).toBeVisible()
    await expect(page.getByRole("tab", { name: "Historial clínico", exact: true })).toHaveCount(role === "recepcion" ? 0 : 1)
    const record = await savedPatient(page, "pat_1")
    const state = await page.evaluate(async () => {
      const path = "/src/modules/appointments/api/appointments.mock-data.ts", client = "/src/shared/lib/query-client.ts"
      const [{ mockAppointments }, { queryClient }] = await Promise.all([import(path), import(client)])
      mockAppointments.push({ ...mockAppointments[0], id: "latest-completed-fixture", patientId: "pat_1", status: "completada", start: "2026-11-14T08:00:00-05:00", end: "2026-11-14T08:30:00-05:00" })
      await queryClient.invalidateQueries({ queryKey: ["appointments"] })
      return true
    })
    expect(state).toBe(true)
    await expect(page.getByText("14/11/2026", { exact: true })).toBeVisible()
    expect((await savedPatient(page, "pat_1")).lastVisitAt).toBe(record.lastVisitAt)
    if (role === "recepcion") {
      await page.getByRole("tab", { name: "Documentos", exact: true }).click()
      await expect(page.getByRole("tabpanel")).toContainText("perfil clínico autorizado")
      await page.goto("/historial-clinico/paciente/pat_1")
      await expect(page).toHaveURL(/\/403$/)
      await expect(page.locator("iframe")).toHaveCount(0)
    }
  })
}
