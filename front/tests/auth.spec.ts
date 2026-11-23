import { expect, test } from "@playwright/test"

import { accounts, login } from "./helpers/api"

test("credenciales incorrectas muestran el error del servidor", async ({ page }) => {
  await page.goto("/login")
  await page.locator("#email").fill(accounts.admin.email)
  await page.locator("#password").fill("contraseña-equivocada")
  await page.getByRole("button", { name: "Ingresar", exact: true }).click()
  await expect(page.getByRole("alert")).toHaveText("Correo o contraseña incorrectos")
  await expect(page).toHaveURL(/\/login$/)
})

test("la sesión sobrevive a la recarga sin guardar el token, y cerrar sesión la termina", async ({ page }) => {
  await login(page, "admin")
  await page.goto("/pacientes")
  await page.reload()
  await expect(page).toHaveURL(/\/pacientes$/)
  await expect(page.locator(".clinic-app-header")).toBeVisible()

  const storage = await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))
  expect(storage).not.toMatch(/eyJ[\w-]+\.[\w-]+\./) // ningún JWT en el navegador

  await page.getByRole("button", { name: /^Menú de usuario:/ }).click()
  await page.getByRole("menuitem", { name: "Cerrar sesión", exact: true }).click()
  await expect(page).toHaveURL(/\/login/)
  await page.goto("/pacientes")
  await expect(page).toHaveURL(/\/login/)
})

test("un token vencido se renueva solo y la petición se reintenta", async ({ page }) => {
  await login(page, "admin")
  const calls: string[] = []
  page.on("response", (response) => { const url = new URL(response.url()); if (url.pathname.startsWith("/api/")) calls.push(`${response.status()} ${url.pathname}`) })
  // Se reemplaza el token en memoria por uno inválido: la siguiente petición recibe 401.
  await page.evaluate(async () => {
    const { useAuthStore } = await import(/* @vite-ignore */ "/src/modules/auth/store/auth-store.ts")
    useAuthStore.setState({ accessToken: "token-vencido" })
    // Navegación dentro de la app (sin recargar, que borraría el token en memoria).
    window.history.pushState({}, "", "/pacientes")
    window.dispatchEvent(new PopStateEvent("popstate"))
  })
  await expect(page.locator(".clinic-patients-table")).toBeVisible()
  await expect.poll(() => calls.some((call) => call === "200 /api/auth/refresh")).toBe(true)
  expect(calls).toContain("401 /api/patients")
  expect(calls.filter((call) => call.endsWith("/api/patients") && call.startsWith("200")).length).toBeGreaterThan(0)
})

test("recuperar contraseña responde igual exista o no el correo, y un enlace falso se rechaza", async ({ page }) => {
  await page.goto("/recuperar-contrasena")
  await page.locator("#recovery-email").fill("nadie@ejemplo.com")
  await page.getByRole("button", { name: "Enviar instrucciones", exact: true }).click()
  await expect(page.locator("#auth-result")).toContainText("Si el correo está registrado")

  await page.goto("/restablecer-contrasena?token=enlace-falso")
  await page.getByLabel("Contraseña nueva", { exact: true }).fill("una-clave-larga")
  await page.getByLabel("Repite la contraseña", { exact: true }).fill("una-clave-larga")
  await page.getByRole("button", { name: "Guardar contraseña", exact: true }).click()
  await expect(page.getByRole("alert").first()).toContainText("El enlace no es válido o ya expiró")
})

test("solicitar acceso envía la solicitud", async ({ page }) => {
  await page.goto("/solicitar-acceso")
  await page.getByLabel("Nombres", { exact: true }).fill("Persona")
  await page.getByLabel("Apellidos", { exact: true }).fill("De Prueba")
  await page.getByRole("textbox", { name: "Correo electrónico", exact: true }).fill("persona.prueba@ejemplo.com")
  await page.getByRole("button", { name: "Enviar solicitud", exact: true }).click()
  await expect(page.locator("#auth-result")).toContainText("Recibimos tu solicitud")
})
