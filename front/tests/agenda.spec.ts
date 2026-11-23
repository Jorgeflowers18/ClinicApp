import { expect, test } from "@playwright/test"

import { activeProfessional, activeRoom, apiAs, createPatient, inDays, login, ok, unique } from "./helpers/api"

test("una cita en hora de la clínica, sus choques y sus estados los valida el servidor", async () => {
  const api = await apiAs("recepcion")
  const patient = await createPatient(api, `Agenda${unique()}`)
  const professional = await activeProfessional(api), room = await activeRoom(api)
  const day = inDays(20)
  const body = { patientId: patient.id, professionalId: professional.id, roomId: room.id, treatmentId: "", notes: "", date: day, startTime: "09:00", endTime: "09:30" }

  const created = await ok(await api.post("appointments", { data: body }))
  expect(created.start).toBe(`${day}T14:00:00Z`) // 09:00 en Ecuador (UTC−5)
  expect(created.patientName).toBe(`${patient.firstName} ${patient.lastName}`)

  const clash = await api.post("appointments", { data: { ...body, startTime: "09:15", endTime: "09:45" } })
  expect(clash.status()).toBe(409)
  expect((await clash.json()).errors).toHaveProperty("startTime")

  const block = await api.post("schedule-blocks", { data: { roomId: room.id, professionalId: "", date: day, startTime: "09:10", endTime: "09:20", reason: "Mantenimiento" } })
  expect(block.status()).toBe(409)

  await ok(await api.patch(`appointments/${created.id}/status`, { data: { status: "cancelada" } }))
  const edit = await api.put(`appointments/${created.id}`, { data: { ...body, startTime: "10:00", endTime: "10:30" } })
  expect(edit.status()).toBe(409)
})

test("el calendario pide solo la semana visible y muestra el nombre del paciente", async ({ page }) => {
  const api = await apiAs("admin")
  const patient = await createPatient(api, `Semana${unique()}`)
  const professional = await activeProfessional(api)
  await ok(await api.post("appointments", { data: { patientId: patient.id, professionalId: professional.id, roomId: "", treatmentId: "", notes: "", date: inDays(1), startTime: "11:00", endTime: "11:30" } }))

  const ranges: string[] = []
  page.on("request", (request) => { const url = new URL(request.url()); if (url.pathname === "/api/appointments") ranges.push(url.search) })
  await login(page, "admin")
  await page.goto("/citas")
  await expect.poll(() => ranges.some((search) => search.includes("from=") && search.includes("to="))).toBe(true)
  // Mañana puede caer en la semana siguiente: se avanza si hace falta.
  const card = page.getByText(`${patient.firstName} ${patient.lastName}`).filter({ visible: true }).first()
  if (!(await card.isVisible().catch(() => false))) await page.getByRole("button", { name: /Siguiente/ }).first().click()
  await expect(card).toBeVisible()
})
