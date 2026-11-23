import type { components } from "@/shared/api/schema"
import { apiGet, apiPost, apiPut } from "@/shared/lib/http"

import type { UsersApi } from "./users.contract"
import type { ManagedUser, UserFormValues } from "../types/user-admin.types"

type UserDto = components["schemas"]["UserDto"]
type UserCreatedDto = components["schemas"]["UserCreatedDto"]
type UserUpdateRequest = components["schemas"]["UserUpdateRequest"]
type PasswordLinkDto = components["schemas"]["PasswordLinkDto"]

const toUser = (dto: UserDto): ManagedUser => ({ ...dto, role: dto.role as ManagedUser["role"] })

const toRequest = (values: UserFormValues): UserUpdateRequest => ({
  name: values.name.trim(),
  email: values.email.trim(),
  role: values.role,
  professionalId: values.professionalId || null,
  active: values.active,
})

export const httpUsersApi: UsersApi = {
  async list(signal) {
    return (await apiGet<UserDto[]>("/users", { signal })).map(toUser)
  },
  async create(values) {
    // Una cuenta nueva siempre empieza activa: `active` no se envía.
    const { active: _active, ...body } = toRequest(values)
    const dto = await apiPost<UserCreatedDto>("/users", body)
    return { user: toUser(dto.user), passwordLink: dto.passwordLink }
  },
  async update(id, values) {
    return toUser(await apiPut<UserDto>(`/users/${id}`, toRequest(values)))
  },
  async createPasswordLink(id) {
    return apiPost<PasswordLinkDto>(`/users/${id}/password-link`)
  },
}
