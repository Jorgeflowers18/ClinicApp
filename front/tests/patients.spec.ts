import { expect, test } from "@playwright/test"

import { apiAs, cedula, createPatient, login, ok, unique } from "./helpers/api"

test("la lista busca en el servidor, sin tildes y por N.° de historia", async ({ page }) => {
  const api = await apiAs("admin")
  const name = `Jóse${unique()}`
  const patient = await createPatient(api, name)
  expect(patient.clinicalRecordNumber).toMatch(/^HC-\d{6}$/)

  await login(page, "admin")
  await page.goto("/pacientes")
  const search = page.getByRole("searchbox", { name: "Buscar pacientes" }).or(page.getByLabel("Buscar pacientes")).first()
  await search.fill(name.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase())
  await expect(page.getByText(`${name} Prueba E2E`).first()).toBeVisible()
  await search.fill(patient.clinicalRecordNumber)
  await expect(page.getByText(`${name} Prueba E2E`).first()).toBeVisible()
})

test("documento repetido y cédula inválida llegan con el campo del error", async () => {
  const api = await apiAs("recepcion")
  const document = cedula()
  const body = { firstName: "Doble", lastName: "Documento", documentId: document, documentType: "cedula", birthDate: "1990-01-01", gender: "masculino", notificationsEnabled: true, treatmentStatus: "activo" }
  await ok(await api.post("patients", { data: body }))
  const duplicate = await api.post("patients", { data: body })
  expect(duplicate.status()).toBe(409)
  expect((await duplicate.json()).errors).toHaveProperty("documentId")
  const invalid = await api.post("patients", { data: { ...body, documentId: "1700000000" } })
  expect(invalid.status()).toBe(400)
  expect((await invalid.json()).errors).toHaveProperty("documentId")
})

test("dar de baja desde la ficha, verlo en la vista de dados de baja y reactivarlo", async ({ page }) => {
  const api = await apiAs("admin")
  const name = `Baja${unique()}`
  const patient = await createPatient(api, name)

  await login(page, "admin")
  await page.goto(`/pacientes/${patient.id}`)
  await page.getByRole("button", { name: /^Acciones del paciente/ }).click()
  await page.getByRole("menuitem", { name: "Dar de baja", exact: true }).click()
  await page.getByRole("alertdialog").getByRole("button", { name: "Dar de baja", exact: true }).click()
  await expect(page.locator(".patient-removed-notice")).toContainText("Paciente dado de baja")
  await expect(page.getByRole("button", { name: "Editar", exact: true })).toHaveCount(0)

  await page.goto("/pacientes")
  await page.getByRole("button", { name: /Filtros avanzados/ }).click()
  await page.getByRole("checkbox", { name: "Ver solo pacientes dados de baja" }).click()
  await page.getByRole("searchbox", { name: "Buscar pacientes" }).or(page.getByLabel("Buscar pacientes")).first().fill(name)
  await page.getByRole("button", { name: `Reactivar a ${name} Prueba E2E` }).first().click()
  await expect(page.getByText("Sin pacientes dados de baja").first()).toBeVisible()

  const restored = await ok(await api.get(`patients/${patient.id}`))
  expect(restored.deletedAt).toBeNull()
})

test("el médico no ve la pestaña Finanzas ni la opción de dar de baja", async ({ page }) => {
  const api = await apiAs("admin")
  const patient = await createPatient(api, `Medico${unique()}`)
  await login(page, "medico")
  await page.goto(`/pacientes/${patient.id}`)
  await expect(page.locator(".patient-detail-tabs")).toBeVisible()
  await expect(page.getByRole("tab", { name: "Finanzas", exact: true })).toHaveCount(0)
  await page.getByRole("button", { name: /^Acciones del paciente/ }).click()
  await expect(page.getByRole("menuitem", { name: "Dar de baja", exact: true })).toHaveCount(0)
})
