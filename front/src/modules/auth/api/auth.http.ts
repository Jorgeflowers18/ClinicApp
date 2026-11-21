import type { components } from "@/shared/api/schema"
import { apiPost, apiPut } from "@/shared/lib/http"
import { ApiError } from "@/shared/types/common"

import type { AuthApi } from "./auth.contract"
import { fitAvatarImage } from "../lib/avatar-image"
import { roles, type AuthUser, type LoginResponse, type Role } from "../types/auth.types"

type AuthUserDto = components["schemas"]["AuthUserDto"]
type LoginResponseDto = components["schemas"]["LoginResponse"]

function toRole(role: string): Role {
  if ((roles as readonly string[]).includes(role)) return role as Role
  throw new ApiError("Tu cuenta tiene un rol que esta versión de la aplicación no reconoce.", 403)
}

export const toAuthUser = (dto: AuthUserDto): AuthUser => ({
  id: dto.id,
  name: dto.name,
  email: dto.email,
  role: toRole(dto.role),
  professionalId: dto.professionalId,
  profile: dto.profile && { ...dto.profile, avatarImage: dto.profile.avatarImage ?? null },
})

const toLoginResponse = (dto: LoginResponseDto): LoginResponse => ({
  accessToken: dto.accessToken,
  expiresIn: dto.expiresIn,
  user: toAuthUser(dto.user),
})

export const httpAuthApi: AuthApi = {
  async login(values) {
    return toLoginResponse(await apiPost<LoginResponseDto>("/auth/login", values))
  },
  async refresh() {
    try {
      return toLoginResponse(await apiPost<LoginResponseDto>("/auth/refresh"))
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) return null
      throw error
    }
  },
  async logout() {
    await apiPost("/auth/logout")
  },
  async updateProfile(profile) {
    const avatarImage = await fitAvatarImage(profile.avatarImage)
    return toAuthUser(await apiPut<AuthUserDto>("/auth/me/profile", { ...profile, avatarImage }))
  },
  async requestPasswordRecovery(email) {
    await apiPost("/auth/password-recovery", { email })
  },
  async resetPassword(token, password) {
    await apiPost("/auth/password-reset", { token, password })
  },
  async requestAccess(values) {
    await apiPost("/auth/access-requests", values)
  },
  // La cookie httpOnly restaura la sesión: nada se guarda en el navegador.
  sessionCache: {
    initial: () => undefined,
    started: (session) => session,
    cleared: () => {},
  },
}
