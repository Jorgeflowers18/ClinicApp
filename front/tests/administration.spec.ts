import { expect, test } from "@playwright/test"

import { apiAs, createPatient, inDays, login, ok, unique } from "./helpers/api"

// Plan 12, punto 3.2: el admin crea, edita y desactiva profesionales y consultorios.
// Los nombres empiezan con "Zz" para quedar al final: las demás pruebas toman el primer activo.

test("el admin crea un profesional y al desactivarlo ve cuántas citas futuras tiene", async ({ page }) => {
  const api = await apiAs("admin")
  const name = `Zz Dra. E2E ${unique()}`

  await login(page, "admin")
  await page.getByRole("button", { name: /Menú de usuario/ }).click()
  await page.getByRole("menuitem", { name: "Administración" }).click()
  await expect(page).toHaveURL(/\/administracion$/)

  await page.getByRole("button", { name: "Nuevo profesional", exact: true }).click()
  await page.locator("#professionalName").fill(name)
  await page.locator("#professionalSpecialty").fill("Ortodoncia")
  await page.locator("#professionalRegistration").fill("MSP-E2E-1")
  await page.getByRole("button", { name: "Crear profesional" }).click()
  await expect(page.getByText("Profesional creado")).toBeVisible()
  await expect(page.getByText(name).filter({ visible: true }).first()).toBeVisible()

  const created = (await ok<Array<{ id: string; name: string; active: boolean; registrationNumber: string }>>(await api.get("professionals")))
    .find((item) => item.name === name)!
  expect(created).toMatchObject({ active: true, registrationNumber: "MSP-E2E-1" })

  // Una cita futura con ese profesional: al desactivarlo se avisa.
  const patient = await createPatient(api, `Admin${unique()}`)
  await ok(await api.post("appointments", { data: { patientId: patient.id, professionalId: created.id, roomId: "", treatmentId: "", notes: "", date: inDays(3), startTime: "10:00", endTime: "10:30" } }))

  await page.getByLabel(`Editar profesional: ${name}`).filter({ visible: true }).first().click()
  await page.getByRole("switch", { name: /Profesional activo/ }).click()
  await page.getByRole("button", { name: "Guardar cambios" }).click()
  await expect(page.getByText("Profesional desactivado. Tiene 1 cita futura: reprográmala o cancélala en la agenda.")).toBeVisible()

  const after = (await ok<Array<{ id: string; active: boolean }>>(await api.get(`professionals/${created.id}`)))
  expect(after).toMatchObject({ active: false })
})

test("un consultorio con el nombre de otro activo se rechaza en su campo", async ({ page }) => {
  const api = await apiAs("admin")
  const name = `Zz Sala E2E ${unique()}`
  try {
    await login(page, "admin")
    await page.goto("/administracion")
    await page.getByRole("tab", { name: "Consultorios" }).click()

    await page.getByRole("button", { name: "Nuevo consultorio", exact: true }).click()
    await page.locator("#roomName").fill(name)
    await page.getByRole("button", { name: "Crear consultorio" }).click()
    await expect(page.getByText("Consultorio creado")).toBeVisible()

    await page.getByRole("button", { name: "Nuevo consultorio", exact: true }).click()
    await page.locator("#roomName").fill(name.toUpperCase())
    await page.getByRole("button", { name: "Crear consultorio" }).click()
    await expect(page.getByText("Ya existe un consultorio activo con ese nombre")).toBeVisible()
    await expect(page.locator("#roomName")).toHaveAttribute("aria-invalid", "true")
  } finally {
    // Queda inactivo para no ofrecerse en las demás pruebas.
    const rooms: Array<{ id: string; name: string }> = await ok(await api.get("rooms"))
    for (const room of rooms.filter((item) => item.name === name)) await ok(await api.put(`rooms/${room.id}`, { data: { name, active: false } }))
  }
})

test("recepción no ve ni entra a Administración", async ({ page }) => {
  await login(page, "recepcion")
  await page.getByRole("button", { name: /Menú de usuario/ }).click()
  await expect(page.getByRole("menuitem", { name: "Administración" })).toHaveCount(0)
  await page.keyboard.press("Escape")
  await page.goto("/administracion")
  await expect(page).toHaveURL(/\/403$/)
})
