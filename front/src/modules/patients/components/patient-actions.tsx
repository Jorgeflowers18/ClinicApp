import { createContext, useContext, useId, useMemo, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from "react"
import { useNavigate } from "react-router-dom"
import { CalendarPlus, ClipboardList, MoreHorizontal, Pencil, UserRound, UserRoundCheck, UserRoundX } from "lucide-react"
import { toast } from "sonner"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { ConfirmDialog } from "@/shared/components/confirm-dialog"
import { getErrorMessage } from "@/shared/lib/error-message"
import { useAuthStore } from "@/modules/auth/store/auth-store"
import { useUpdatePatient } from "../api/patients.queries"
import { toPatientFormValues, type Patient } from "../types/patient.types"

const PatientMenuContext = createContext<{ active: string | null; setActive: Dispatch<SetStateAction<string | null>> } | null>(null)

export function PatientActionsProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<string | null>(null)
  const value = useMemo(() => ({ active, setActive }), [active])
  return <PatientMenuContext value={value}>{children}</PatientMenuContext>
}

export function PatientActions({ patient, onSchedule, onEdit }: { patient: Patient; onSchedule: () => void; onEdit?: (trigger: HTMLButtonElement | null) => void }) {
  const navigate = useNavigate()
  const canSeeClinical = useAuthStore(state => state.user?.role === "admin" || state.user?.role === "medico")
  const [confirm, setConfirm] = useState(false)
  const sharedMenu = useContext(PatientMenuContext)
  const [localMenu, setLocalMenu] = useState<string | null>(null)
  const menuId = useId()
  const trigger = useRef<HTMLButtonElement>(null)
  const activeMenu = sharedMenu?.active ?? localMenu
  const setActiveMenu = sharedMenu?.setActive ?? setLocalMenu
  const update = useUpdatePatient(patient.id)
  const inactive = patient.treatmentStatus === "inactivo"
  const name = `${patient.firstName} ${patient.lastName}`
  async function changeStatus() {
    try {
      await update.mutateAsync({ ...toPatientFormValues(patient), treatmentStatus: inactive ? "activo" : "inactivo" })
      toast.success(inactive ? "Paciente reactivado" : "Paciente desactivado")
      setConfirm(false)
    } catch (error) { toast.error(getErrorMessage(error)) }
  }
  return <div className="patient-actions" onClick={event => event.stopPropagation()}>
    <DropdownMenu modal={false} open={activeMenu === menuId} onOpenChange={open => setActiveMenu(current => open ? menuId : current === menuId ? null : current)}>
      <DropdownMenuTrigger ref={trigger} className="patient-actions-trigger" aria-label={`Acciones del paciente ${name}`} onClick={event => event.stopPropagation()}><MoreHorizontal aria-hidden="true" className="size-5" /></DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="patient-action-menu" aria-label={`Acciones de ${name}`} onClick={event => event.stopPropagation()}>
        <DropdownMenuItem onClick={() => navigate(`/pacientes/${patient.id}`)}><UserRound /><span>Ver perfil</span></DropdownMenuItem>
        <DropdownMenuItem onClick={() => onEdit ? onEdit(trigger.current) : navigate(`/pacientes/${patient.id}/editar`)}><Pencil /><span>Editar paciente</span></DropdownMenuItem>
        <DropdownMenuItem onClick={onSchedule}><CalendarPlus /><span>Agendar cita</span></DropdownMenuItem>
        {canSeeClinical && <DropdownMenuItem onClick={() => navigate(`/historial-clinico/paciente/${patient.id}`)}><ClipboardList /><span>Consultar historia clínica</span></DropdownMenuItem>}
        <DropdownMenuSeparator />
        <DropdownMenuItem variant={inactive ? "default" : "destructive"} onClick={() => setConfirm(true)}>{inactive ? <UserRoundCheck /> : <UserRoundX />}<span>{inactive ? "Reactivar paciente" : "Desactivar paciente"}</span></DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    <ConfirmDialog open={confirm} onOpenChange={setConfirm} title={inactive ? "Reactivar paciente" : "Desactivar paciente"}
      description={inactive ? `¿Deseas reactivar a ${name}? Su estado será Activo.` : `¿Deseas desactivar a ${name}? Se conservarán sus citas, tratamientos, pagos e historia clínica.`}
      confirmLabel={inactive ? "Reactivar" : "Desactivar"} destructive={!inactive} isLoading={update.isPending} onConfirm={changeStatus} />
  </div>
}
