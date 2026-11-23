import { expect, test } from "@playwright/test"

import { apiAs, createPatient, login, ok, today, unique } from "./helpers/api"

/** Un paciente con un tratamiento realizado de $40 (saldo pendiente $40). */
async function patientWithBalance(stamp: string) {
  const api = await apiAs("admin")
  const patient = await createPatient(api, `Cartera${stamp}`)
  const treatment = await ok(await api.post("treatments", { data: { name: `Profilaxis ${stamp}`, category: "Prueba", durationMinutes: 30, price: 40, active: true, consumption: [] } }))

  await ok(await api.post("treatment-assignments", { data: { treatmentId: treatment.id, patientId: patient.id, date: today(), tooth: "", sourceEncounterId: null, sourceKey: `e2e:${stamp}`, price: 40 } }))
  return { api, patient, treatment }
}

test("registrar un pago desde la ficha baja el saldo, y uno mayor al saldo se rechaza en el monto", async ({ page }) => {
  const stamp = unique()
  const { api, patient, treatment } = await patientWithBalance(stamp)

  await login(page, "recepcion")
  await page.goto(`/pacientes/${patient.id}`)
  await page.getByRole("tab", { name: "Finanzas", exact: true }).click()
  await page.locator("details.patient-ledger summary", { hasText: `Profilaxis ${stamp}` }).click()
  await page.getByRole("button", { name: "Registrar pago", exact: true }).click()
  const dialog = page.getByRole("dialog", { name: "Registrar pago" })
  await dialog.getByLabel("Monto (USD)", { exact: true }).fill("15")
  await dialog.getByRole("button", { name: "Registrar pago", exact: true }).click()
  await expect(dialog).toHaveCount(0)

  const summary = await ok(await api.get(`finance/treatments/${treatment.id}/summary?patientId=${patient.id}`))
  expect(summary.pendingBalance).toBe(25)

  const overpay = await api.post("finance/payments", { data: { patientId: patient.id, treatmentId: treatment.id, date: today(), amount: 30, method: "efectivo" } })
  expect(overpay.status()).toBe(409)
  expect((await overpay.json()).errors).toHaveProperty("amount")
})

test("anular un pago devuelve el saldo y no se puede anular dos veces", async () => {
  const stamp = unique()
  const { api, patient, treatment } = await patientWithBalance(stamp)
  const payment = await ok(await api.post("finance/payments", { data: { patientId: patient.id, treatmentId: treatment.id, date: today(), amount: 10, method: "transferencia", reference: "E2E" } }))
  const voided = await ok(await api.post(`finance/payments/${payment.id}/void`, { data: { reason: "Prueba E2E" } }))
  expect(voided.status).toBe("anulado")
  expect((await api.post(`finance/payments/${payment.id}/void`, { data: { reason: "Otra vez" } })).status()).toBe(409)
  expect((await ok(await api.get(`finance/treatments/${treatment.id}/summary?patientId=${patient.id}`))).pendingBalance).toBe(40)
})

test("el médico no puede leer montos (403)", async () => {
  const api = await apiAs("medico")
  expect((await api.get("finance/portfolio")).status()).toBe(403)
})
