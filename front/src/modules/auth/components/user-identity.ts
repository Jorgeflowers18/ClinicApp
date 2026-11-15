import type { AuthUser } from "../types/auth.types"

export function userDisplayName(user: AuthUser | null): string {
  return (user?.profile ? user.profile.fullName : user?.name)?.trim() ?? ""
}
