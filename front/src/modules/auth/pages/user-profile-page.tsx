import { useRef,useState } from "react"
import { ArrowRight, BriefcaseBusiness, Info, MoonStar, Save, SunMedium, UserRound } from "lucide-react"
import { useTheme } from "next-themes"
import { useLocation, useNavigate } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { FormActions } from "@/components/ui/form-actions"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { BrandLogo } from "@/shared/components/brand-logo"
import { PageHeader } from "@/shared/components/page-header"
import { toast } from "sonner"
import { getErrorMessage } from "@/shared/lib/error-message"
import { ProfilePhotoControls } from "../components/profile-photo-controls"
import { useProfileEditor } from "../components/use-profile-editor"
import { AccountIdentityFields } from "@/modules/saas/components/account-identity-fields"
import { accountIdentitySchema, existingAccountIdentitySchema } from "@/modules/saas/lib/identity"
import { identityService } from "@/modules/saas/services"
import { assertUsernameAvailable } from "@/modules/saas/adapters/demo-repository"
import { focusValidationError } from "@/shared/lib/validation-focus"
import { useDemoContext } from "@/modules/saas/state"
import "@/modules/saas/saas.css"

import styles from "./user-profile-page.module.css"

export function UserProfilePage() {
  const { user, profile, isInitialSetup, dirty, saving, saveFields, savePhoto, cancelChanges, handleChange } = useProfileEditor()
  const navigate = useNavigate()
  const location = useLocation()
  const { resolvedTheme, setTheme } = useTheme()
  const [saveError, setSaveError] = useState<string | null>(null)
  const [identity,setIdentity]=useState(()=>user?identityService.initial(user):{id:"",firstName:"",lastName:"",username:"",email:"",phone:""})
  const [identityErrors,setIdentityErrors]=useState<Record<string,string>>({}),root=useRef<HTMLDivElement>(null),demo=useDemoContext(state=>state.userId)

  if (!user) {
    return null
  }

  const handleSubmit = async () => {
    setSaveError(null)
    const parsed=(isInitialSetup ? accountIdentitySchema : existingAccountIdentitySchema).safeParse(identity)
    if(!parsed.success){setIdentityErrors(Object.fromEntries(parsed.error.issues.map(issue=>[issue.path[0],issue.message])));focusValidationError(root.current);return}
    try {
      if (parsed.data.username) assertUsernameAvailable(parsed.data.username,user.id)
      await saveFields()
      await identityService.save({ id: user.id, ...parsed.data })
      toast.success(demo?"Perfil de demostración guardado":"Perfil guardado; identificador guardado localmente")
      const redirectTo = demo ? user.role==="admin"?"/personal-accesos":"/citas" : (location.state as { from?: string } | null)?.from ?? "/"
      navigate(redirectTo, { replace: true })
    } catch (error) { setSaveError(getErrorMessage(error)) }
  }

  const displayName = profile.fullName.trim()

  return (
    <div ref={root} className={cn(styles.shell, isInitialSetup && styles.setupShell)}>
      <div className={cn("clinic-app-canvas", styles.root, isInitialSetup && styles.standalone)}>
        {isInitialSetup ? (
          <>
            <div className={styles.brandHeader}>
              <BrandLogo className="size-11" />
              <span>ClinicApp Odontología</span>
              <Button
                variant="outline"
                size="icon"
                className={styles.themeButton}
                aria-label={resolvedTheme === "dark" ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
                onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
              >
                {resolvedTheme === "dark" ? <SunMedium aria-hidden="true" /> : <MoonStar aria-hidden="true" />}
              </Button>
            </div>
            <div className={styles.intro}>
              <p className={styles.eyebrow}>Configuración inicial</p>
              <h1>Completa tu perfil</h1>
              <p>Personaliza la información que verán el resto del equipo dentro de la clínica.</p>
            </div>
          </>
        ) : (
          <PageHeader title="Mi perfil" description="Administra tu información personal y profesional" />
        )}

        <div className={styles.columns} data-profile-columns>
          <Card className={styles.identityCard} role="region" aria-label="Identidad del usuario">
            <CardContent className={styles.identityContent}>
              <ProfilePhotoControls name={displayName} image={user.profile?.avatarImage ?? null} disabled={saving !== null} avatarClassName={styles.avatar} onCommit={savePhoto}>
              <div className={styles.identityText}>
                <h2>{displayName || "Sin nombre"}</h2>
                <p className={styles.role}>
                  <BriefcaseBusiness aria-hidden="true" />
                  <span>{profile.title || "Sin cargo asignado"}</span>
                </p>
                {dirty && !isInitialSetup && <p className={styles.draftNote}>Vista previa · cambios sin guardar</p>}
              </div>
              </ProfilePhotoControls>
              <div className={styles.identityHint} id="user-profile-photo-hint">
                <Info aria-hidden="true" />
                <p>Tu fotografía o iniciales identificarán tu cuenta en la aplicación.</p>
              </div>
            </CardContent>
          </Card>

          <Card className={styles.formCard} role="region" aria-labelledby="user-profile-information">
            <CardHeader>
              <CardTitle id="user-profile-information" role="heading" aria-level={2}>
                <UserRound aria-hidden="true" />
                Información del perfil
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={styles.fields}>
                <AccountIdentityFields value={identity} initial={isInitialSetup} errors={identityErrors} onChange={next=>{setIdentity(next);handleChange("fullName",`${next.firstName} ${next.lastName}`.trim());setIdentityErrors(current=>Object.fromEntries(Object.entries(current).filter(([key])=>next[key as keyof typeof next]===identity[key as keyof typeof identity])))}}/>

                <div className={styles.fieldPair}>
                  <div className={styles.field}>
                    <label htmlFor="user-profile-title">Cargo</label>
                    <Input
                      id="user-profile-title"
                      value={profile.title}
                      onChange={(event) => handleChange("title", event.target.value)}
                      placeholder="Ej. Administradora general"
                    />
                  </div>
                  <div className={styles.field}>
                    <label htmlFor="user-profile-specialty">Especialidad</label>
                    <Input
                      id="user-profile-specialty"
                      value={profile.specialty}
                      readOnly
                      placeholder="Ej. Odontología, recepción, administración"
                    />
                  </div>
                </div>

                <div className={styles.field}>
                  <label htmlFor="user-profile-bio">Biografía breve</label>
                  <Textarea
                    id="user-profile-bio"
                    rows={4}
                    value={profile.bio}
                    onChange={(event) => handleChange("bio", event.target.value)}
                    placeholder="Describe tu función dentro del equipo clínico..."
                    aria-describedby="user-profile-bio-count"
                  />
                  <p className={styles.counter} id="user-profile-bio-count">{profile.bio.length} caracteres</p>
                </div>

                {saveError && <p role="alert" className="text-sm text-destructive">{saveError}</p>}
                <FormActions>
                  <Button variant="outline" disabled={saving !== null} onClick={() => { cancelChanges(); setIdentity(identityService.initial(user));setIdentityErrors({});setSaveError(null) }}>Cancelar</Button>
                  <Button onClick={handleSubmit} disabled={saving !== null} className={styles.submit}>
                    {saving === "fields" ? "Guardando…" : isInitialSetup ? "Continuar" : "Guardar cambios"}
                    {isInitialSetup ? <ArrowRight className="size-4" /> : <Save className="size-4" />}
                  </Button>
                </FormActions>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className={styles.notice}>
          <Info aria-hidden="true" />
          <div><p>Tu perfil quedará asociado a tu cuenta y se mostrará en la interfaz.</p><p className={styles.persistenceNote}>{demo?"Recorrido de demostración: los cambios se guardan en este navegador.":"El perfil se guarda en tu cuenta; el nombre de usuario y teléfono permanecen en el adaptador local hasta su integración."}</p></div>
        </div>
      </div>
    </div>
  )
}
