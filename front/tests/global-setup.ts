import { request } from "@playwright/test"

import { accounts, apiUrl } from "./helpers/api"

/**
 * En una base nueva, las cuentas de prueba no tienen "Mi perfil" y el primer inicio de sesión lleva a
 * completarlo. Se completa una vez por la API, para que cada prueba entre directo a la app.
 */
export default async function globalSetup() {
  for (const account of Object.values(accounts)) {
    const anonymous = await request.newContext()
    const login = await anonymous.post(`${apiUrl}/auth/login`, { data: { email: account.email, password: account.password } })
    if (!login.ok()) throw new Error(`No se pudo iniciar sesión con ${account.email}: ${login.status()} ${await login.text()}`)
    const { accessToken, user } = await login.json()
    if (!user.profile) {
      const saved = await anonymous.put(`${apiUrl}/auth/me/profile`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        data: { fullName: account.name, title: "", specialty: "", bio: "", avatarColor: "#1f2937", avatarImage: null },
      })
      if (!saved.ok()) throw new Error(`No se pudo completar el perfil de ${account.email}: ${await saved.text()}`)
    }
    await anonymous.dispose()
  }
}
