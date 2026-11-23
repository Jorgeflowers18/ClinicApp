import { useRef, useState, type FormEvent } from "react"
import { Building2, Camera, Clock3, FileText, Info, LoaderCircle, MapPin, Save } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { PageHeader } from "@/shared/components/page-header"
import { getErrorMessage } from "@/shared/lib/error-message"
import { ApiError } from "@/shared/types/common"
import { readConfirmedInstitutionProfile, useEditableInstitutionProfile, useSaveInstitutionProfile } from "../api/institution.queries"
import { InstitutionBranches } from "../components/institution-branches"
import { InstitutionLogoControls } from "../components/institution-logo-controls"
import type { InstitutionBranch, InstitutionProfile } from "../types/institution.types"
import styles from "./institution-profile-page.module.css"

type TextField = Exclude<keyof InstitutionProfile, "branches" | "logoImage" | "logoText" | "updatedAt">
type FieldErrors = Partial<Record<TextField, string>>
const textFields: readonly string[] = ["name", "subtitle", "legalName", "ruc", "phone", "email", "address", "website", "notes", "hours"]


/** Los errores del `400` del servidor que son de un campo del formulario; el resto (sedes, logo) va al mensaje general. */
function serverFieldErrors(error: unknown): FieldErrors {
  if (!(error instanceof ApiError)) return {}
  return Object.fromEntries((error.fieldErrors ?? []).filter(({ field }) => textFields.includes(field)).map(({ field, message }) => [field, message]))
}

export function InstitutionProfilePage() {
  const { profile, error } = useEditableInstitutionProfile()
  if (profile) return <InstitutionProfileForm initial={profile} />
  return <div className={styles.page}>
    <PageHeader title="Perfil institucional" description="Administra la información y la identidad de tu institución." />
    {error
      ? <p role="alert" className={styles.error}>{getErrorMessage(error)}</p>
      : <div role="status" aria-label="Cargando el perfil institucional" className={styles.columns}><Skeleton className="h-96 w-full" /><Skeleton className="h-96 w-full" /></div>}
  </div>
}

