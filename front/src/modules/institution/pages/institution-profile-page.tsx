import { useRef, useState } from "react"
import { Building2, Camera, Clock3, MapPin, Save } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { FormActions } from "@/components/ui/form-actions"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { PageHeader } from "@/shared/components/page-header"
import { InstitutionLogo } from "@/shared/components/brand-logo"
import { InstitutionBranches } from "../components/institution-branches"
import { readInstitutionProfile, type InstitutionBranch, type InstitutionProfile, writeInstitutionProfile } from "../types/institution.types"
import styles from "./institution-profile-page.module.css"

const generalFields = [["name", "Nombre de la clínica"], ["legalName", "Razón social"], ["ruc", "RUC"], ["website", "Sitio web"]] as const
const contactFields = [["phone", "Teléfono"], ["email", "Correo electrónico"]] as const
type TextField = Exclude<keyof InstitutionProfile, "branches" | "logoImage">

export function InstitutionProfilePage() {
  const [profile, setProfile] = useState<InstitutionProfile>(readInstitutionProfile)
  const [savedProfile, setSavedProfile] = useState(profile)
  const savedRef = useRef(profile)
  const savingRef = useRef(false)
  const [saveError, setSaveError] = useState("")
  const dirty = (Object.keys(profile) as (keyof InstitutionProfile)[])
    .some((key) => key !== "branches" && profile[key] !== savedProfile[key])

  const handleFieldChange = (field: TextField, value: string) => {
    setProfile((current) => ({ ...current, [field]: value }))
    setSaveError("")
  }

  // A branch operation persists branches without saving unrelated form drafts.
  // Update confirmed state and the list only after the existing writer succeeds.
  const handleCommitBranches = (branches: InstitutionBranch[]) => {
    const next = { ...savedRef.current, branches }
    writeInstitutionProfile(next)
    savedRef.current = next
    setSavedProfile(next)
    setProfile((current) => ({ ...current, branches }))
  }

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : null
      setProfile((current) => ({ ...current, logoImage: result }))
      setSaveError("")
    }
    reader.readAsDataURL(file)
  }

  const handleSave = () => {
    if (savingRef.current) return
    savingRef.current = true
    try {
      const next = { ...profile, branches: savedRef.current.branches }
      writeInstitutionProfile(next)
      savedRef.current = next
      setSavedProfile(next)
      setProfile(next)
      setSaveError("")
      toast.success("Perfil de la institución actualizado")
    } catch {
      setSaveError("No se pudieron guardar los cambios en este navegador. Tus cambios siguen en el formulario. Inténtalo de nuevo.")
    } finally { savingRef.current = false }
  }

  const field = (key: TextField, label: string, type = "text") => (
    <div className={styles.field} key={key}>
      <label htmlFor={`institution-profile-${key}`}>{label}</label>
      <Input id={`institution-profile-${key}`} type={type} value={profile[key]}
        onChange={(event) => handleFieldChange(key, event.target.value)} />
    </div>
  )

  return (
    <div className={styles.page}>
      <PageHeader title="Perfil institucional" description="Administra la información de tu clínica o institución" />
      {saveError && <p role="alert" className={styles.error}>{saveError}</p>}
      <div className={styles.columns}>
        <div className={styles.details}>
          <Card className={styles.card}>
            <CardHeader><CardTitle role="heading" aria-level={2} className={styles.title}><Building2 />Información general</CardTitle></CardHeader>
            <CardContent className={styles.form}>
              <div className={styles.pair}>{generalFields.map(([key, label]) => field(key, label))}</div>
              <div className={styles.field}>
                <label htmlFor="institution-profile-notes">Descripción</label>
                <Textarea id="institution-profile-notes" rows={3} value={profile.notes}
                  onChange={(event) => handleFieldChange("notes", event.target.value)} />
              </div>
            </CardContent>
          </Card>
          <Card className={styles.card}>
            <CardHeader><CardTitle role="heading" aria-level={2} className={styles.title}><MapPin />Contacto y ubicación</CardTitle></CardHeader>
            <CardContent className={styles.form}>
              <div className={styles.pair}>{contactFields.map(([key, label]) => field(key, label, key === "email" ? "email" : "text"))}</div>
              {field("address", "Dirección principal")}
            </CardContent>
          </Card>
          <Card className={styles.card}>
            <CardHeader><CardTitle id="institution-hours-label" role="heading" aria-level={2} className={styles.title}><Clock3 />Horarios de atención</CardTitle></CardHeader>
            <CardContent>
              <Textarea rows={4} aria-labelledby="institution-hours-label" value={profile.hours}
                onChange={(event) => handleFieldChange("hours", event.target.value)} />
            </CardContent>
          </Card>
        </div>
        <Card className={`${styles.card} ${styles.identity}`}>
          <CardHeader><CardTitle role="heading" aria-level={2} className={styles.title}><Camera />Identidad visual</CardTitle></CardHeader>
          <CardContent className={styles.form}>
            <div className={styles.logoPreview}>
              <InstitutionLogo image={profile.logoImage} text={profile.logoText} className="size-20 text-2xl" imageClassName={styles.logoImage} />
              <div><p className={styles.previewTitle}>Logo de la clínica</p><p className={styles.hint}>Vista previa de la identidad institucional.</p></div>
            </div>
            <label className={`clinic-file-upload ${styles.upload}`}>
              <Camera aria-hidden="true" className="size-4" />Subir imagen
              <input type="file" accept="image/*" className="sr-only" onChange={handleImageUpload} />
            </label>
            {field("logoText", "Texto del logo")}
            <p className={styles.hint}>Se usa en la interfaz y documentos. Pulsa Guardar cambios para conservar la imagen y el texto.</p>
          </CardContent>
        </Card>
      </div>
      <InstitutionBranches branches={profile.branches} onCommit={handleCommitBranches} />
      <FormActions>
        {dirty && <span className={styles.pending}>Cambios sin guardar</span>}
        <Button onClick={handleSave}><Save className="size-4" />Guardar cambios</Button>
      </FormActions>
      <p className={styles.storageNote}>Los cambios se guardan en este navegador.</p>
    </div>
  )
}
