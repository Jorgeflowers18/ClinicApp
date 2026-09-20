import { useState } from "react"
import { Building2, Camera, Clock3, MapPin, Save } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { PageHeader } from "@/shared/components/page-header"

import { readInstitutionProfile, type InstitutionProfile, writeInstitutionProfile } from "../types/institution.types"

export function InstitutionProfilePage() {
  const [profile, setProfile] = useState<InstitutionProfile>(readInstitutionProfile())

  const handleFieldChange = (field: keyof InstitutionProfile, value: string) => {
    setProfile((current) => ({
      ...current,
      [field]: value,
    }))
  }

  const handleBranchChange = (branchId: string, field: string, value: string) => {
    setProfile((current) => ({
      ...current,
      branches: current.branches.map((branch) =>
        branch.id === branchId ? { ...branch, [field]: value } : branch
      ),
    }))
  }

  const handleBranchCreate = () => {
    setProfile((current) => ({
      ...current,
      branches: [
        ...current.branches,
        {
          id: `branch-${Date.now()}`,
          name: "Nueva sede",
          address: "",
          phone: "",
          hours: "",
          isMain: current.branches.length === 0,
        },
      ],
    }))
  }

  const handleBranchDelete = (branchId: string) => {
    setProfile((current) => ({
      ...current,
      branches: current.branches.filter((branch) => branch.id !== branchId),
    }))
  }

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : null
      setProfile((current) => ({ ...current, logoImage: result }))
    }
    reader.readAsDataURL(file)
  }

  const handleSave = () => {
    writeInstitutionProfile(profile)
    toast.success("Perfil de la institución actualizado")
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Perfil de la institución"
        description="Configura los datos generales, la información de contacto y los horarios de atención de la clínica."
        actions={
          <Button onClick={handleSave}>
            <Save className="size-4" />
            Guardar cambios
          </Button>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="size-4" />
                Información general
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nombre de la clínica</label>
                  <Input
                    value={profile.name}
                    onChange={(event) => handleFieldChange("name", event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Razón social</label>
                  <Input
                    value={profile.legalName}
                    onChange={(event) => handleFieldChange("legalName", event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">RUC</label>
                  <Input
                    value={profile.ruc}
                    onChange={(event) => handleFieldChange("ruc", event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Sitio web</label>
                  <Input
                    value={profile.website}
                    onChange={(event) => handleFieldChange("website", event.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Descripción</label>
                <Textarea
                  rows={3}
                  value={profile.notes}
                  onChange={(event) => handleFieldChange("notes", event.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="size-4" />
                Contacto y ubicación
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Teléfono</label>
                  <Input
                    value={profile.phone}
                    onChange={(event) => handleFieldChange("phone", event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Correo electrónico</label>
                  <Input
                    type="email"
                    value={profile.email}
                    onChange={(event) => handleFieldChange("email", event.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Dirección principal</label>
                <Input
                  value={profile.address}
                  onChange={(event) => handleFieldChange("address", event.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock3 className="size-4" />
                Horarios de atención
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                rows={4}
                value={profile.hours}
                onChange={(event) => handleFieldChange("hours", event.target.value)}
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Camera className="size-4" />
                Identidad visual
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4 rounded-lg border bg-muted/30 p-3">
                {profile.logoImage ? (
                  <img src={profile.logoImage} alt="Logo de la clínica" className="size-12 rounded-lg object-cover" />
                ) : (
                  <div className="flex size-12 items-center justify-center rounded-lg bg-primary text-lg font-semibold text-primary-foreground">
                    {profile.logoText || "CA"}
                  </div>
                )}
                <div className="flex-1">
                  <p className="font-medium">Logo de la clínica</p>
                  <p className="text-xs text-muted-foreground">Se usa en la interfaz y documentos.</p>
                </div>
                <label className="inline-flex cursor-pointer items-center rounded-md border bg-background px-3 py-2 text-sm font-medium hover:bg-muted">
                  Subir imagen
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                </label>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Texto del logo</label>
                <Input
                  value={profile.logoText}
                  onChange={(event) => handleFieldChange("logoText", event.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle>Sedes</CardTitle>
              <Button type="button" variant="outline" onClick={handleBranchCreate}>
                Crear sede
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {profile.branches.length === 0 ? (
                <div className="rounded-lg border border-dashed bg-muted/20 p-6 text-center">
                  <p className="mb-2 font-medium">Aún no hay sedes registradas</p>
                  <p className="mb-4 text-sm text-muted-foreground">
                    Crea la primera sede para comenzar a gestionar ubicaciones, horarios y contacto.
                  </p>
                  <Button type="button" onClick={handleBranchCreate}>Crear sede</Button>
                </div>
              ) : (
                profile.branches.map((branch) => (
                  <div key={branch.id} className="rounded-lg border bg-muted/20 p-3">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <p className="font-medium">{branch.name || "Nueva sede"}</p>
                      <div className="flex items-center gap-2">
                        {branch.isMain && <Badge variant="secondary">Principal</Badge>}
                        <Button type="button" variant="ghost" size="sm" onClick={() => handleBranchDelete(branch.id)}>
                          Eliminar
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <Input
                        value={branch.name}
                        onChange={(event) => handleBranchChange(branch.id, "name", event.target.value)}
                      />
                      <Input
                        value={branch.address}
                        onChange={(event) => handleBranchChange(branch.id, "address", event.target.value)}
                      />
                      <Input
                        value={branch.phone}
                        onChange={(event) => handleBranchChange(branch.id, "phone", event.target.value)}
                      />
                      <Input
                        value={branch.hours}
                        onChange={(event) => handleBranchChange(branch.id, "hours", event.target.value)}
                      />
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
