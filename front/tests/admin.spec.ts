import { expect, test } from "@playwright/test"

import { apiAs, login, ok, unique } from "./helpers/api"

test("el nombre de la clínica se guarda en la API y lo ve el inicio de sesión sin sesión", async ({ page, browser }) => {
  const api = await apiAs("admin")
  const before = await ok(await api.get("institution/profile"))
  const name = `Clínica E2E ${unique()}`
  try {
    await login(page, "admin")
    await page.goto("/perfil-institucion")
    await page.locator("#institution-profile-name").fill(name)
    await page.getByRole("button", { name: "Guardar cambios", exact: true }).click()
    await expect(page.getByText("Cambios guardados")).toBeVisible()
    await expect(page.locator("[data-institution-name]").first()).toHaveText(name)

    const anonymous = await browser.newPage()
    await anonymous.goto("/login")
    await expect(anonymous.locator(".auth-brand h1")).toHaveText(name)
    await anonymous.close()

    // Un RUC de 12 dígitos lo rechaza el servidor, en su campo.
    await page.locator("#institution-profile-ruc").fill("123456789012")
    await page.getByRole("button", { name: "Guardar cambios", exact: true }).click()
    await expect(page.locator("#institution-error-ruc")).toHaveText("El RUC debe tener 13 dígitos")
  } finally {
    await ok(await api.put("institution/profile", { data: { ...before, name: before.name } }))
  }
})

test("las alertas del encabezado salen de una sola petición", async ({ page }) => {
  const requests: string[] = []
  page.on("request", (request) => { const url = new URL(request.url()); if (url.pathname.startsWith("/api/") && !url.pathname.startsWith("/api/auth")) requests.push(url.pathname) })
  await login(page, "recepcion")
  await expect.poll(() => requests.includes("/api/alerts")).toBe(true)
  // Sin listados completos de pacientes ni de inventario para armar las alertas.
  expect(requests.filter((path) => path === "/api/patients" || path === "/api/inventory/items").length).toBe(0)
})

test("la plantilla de mensajes valida en el servidor", async () => {
  const api = await apiAs("admin")
  const template = await ok(await api.get("notifications/template"))
  const short = await api.put("notifications/template", { data: { message: "corto" } })
  expect(short.status()).toBe(400)
  expect((await short.json()).errors).toHaveProperty("message")
  await ok(await api.put("notifications/template", { data: { message: template.message } }))
})

test("los reportes leen la API y un periodo de más de 366 días se rechaza", async ({ page }) => {
  const api = await apiAs("admin")
  const summary = await ok(await api.get("reports/summary?from=2026-01-01&to=2026-01-31"))
  expect(summary).toHaveProperty("patientsTotal")
  const tooLong = await api.get("reports/summary?from=2024-01-01&to=2026-01-01")
  expect(tooLong.status()).toBe(400)

  await login(page, "admin")
  await page.goto("/reportes")
  await expect(page.getByRole("heading", { name: /Reportes/ }).first()).toBeVisible()
  await expect(page.getByRole("alert")).toHaveCount(0)
})

test("recepción no entra a reportes y el médico no entra a inventario", async ({ page, browser }) => {
  await login(page, "recepcion")
  await page.goto("/reportes")
  await expect(page).toHaveURL(/\/403$/)

  // El médico en un contexto propio (la página 403 no tiene el menú de usuario para cerrar sesión).
  const context = await browser.newContext()
  try {
    const doctor = await context.newPage()
    await login(doctor, "medico")
    await doctor.goto("/inventario")
    await expect(doctor).toHaveURL(/\/403$/)
  } finally {
    await context.close()
  }
})
