import { expect, test } from "@playwright/test"

import { apiAs, createPatient, inDays, login, ok, unique } from "./helpers/api"

// Plan 12, puntos 3.2 y 3.3: el admin gestiona profesionales, consultorios y cuentas de usuario.
// Los nombres empiezan con "Zz" para quedar al final: las demás pruebas toman el primer activo.

test("el admin crea un profesional y al desactivarlo ve cuántas citas futuras tiene", async ({ page }) => {
  const api = await apiAs("admin")
  const name = `Zz Dra. E2E ${unique()}`

  await login(page, "admin")
  await page.getByRole("button", { name: /Menú de usuario/ }).click()
  await page.getByRole("menuitem", { name: "Administración" }).click()
  await expect(page).toHaveURL(/\/administracion$/)
  await page.getByRole("tab", { name: "Profesionales" }).click()

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

test("el admin crea una cuenta, la persona elige su contraseña con el enlace y al desactivarla ya no entra", async ({ page, browser }) => {
  const api = await apiAs("admin")
  const stamp = unique()
  const name = `Zz Recepción E2E ${stamp}`
  const email = `recepcion.${stamp}@clinica.com`
  const password = "contrasena-e2e-1"

  await login(page, "admin")
  await page.goto("/administracion")
  await page.getByRole("button", { name: "Nueva cuenta", exact: true }).click()
  await page.locator("#userName").fill(name)
  await page.locator("#userEmail").fill(email)
  await page.getByRole("button", { name: "Crear cuenta" }).click()

  // El enlace se muestra una sola vez; el servidor lo arma con su URL del front, aquí se usa la ruta.
  const url = await page.locator("#passwordLinkUrl").inputValue()
  expect(url).toContain("/restablecer-contrasena?token=")
  await page.getByRole("button", { name: "Listo" }).click()
  await expect(page.getByText(name).filter({ visible: true }).first()).toBeVisible()

  const person = await browser.newContext()
  const tab = await person.newPage()
  const link = new URL(url)
  await tab.goto(link.pathname + link.search)
  await tab.locator("#reset-password").fill(password)
  await tab.locator("#reset-confirmation").fill(password)
  await tab.getByRole("button", { name: "Guardar contraseña" }).click()
  await expect(tab).toHaveURL(/\/login/)
  await tab.locator("#email").fill(email)
  await tab.locator("#password").fill(password)
  await tab.getByRole("button", { name: "Ingresar", exact: true }).click()
  // Primer ingreso: completa su perfil, con el nombre que le puso el admin.
  await expect(tab.getByRole("heading", { name: "Completa tu perfil" })).toBeVisible()
  await expect(tab.getByText(name).first()).toBeVisible()
  await person.close()

  // Desactivarla: ya no puede iniciar sesión.
  await page.getByLabel(`Editar cuenta: ${name}`).filter({ visible: true }).first().click()
  await page.getByRole("switch", { name: /Cuenta activa/ }).click()
  await page.getByRole("button", { name: "Guardar cambios" }).click()
  await expect(page.getByText("Cuenta actualizada")).toBeVisible()

  const users: Array<{ email: string; active: boolean }> = await ok(await api.get("users"))
  expect(users.find((user) => user.email === email)).toMatchObject({ active: false })

  const again = await browser.newContext()
  const retry = await again.newPage()
  await retry.goto("/login")
  await retry.locator("#email").fill(email)
  await retry.locator("#password").fill(password)
  await retry.getByRole("button", { name: "Ingresar", exact: true }).click()
  // El 403 de la cuenta desactivada: el login muestra el detalle del servidor.
  await expect(retry.getByRole("alert").filter({ hasText: "Comunícate con el administrador de la clínica." })).toBeVisible()
  await expect(retry).toHaveURL(/\/login/)
  await again.close()
})

test("el admin no puede quitarse el rol ni desactivar su propia cuenta", async ({ page }) => {
  await login(page, "admin")
  await page.goto("/administracion")
  await page.getByLabel("Editar cuenta: Ana Morales").filter({ visible: true }).first().click()
  await expect(page.getByRole("switch", { name: /Cuenta activa/ })).toBeDisabled()
  await expect(page.locator("#userRole")).toBeDisabled()
  await expect(page.getByText("No puedes desactivar tu propia cuenta ni quitarte el rol de administrador.")).toBeVisible()
})
