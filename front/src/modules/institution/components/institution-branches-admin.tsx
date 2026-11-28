import { useState } from "react"
import { useEditableInstitutionProfile, useSaveInstitutionProfile } from "../api/institution.queries"
import { InstitutionBranches } from "./institution-branches"
import { useStaffInstitution } from "@/modules/saas/lib/institution-scope"
import { useSaasData } from "@/modules/saas/state"
import { catalogService } from "@/modules/saas/catalog-services"
import { ConfirmDialog } from "@/shared/components/confirm-dialog"
import { getErrorMessage } from "@/shared/lib/error-message"
import type { InstitutionBranch } from "../types/institution.types"
export function InstitutionBranchesAdmin({ standalone = false }: { standalone?: boolean }) {
  const { profile, error } = useEditableInstitutionProfile(), save = useSaveInstitutionProfile(), { organizationId } = useStaffInstitution(), data = useSaasData()
  const states = data.branchStates?.[organizationId] ?? {}, [toggle, setToggle] = useState<InstitutionBranch | null>(null), [failure, setFailure] = useState(""), [busy, setBusy] = useState(false)
  if (!profile) return <p role={error ? "alert" : "status"}>{error ? getErrorMessage(error) : "Cargando sedes…"}</p>
  return <div className="saas-scope saas-stack"><InstitutionBranches standalone={standalone} branches={profile.branches} states={states} onToggle={branch => { setFailure(""); setToggle(branch) }} onCommit={async branches => { await save.mutateAsync({ ...profile, branches }) }} />
    {toggle && <ConfirmDialog open onOpenChange={open => !open && !busy && setToggle(null)} title={states[toggle.id] === false ? "Activar sede" : "Desactivar sede"} description={`«${toggle.name}». Se conservarán las asignaciones y citas existentes. El estado de disponibilidad se guarda en esta configuración frontend.${failure ? " " + failure : ""}`} confirmLabel={states[toggle.id] === false ? "Activar" : "Desactivar"} isLoading={busy} onConfirm={async () => {
      setBusy(true)
      try { await catalogService.setBranchActive(toggle.id, states[toggle.id] === false); setToggle(null) } catch (cause) { setFailure(getErrorMessage(cause)) } finally { setBusy(false) }
    }} />}
  </div>
}
