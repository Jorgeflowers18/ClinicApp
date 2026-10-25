import { useMemo, useState } from "react"
import { ArrowRight, CheckCircle2, MoonStar, Save, SunMedium, UserRound } from "lucide-react"
import { useTheme } from "next-themes"
import { useLocation, useNavigate } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { useAuthStore } from "@/modules/auth/store/auth-store"
import type { UserProfile } from "@/modules/auth/types/auth.types"
import { BrandLogo } from "@/shared/components/brand-logo"
import { PageHeader } from "@/shared/components/page-header"

const defaultProfile = (name: string): UserProfile => ({
  fullName: name,
  title: "",
  specialty: "",
  bio: "",
  avatarColor: "#1f2937",
  avatarImage: null,
})

export function UserProfilePage() {
  const user = useAuthStore((state) => state.user)
  const updateUserProfile = useAuthStore((state) => state.updateUserProfile)
  const navigate = useNavigate()
  const location = useLocation()
  const { resolvedTheme, setTheme } = useTheme()
  const isInitialSetup = !user?.profile || !user.profile.fullName?.trim()

  const initialProfile = useMemo(
    () => user?.profile ?? defaultProfile(user?.name ?? "Usuario"),
    [user]
  )

  const [profile, setProfile] = useState<UserProfile>(initialProfile)

  if (!user) {
    return null
  }

  const avatarColors = ["#111827", "#0f766e", "#7c3aed", "#2563eb", "#b45309"]

  const handleChange = (field: keyof UserProfile, value: string) => {
    setProfile((current) => ({ ...current, [field]: value }))
  }

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : null
      setProfile((current) => ({ ...current, avatarImage: result }))
    }
    reader.readAsDataURL(file)
  }

  const handleSubmit = () => {
    const sanitizedProfile: UserProfile = {
      ...profile,
      fullName: profile.fullName.trim() || user.name,
      title: profile.title.trim(),
      specialty: profile.specialty.trim(),
      bio: profile.bio.trim(),
    }

    updateUserProfile(sanitizedProfile)

    const redirectTo = (location.state as { from?: string } | null)?.from ?? "/"
    navigate(redirectTo, { replace: true })
  }

  return (
    <div className={cn("mx-auto min-w-0 space-y-6", isInitialSetup ? "clinic-app-canvas clinic-standalone-profile" : "w-full max-w-3xl")}>
      {isInitialSetup ? (
        <>
          <div className="flex items-center gap-3">
            <BrandLogo className="size-11" />
            <span className="min-w-0 flex-1 text-sm font-medium">ClinicApp Odontología</span>
            <Button
              variant="outline"
              size="icon"
              aria-label={resolvedTheme === "dark" ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
              onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            >
              {resolvedTheme === "dark" ? <SunMedium aria-hidden="true" /> : <MoonStar aria-hidden="true" />}
            </Button>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
              Configuración inicial
            </p>
            <h1 className="text-2xl font-[590] tracking-tight">Completa tu perfil</h1>
            <p className="text-sm text-muted-foreground">
              Personaliza la información que verán el resto del equipo dentro de la clínica.
            </p>
          </div>
        </>
      ) : (
        <PageHeader title="Mi perfil" description="Administra tu información personal y profesional" />
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserRound className="size-4" />
            Perfil del usuario
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex min-w-0 flex-wrap items-center gap-4 rounded-lg border bg-muted/30 p-4">
            <div className="relative">
              {profile.avatarImage ? (
                <img
                  src={profile.avatarImage}
                  alt="Avatar del usuario"
                  className="size-12 rounded-full object-cover"
                />
              ) : (
                <div
                  className="flex size-12 items-center justify-center rounded-full text-sm font-semibold text-white"
                  style={{ backgroundColor: profile.avatarColor }}
                >
                  {profile.fullName
                    .split(" ")
                    .map((part) => part[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase() || "U"}
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1 break-words">
              <p className="font-medium">{profile.fullName || user.name}</p>
              <p className="text-sm text-muted-foreground">
                {profile.title || "Sin cargo asignado"}
              </p>
            </div>
            <label className="clinic-file-upload inline-flex min-h-11 cursor-pointer items-center rounded-md border bg-background px-3 py-2 text-sm font-medium hover:bg-muted">
              Subir foto
              <input type="file" accept="image/*" className="sr-only" onChange={handleImageUpload} />
            </label>
          </div>

          <div className="space-y-2">
            <label htmlFor="user-profile-fullName" className="text-sm font-medium">Nombre completo</label>
            <Input
              id="user-profile-fullName"
              value={profile.fullName}
              onChange={(event) => handleChange("fullName", event.target.value)}
              placeholder="Ej. Ana Morales"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="user-profile-title" className="text-sm font-medium">Cargo</label>
              <Input
                id="user-profile-title"
                value={profile.title}
                onChange={(event) => handleChange("title", event.target.value)}
                placeholder="Ej. Administradora general"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="user-profile-specialty" className="text-sm font-medium">Especialidad</label>
              <Input
                id="user-profile-specialty"
                value={profile.specialty}
                onChange={(event) => handleChange("specialty", event.target.value)}
                placeholder="Ej. Odontología, recepción, administración"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="user-profile-bio" className="text-sm font-medium">Biografía breve</label>
            <Textarea
              id="user-profile-bio"
              rows={4}
              value={profile.bio}
              onChange={(event) => handleChange("bio", event.target.value)}
              placeholder="Describe tu función dentro del equipo clínico..."
            />
          </div>

          <div className="space-y-2">
            <p id="user-profile-colors" className="text-sm font-medium">Color de perfil</p>
            <div role="group" aria-labelledby="user-profile-colors" className="flex flex-wrap gap-2">
              {avatarColors.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => handleChange("avatarColor", color)}
                  className={cn(
                    "size-11 rounded-full border-2 transition-all focus-visible:outline-2 focus-visible:outline-ring lg:size-8",
                    profile.avatarColor === color ? "scale-110 border-foreground" : "border-transparent"
                  )}
                  style={{ backgroundColor: color }}
                  aria-label={`Seleccionar color ${color}`}
                />
              ))}
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSubmit} className="gap-2">
              {isInitialSetup ? "Continuar" : "Guardar cambios"}
              {isInitialSetup ? <ArrowRight className="size-4" /> : <Save className="size-4" />}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-2 rounded-lg border clinic-profile-notice px-3 py-2 text-sm">
        <CheckCircle2 className="size-4" />
        Tu perfil quedará asociado a tu cuenta y se mostrará en la interfaz.
      </div>
    </div>
  )
}
