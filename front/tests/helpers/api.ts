import { expect, request, type APIRequestContext, type APIResponse, type Page } from "@playwright/test"

/** La API que levanta `scripts/run-api-e2e.mjs`, contra la base `clinicapp_e2e`. */
export const apiUrl = process.env.E2E_API_URL ?? "http://127.0.0.1:5100/api"

/** Las cuentas que crea el back en desarrollo (`UserSeeder`). */
export const accounts = {
  admin: { email: "admin@clinica.com", password: "admin123", name: "Ana Morales" },
  recepcion: { email: "recepcion@clinica.com", password: "recepcion123", name: "Luis Fernández" },
  medico: { email: "medico@clinica.com", password: "medico123", name: "Dra. Carla Ríos" },
} as const
export type Role = keyof typeof accounts

const contexts = new Map<Role, APIRequestContext>()

/**
 * Un cliente de la API con la sesión del rol. Se reutiliza entre pruebas del mismo proceso: el login de la
 * API admite 20 intentos por minuto.
 */
export async function apiAs(role: Role): Promise<APIRequestContext> {
  const cached = contexts.get(role)
  if (cached) return cached
  const anonymous = await request.newContext()
  const login = await anonymous.post(`${apiUrl}/auth/login`, { data: { email: accounts[role].email, password: accounts[role].password } })
  const { accessToken } = await ok(login)
  await anonymous.dispose()
  const context = await request.newContext({ baseURL: `${apiUrl}/`, extraHTTPHeaders: { Authorization: `Bearer ${accessToken}` } })
  contexts.set(role, context)
  return context
}

/** El cuerpo JSON de una respuesta correcta; si no lo es, la prueba falla con el cuerpo del error. */
export async function ok<T = any>(response: APIResponse): Promise<T> {
  expect(response.ok(), `${response.status()} ${response.url()}: ${await response.text()}`).toBeTruthy()
  return response.status() === 204 ? (undefined as T) : response.json()
}

/** Un sufijo distinto en cada prueba, para que los datos no choquen entre sí. */
export const unique = () => `${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`

/** Una cédula ecuatoriana válida (provincia 17, dígito verificador calculado). */
export function cedula(): string {
  const body = ("170" + String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0")).split("").map(Number)
  const sum = body.reduce((acc, digit, index) => { let value = index % 2 === 0 ? digit * 2 : digit; if (value > 9) value -= 9; return acc + value }, 0)
  return body.join("") + ((10 - (sum % 10)) % 10)
}

export const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Guayaquil" })
export const inDays = (days: number) => new Date(Date.now() + days * 86_400_000).toLocaleDateString("en-CA", { timeZone: "America/Guayaquil" })

export async function createPatient(api: APIRequestContext, firstName: string, lastName = "Prueba E2E") {
  return ok(await api.post("patients", {
    data: { firstName, lastName, documentId: cedula(), documentType: "cedula", birthDate: "1988-04-12", gender: "femenino", phone: "", email: "", notificationsEnabled: true, treatmentStatus: "activo" },
  }))
}

export async function activeProfessional(api: APIRequestContext) {
  const list: Array<{ id: string; name: string; active: boolean }> = await ok(await api.get("professionals"))
  return list.find((item) => item.active)!
}

export async function activeRoom(api: APIRequestContext) {
  const list: Array<{ id: string; name: string; active: boolean }> = await ok(await api.get("rooms"))
  return list.find((item) => item.active)!
}

/** Inicia sesión desde la pantalla y espera a salir del login. */
export async function login(page: Page, role: Role) {
  await page.goto("/login")
  await page.locator("#email").fill(accounts[role].email)
  await page.locator("#password").fill(accounts[role].password)
  await page.getByRole("button", { name: "Ingresar", exact: true }).click()
  await expect(page).not.toHaveURL(/\/login/)
  await expect(page.locator(".clinic-app-header")).toBeVisible()
}
