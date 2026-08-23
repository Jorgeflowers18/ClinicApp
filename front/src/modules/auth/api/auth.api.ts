import { http } from "@/shared/lib/http"
import { mockDelay } from "@/shared/lib/mock"
import { env } from "@/shared/lib/env"
import { ApiError } from "@/shared/types/common"

import type { AuthUser, LoginFormValues, LoginResponse } from "../types/auth.types"

const MOCK_ACCOUNTS: Array<{ password: string; user: AuthUser }> = [
  {
    password: "admin123",
    user: { id: "usr_1", name: "Ana Morales", email: "admin@clinica.com", role: "admin" },
  },
  {
    password: "recepcion123",
    user: { id: "usr_2", name: "Luis Fernández", email: "recepcion@clinica.com", role: "recepcion" },
  },
  {
    password: "medico123",
    user: { id: "usr_3", name: "Dra. Carla Ríos", email: "medico@clinica.com", role: "medico" },
  },
]

async function loginMock(values: LoginFormValues): Promise<LoginResponse> {
  await mockDelay(500)
  const account = MOCK_ACCOUNTS.find((entry) => entry.user.email === values.email)

  if (!account || account.password !== values.password) {
    throw new ApiError("Correo o contraseña incorrectos", 401)
  }

  return {
    accessToken: `mock-token.${account.user.id}.${Date.now()}`,
    expiresIn: 3600,
    user: account.user,
  }
}

async function loginReal(values: LoginFormValues): Promise<LoginResponse> {
  // TODO: conectar a endpoint real -> POST /auth/login (API .NET)
  const { data } = await http.post<LoginResponse>("/auth/login", values)
  return data
}

async function logoutReal(): Promise<void> {
  // TODO: conectar a endpoint real -> POST /auth/logout (API .NET)
  await http.post("/auth/logout")
}

export const authApi = {
  login: env.useMockApi ? loginMock : loginReal,
  logout: env.useMockApi ? async () => mockDelay(150) : logoutReal,
}
