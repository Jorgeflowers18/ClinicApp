import { useMemo, useRef, useState } from "react"
import { useAuthStore } from "../store/auth-store"
import type { AuthUser, UserProfile } from "../types/auth.types"
import { useDemoContext,useSessionUser } from "@/modules/saas/state"
import { identityService } from "@/modules/saas/services"

const defaultProfile = (name: string): UserProfile => ({ fullName: name, title: "", specialty: "", bio: "", avatarColor: "#1f2937", avatarImage: null })
const fields = ["fullName", "title", "specialty", "bio"] as const

export function useProfileEditor() {
  const user = useSessionUser()
  const demo=useDemoContext(state=>state.userId)
  const initial = useMemo(() => user?.profile ?? defaultProfile(user?.name ?? ""), [user])
  const [profile, setProfile] = useState(initial)
  const [saving, setSaving] = useState<"fields" | "photo" | null>(null)
  const lock = useRef(false)
  const isInitialSetup = !user?.profile?.fullName?.trim()
  const dirty = fields.some((key) => profile[key] !== initial[key])

  async function commit(kind: "fields" | "photo", build: (current: AuthUser) => UserProfile) {
    if (lock.current) throw new Error("Espera a que termine la operación actual.")
    const current = demo ? user : useAuthStore.getState().user
    if (!current || current.id !== user?.id) throw new Error("La sesión cambió. Vuelve a ingresar para guardar.")
    lock.current = true
    setSaving(kind)
    try {
      const next = build(current)
      if(demo)await identityService.updateDemoProfile(next)
      else await useAuthStore.getState().updateUserProfile(next)
      // Keep unsaved text fields when committing a photo; never restore an obsolete draft image.
      setProfile((draft) => kind === "fields" ? next : { ...draft, avatarImage: next.avatarImage, avatarColor: next.avatarColor })
    } finally {
      lock.current = false
      setSaving(null)
    }
  }

  const saveFields = () => commit("fields", (current) => ({
    ...(current.profile ?? defaultProfile("")),
    fullName: profile.fullName.trim() || current.name,
    title: profile.title.trim(), specialty: profile.specialty.trim(), bio: profile.bio.trim(),
  }))

  const savePhoto = (avatarImage: string | null) => commit("photo", (current) => ({
    // A photo alone must not complete setup or save unsaved name/title/bio fields.
    ...(current.profile ?? defaultProfile("")), avatarImage,
  }))

  function cancelChanges() {
    if (lock.current) return
    const current = demo ? user : useAuthStore.getState().user
    setProfile(current?.profile ?? defaultProfile(current?.name ?? ""))
  }

  return { user, profile, isInitialSetup, dirty, saving, saveFields, savePhoto, cancelChanges,
    handleChange: (field: keyof UserProfile, value: string) => setProfile((current) => ({ ...current, [field]: value })),
  }
}
