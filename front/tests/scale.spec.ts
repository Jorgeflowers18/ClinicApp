import { expect, test, type Page } from "@playwright/test"

import { activeProfessional, apiAs, createPatient, inDays, login, ok, today, unique } from "./helpers/api"

// Plan 12, punto 1: ninguna pantalla depende de "los primeros 100" ni pide cada paciente por separado.

/** Rutas de la API que pidió la página (sin las de sesión). */
function apiCalls(page: Page) {
  const calls: string[] = []
  page.on("request", (request) => {
    const url = new URL(request.url())
    if (url.pathname.startsWith("/api/") && !url.pathname.startsWith("/api/auth")) calls.push(url.pathname + url.search)
  })
  return calls
}

test("la cita encuentra al paciente buscando en el servidor, aunque haya más de 100", async ({ page }) => {
  test.setTimeout(90_000)
  const api = await apiAs("admin")
  const stamp = unique()
  // Más de 100 pacientes: el selector anterior solo mostraba los primeros 100.
  for (let batch = 0; batch < 10; batch++) {
    await Promise.all(Array.from({ length: 11 }, (_, index) => createPatient(api, `Relleno${stamp}`, `Lote ${batch} ${index}`)))
  }
  const target = await createPatient(api, `Buscada${stamp}`, "Zúñiga Final")
  const professional = await activeProfessional(api)

  await login(page, "recepcion")
  await page.goto("/citas")
  await page.getByRole("button", { name: "Nueva cita" }).first().click()
  const dialog = page.getByRole("dialog", { name: "Nueva cita" })
  await dialog.locator("#patientId").fill(`buscada${stamp} zuniga`) // sin tildes ni mayúsculas
  await page.getByRole("option", { name: new RegExp(`Buscada${stamp} Zúñiga Final`) }).click()
  await expect(dialog.locator("#patientId")).toHaveValue(`Buscada${stamp} Zúñiga Final`)

  await dialog.locator("#professionalId").click()
  await page.getByRole("option", { name: new RegExp(professional.name) }).first().click()
  await dialog.locator("#date").fill(inDays(25))
  await dialog.locator("#startTime").fill("16:00")
  await dialog.locator("#endTime").fill("16:30")
  await dialog.getByRole("button", { name: "Agendar cita" }).click()
  await expect(dialog).toHaveCount(0)

  const appointments = await ok(await api.get(`appointments?patientId=${target.id}`))
  expect(appointments).toHaveLength(1)
  expect(appointments[0].patientName).toBe(`Buscada${stamp} Zúñiga Final`)
})

test("historial clínico y detalle del tratamiento nombran al paciente sin pedirlo aparte", async ({ page }) => {
  const api = await apiAs("admin")
  const stamp = unique()
  const patient = await createPatient(api, `Nombre${stamp}`)
  const treatment = await ok(await api.post("treatments", { data: { name: `Sellante ${stamp}`, category: "Prueba", durationMinutes: 20, price: 15, active: true, consumption: [] } }))
  await ok(await api.post("treatment-assignments", { data: { treatmentId: treatment.id, patientId: patient.id, date: today(), tooth: "", sourceEncounterId: null, sourceKey: `e2e:${stamp}`, price: 15 } }))

  const calls = apiCalls(page)
  await login(page, "admin")
  await page.goto(`/tratamientos/${treatment.id}`)
  await expect(page.getByText(`Nombre${stamp} Prueba E2E`).filter({ visible: true }).first()).toBeVisible()
  expect(calls.filter((call) => call.startsWith(`/api/patients/${patient.id}`))).toHaveLength(0)

  // Lista de atenciones: el filtro de paciente busca en el servidor.
  await page.goto("/historial-clinico")
  const filter = page.getByRole("combobox", { name: "Filtrar por paciente" }).first()
  await filter.fill(`Nombre${stamp}`)
  await page.getByRole("option", { name: new RegExp(`Nombre${stamp}`) }).click()
  await expect(page).toHaveURL(new RegExp(`pacienteId=${patient.id}`))
  expect(calls.some((call) => call.startsWith("/api/patients?") && call.includes("pageSize=100"))).toBe(false)
})

test("el historial de mensajes pagina y filtra en el servidor, con los indicadores aparte", async ({ page }) => {
  const calls = apiCalls(page)
  await login(page, "recepcion")
  await page.goto("/notificaciones")
  await expect.poll(() => calls.some((call) => call === "/api/notifications/summary")).toBe(true)
  await expect.poll(() => calls.some((call) => call.startsWith("/api/notifications?") && call.includes("pageSize=10"))).toBe(true)
  // Sin leer el historial completo (antes: páginas de 100 hasta el final).
  expect(calls.some((call) => call.startsWith("/api/notifications?") && call.includes("pageSize=100"))).toBe(false)

  await page.getByRole("button", { name: /^Filtros/ }).click()
  await page.locator("#message-filter-Estado").click()
  await page.getByRole("option", { name: "Fallido", exact: true }).click()
  await expect.poll(() => calls.some((call) => call.startsWith("/api/notifications?") && call.includes("status=fallida"))).toBe(true)
})

test("los selectores de insumos usan el listado liviano", async ({ page }) => {
  const calls = apiCalls(page)
  await login(page, "admin")
  await page.goto("/tratamientos")
  await page.getByRole("button", { name: "Nuevo tratamiento" }).click()
  await expect.poll(() => calls.includes("/api/inventory/items/options")).toBe(true)
  expect(calls.some((call) => call.startsWith("/api/inventory/items?"))).toBe(false)
})