function InstitutionProfileForm({ initial }: { initial: InstitutionProfile }) {
  const save = useSaveInstitutionProfile()
  const [profile, setProfile] = useState<InstitutionProfile>(initial)
  const [savedProfile, setSavedProfile] = useState(profile)
  const savedRef = useRef(profile)
  const savingRef = useRef(false)
  const [saving, setSaving] = useState(false)
  const [previewVersion, setPreviewVersion] = useState(0)
  const [saveError, setSaveError] = useState("")
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [readingImage, setReadingImage] = useState(false)
  const [saved, setSaved] = useState(false)
  const dirty = (Object.keys(profile) as (keyof InstitutionProfile)[]).some((key) => key !== "branches" && key !== "updatedAt" && profile[key] !== savedProfile[key])

  const handleFieldChange = (key: TextField, value: string) => {
    setProfile((current) => ({ ...current, [key]: value }))
    setFieldErrors((current) => ({ ...current, [key]: undefined }))
    setSaveError(""); setSaved(false)
  }

  // Sede operations persist only confirmed institutional fields, preserving the main draft.
  // El PUT reemplaza todo el perfil: se envía el último confirmado con las sedes nuevas.
  const handleCommitBranches = async (branches: InstitutionBranch[]) => {
    const next = await save.mutateAsync({ ...savedRef.current, branches })
    savedRef.current = next
    setSavedProfile(next)
    // La lista vuelve del servidor, con los ids de las sedes nuevas.
    setProfile((current) => ({ ...current, branches: next.branches }))
  }

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (savingRef.current || readingImage) return
    const email = event.currentTarget.elements.namedItem("email") as HTMLInputElement
    const form = event.currentTarget
    const errors: FieldErrors = {}
    if (!profile.name.trim()) errors.name = "Introduce el nombre de la clínica o institución."
    if (email.validity.typeMismatch) errors.email = "Introduce un correo electrónico válido."
    setFieldErrors(errors)
    const focusFirst = (found: FieldErrors) => {
      const first = textFields.find((key) => found[key as TextField])
      form.querySelector<HTMLElement>('[name="' + first + '"]')?.focus()
    }
    if (Object.keys(errors).length) {
      focusFirst(errors)
      return
    }
    savingRef.current = true
    setSaving(true)
    try {
      const next = await save.mutateAsync({ ...profile, branches: savedRef.current.branches })
      savedRef.current = next
      setSavedProfile(next)
      setProfile(next)
      setSaveError(""); setSaved(true)
      toast.success("Perfil de la institución actualizado")
    } catch (error) {
      const fields = serverFieldErrors(error)
      setFieldErrors(fields)
      if (Object.keys(fields).length) focusFirst(fields)
      setSaveError(getErrorMessage(error))
    } finally { savingRef.current = false; setSaving(false) }
  }

  const handleCancel = () => {
    const confirmed = readConfirmedInstitutionProfile() ?? savedRef.current
    savedRef.current = confirmed
    setProfile(confirmed); setSavedProfile(confirmed)
    setFieldErrors({}); setSaveError(""); setSaved(false)
    setPreviewVersion((value) => value + 1)
  }

  const field = (key: TextField, label: string, placeholder: string, type = "text") => {
    const error = fieldErrors[key as keyof FieldErrors]
    return <div className={styles.field} key={key}>
      <div className={styles.fieldLabel}>
        <label htmlFor={"institution-profile-" + key} data-required={key === "name"}>{label}</label>
        {key === "subtitle" && <InstitutionSubtitleHelp />}
      </div>
      <Input id={"institution-profile-" + key} name={key} type={type} value={profile[key]} placeholder={placeholder} required={key === "name"}
        aria-invalid={!!error} aria-describedby={error ? "institution-error-" + key : undefined}
        onChange={(event) => handleFieldChange(key, event.target.value)} />
      {error && <p id={"institution-error-" + key} className={styles.fieldError} role="alert">{error}</p>}
    </div>
  }

  return <div className={styles.page}>
    <PageHeader title="Perfil institucional" description="Administra la información y la identidad de tu institución." />
    <form id="institution-profile-form" className={styles.columns} noValidate onSubmit={handleSave}>
      <div className={styles.details}>
        <Card className={styles.card}>
          <CardHeader><CardTitle role="heading" aria-level={2} className={styles.title}><Building2 aria-hidden="true" />Información general</CardTitle></CardHeader>
          <CardContent className={styles.form}>
            <div className={styles.pair}>
              {field("name", "Nombre de la clínica o institución", "Nombre comercial de la institución")}
              {field("subtitle", "Subtítulo institucional", "Ej. Laboratorio odontológico")}
            </div>
            <div className={styles.pair}>
              {field("legalName", "Razón social", "Razón social de la institución")}
              {field("ruc", "RUC", "Número de identificación tributaria")}
            </div>
            {field("website", "Sitio web", "https://tuinstitucion.com")}
            <div className={styles.field}>
              <label htmlFor="institution-profile-notes">Descripción</label>
              <Textarea id="institution-profile-notes" name="notes" rows={3} value={profile.notes} placeholder="Describe los servicios y el enfoque de tu institución."
                onChange={(event) => handleFieldChange("notes", event.target.value)} />
            </div>
          </CardContent>
        </Card>
        <Card className={styles.card}>
          <CardHeader><CardTitle role="heading" aria-level={2} className={styles.title}><MapPin aria-hidden="true" />Contacto y ubicación</CardTitle></CardHeader>
          <CardContent className={styles.form}>
            <div className={styles.pair}>
              {field("phone", "Teléfono", "+593 98 123 4567", "tel")}
              {field("email", "Correo electrónico", "contacto@tuclinica.com", "email")}
            </div>
            {field("address", "Dirección principal", "Calle, número y ciudad")}
          </CardContent>
        </Card>
        <Card className={styles.card}>
          <CardHeader><CardTitle id="institution-hours-label" role="heading" aria-level={2} className={styles.title}><Clock3 aria-hidden="true" />Horarios de atención</CardTitle></CardHeader>
          <CardContent className={styles.form}>
            <Textarea rows={3} aria-labelledby="institution-hours-label" aria-describedby="institution-hours-hint" value={profile.hours}
              placeholder={"Lunes a viernes: 08:00 - 18:00\nSábados: 08:00 - 13:00"}
              onChange={(event) => handleFieldChange("hours", event.target.value)} />
            <p id="institution-hours-hint" className={styles.hint}>Organiza los días y horarios en líneas separadas.</p>
          </CardContent>
        </Card>
      </div>
      <div className={styles.details}>
        <Card className={styles.card}>
          <CardHeader><CardTitle role="heading" aria-level={2} className={styles.title}><Camera aria-hidden="true" />Identidad visual</CardTitle></CardHeader>
          <CardContent className={styles.form}>
            <InstitutionLogoControls key={previewVersion} name={profile.name} subtitle={profile.subtitle} image={profile.logoImage} savedImage={savedProfile.logoImage} onReadingChange={setReadingImage} onChange={(logoImage) => {
              setProfile((current) => ({ ...current, logoImage })); setSaveError(""); setSaved(false)
            }} />
          </CardContent>
        </Card>
        <Card className={styles.card}>
          <CardHeader><CardTitle role="heading" aria-level={2} className={styles.title}><FileText aria-hidden="true" />Resumen institucional</CardTitle></CardHeader>
          <CardContent>
            <p className={styles.summaryHint}>Vista previa de los datos del formulario.</p>
            <dl className={styles.summary}>
              <div><dt>Nombre comercial</dt><dd>{profile.name || "Sin nombre"}</dd></div>
              <div><dt>Razón social</dt><dd>{profile.legalName || "Sin registrar"}</dd></div>
              <div><dt>Contacto principal</dt><dd>{profile.phone || "Sin teléfono"}<span>{profile.email || "Sin correo"}</span></dd></div>
              <div><dt>Sitio web</dt><dd>{profile.website || "Sin registrar"}</dd></div>
            </dl>
          </CardContent>
        </Card>
      </div>
    </form>
    <InstitutionBranches branches={profile.branches} onCommit={handleCommitBranches} />
    {saveError && <p role="alert" className={styles.error}>{saveError}</p>}
    <div className={styles.actions}>
      <div>
        {dirty ? <p className={styles.pending} role="status">Cambios sin guardar</p> : saved && <p className={styles.hint} role="status">Cambios guardados</p>}
      </div>
      <div className={styles.buttons}>
        <Button type="button" variant="outline" disabled={!dirty || readingImage || saving} onClick={handleCancel}>Cancelar</Button>
        <Button type="submit" form="institution-profile-form" disabled={readingImage || saving} aria-busy={saving}>
          {saving ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Save aria-hidden="true" />}Guardar cambios
        </Button>
      </div>
    </div>
  </div>
}

function InstitutionSubtitleHelp() {
  const [open, setOpen] = useState(false)
  return <Tooltip open={open} onOpenChange={setOpen}>
    <TooltipTrigger closeOnClick={false} onClick={() => setOpen(true)} render={
      <Button type="button" variant="ghost" size="icon" className={styles.helpTrigger} aria-label="Información del subtítulo institucional" aria-expanded={open} />
    }><Info aria-hidden="true" /></TooltipTrigger>
    <TooltipContent side="top" className={styles.helpPopup}>Este texto aparecerá debajo del nombre institucional en el menú lateral</TooltipContent>
  </Tooltip>
}
