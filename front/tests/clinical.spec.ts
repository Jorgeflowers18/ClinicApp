import { expect, test } from "@playwright/test"

import { activeProfessional, apiAs, createPatient, login, ok, today, unique } from "./helpers/api"

test("registrar una atención descuenta insumos, completa la cita y se ve en la historia", async ({ page }) => {
  const api = await apiAs("admin")
  const stamp = unique()
  const patient = await createPatient(api, `Historia${stamp}`)
  const professional = await activeProfessional(api)

  const item = await ok(await api.post("inventory/items", { data: { name: `Anestesia ${stamp}`, category: "Prueba", unit: "unidad", kind: "consumible", minStock: 0, unitCost: 1 } }))
  await ok(await api.post(`inventory/items/${item.id}/movements`, { data: { type: "entrada", quantity: 10, reason: "Stock inicial" } }))
  const treatment = await ok(await api.post("treatments", { data: { name: `Obturación ${stamp}`, category: "Prueba", durationMinutes: 30, price: 40, active: true, consumption: [{ itemId: item.id, quantity: 2 }] } }))
  const appointment = await ok(await api.post("appointments", { data: { patientId: patient.id, professionalId: professional.id, roomId: "", treatmentId: "", notes: "", date: today(), startTime: "06:00", endTime: "06:20" } }))

  // La historia nueva arranca en la revisión 0; la atención se registra en una sola transacción.
  const history = await ok(await api.get(`clinical-history/patients/${patient.id}`))
  expect(history.record.revision).toBe(0)
  const record = await ok(await api.put(`clinical-history/patients/${patient.id}`, { data: history.record }))
  const encounterId = crypto.randomUUID()
  const encounter = {
    id: encounterId, date: today(), professionalId: professional.id, appointmentId: appointment.id, reason: `Control ${stamp}`,
    diagnoses: [{ id: crypto.randomUUID(), description: "Caries dental K02.1", tooth: "16", priority: "media" }],
    performedTreatments: [{ id: crypto.randomUUID(), treatmentId: treatment.id, description: "", tooth: "16", cost: 40, assignmentId: null }],
    requestedExams: [], chartSnapshot: null, clinicalSnapshot: null,
  }
  // Los campos que el formulario completa por defecto se toman del propio front.
  await login(page, "admin")
  const defaults = await page.evaluate(async () => (await import(/* @vite-ignore */ "/src/modules/clinical-history/lib/encounter.ts")).emptyEncounterValues())
  const result = await ok(await api.post(`clinical-history/patients/${patient.id}/encounters/register`, { data: { ...defaults, ...encounter } }))
  expect(result.appointmentCompleted).toBe(true)
  expect(record.revision).toBe(1)

  // Reintentar con el mismo id no duplica nada.
  await ok(await api.post(`clinical-history/patients/${patient.id}/encounters/register`, { data: { ...defaults, ...encounter } }))
  expect((await ok(await api.get(`inventory/items/${item.id}`))).stock).toBe(8)
  expect((await ok(await api.get(`treatment-assignments?patientId=${patient.id}`))).length).toBe(1)

  await page.goto("/historial-clinico")
  // El nombre del paciente sale de la fila (`patientName`), no de una lista de pacientes.
  await expect(page.getByText(`Historia${stamp} Prueba E2E`).filter({ visible: true }).first()).toBeVisible()
  await page.getByText(`Control ${stamp}`).first().click()
  await expect(page).toHaveURL(new RegExp(`/historial-clinico/paciente/${patient.id}`))
  await expect(page.getByText("Caries dental K02.1").first()).toBeVisible()
})

test("el archivo clínico detecta duplicados en el servidor y audita los cambios", async () => {
  const api = await apiAs("medico")
  const admin = await apiAs("admin")
  const patient = await createPatient(admin, `Archivo${unique()}`)
  // PNG válido de 1×1: el servidor reconoce el formato por los primeros bytes.
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64")
  const form = { file: { name: "rx.png", mimeType: "image/png", buffer: png }, displayName: "Rx de prueba", clinicalType: "panoramica" }

  const attached = await api.post(`clinical-history/patients/${patient.id}/archive/files`, { multipart: form })
  const history = await ok(attached)
  const file = history.record.attachments.at(-1)
  expect(file.archive.digest).toBeTruthy()
  const duplicate = await api.post(`clinical-history/patients/${patient.id}/archive/files`, { multipart: form })
  expect(duplicate.status()).toBe(409)
  expect((await duplicate.json()).errors).toHaveProperty("file")

  const archived = await ok(await api.post(`clinical-history/attachments/${file.id}/archive`, { data: { version: file.archive.version } }))
  const after = archived.record.attachments.find((item: { id: string }) => item.id === file.id)
  expect(after.archive.audit.map((entry: { action: string }) => entry.action)).toEqual(["adjuntar", "archivar"])
  expect(after.archive.audit[1].actor.name).toBeTruthy()
})
