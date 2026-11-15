import { env } from "@/shared/lib/env"
import type { UserProfile } from "../types/auth.types"

export const mockProfileKey = (userId: string) => `clinicapp.mock-profile.${encodeURIComponent(userId)}`

/** A profile record, never an access token. Only the existing demonstration mode uses browser storage. */
export function readSavedProfile(userId: string): UserProfile | null | undefined {
  if (!env.useMockApi) return undefined
  const raw = localStorage.getItem(mockProfileKey(userId))
  if (raw === null) return undefined
  let value: unknown
  try { value = JSON.parse(raw) } catch (cause) { throw new Error("No se pudo leer el perfil guardado. No se han modificado tus datos.", { cause }) }
  if (value === null) return null
  if (typeof value !== "object") throw new Error("No se pudo leer el perfil guardado. No se han modificado tus datos.")
  const profile = value as Record<string, unknown>
  if (!["fullName", "title", "specialty", "bio", "avatarColor"].every((key) => typeof profile[key] === "string")
    || !(profile.avatarImage === null || typeof profile.avatarImage === "string")) {
    throw new Error("No se pudo leer el perfil guardado. No se han modificado tus datos.")
  }
  return value as UserProfile
}

/** setItem replaces one authoritative record atomically; a quota/error leaves the previous record intact. */
export function persistProfile(userId: string, profile: UserProfile | null): void {
  if (!env.useMockApi) {
    throw new Error("El guardado del perfil no está disponible en esta conexión. Tus datos anteriores se conservan.")
  }
  try {
    // Never overwrite an unreadable existing record with a fresh default profile.
    readSavedProfile(userId)
    localStorage.setItem(mockProfileKey(userId), JSON.stringify(profile))
  } catch (cause) {
    throw new Error("No se pudo guardar el perfil en este navegador. Tus datos anteriores se conservan. Revisa el espacio y los permisos de almacenamiento.", { cause })
  }
}
