import { createContext, useContext, useId, useMemo, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from "react"
import { useNavigate } from "react-router-dom"
import { Archive, CalendarPlus, ClipboardList, MoreHorizontal, Pencil, UserRound, UserRoundCheck, UserRoundX } from "lucide-react"
import { toast } from "sonner"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { ConfirmDialog } from "@/shared/components/confirm-dialog"
import { getErrorMessage } from "@/shared/lib/error-message"
import { useAuthStore } from "@/modules/auth/store/auth-store"
import { useDeletePatient, useUpdatePatient } from "../api/patients.queries"
import { toPatientFormValues, type Patient } from "../types/patient.types"

const PatientMenuContext = createContext<{ active: string | null; setActive: Dispatch<SetStateAction<string | null>> } | null>(null)

export function PatientActionsProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<string | null>(null)
  const value = useMemo(() => ({ active, setActive }), [active])
  return <PatientMenuContext value={value}>{children}</PatientMenuContext>
}

/** `allowRemoval`: "Dar de baja" solo en la ficha; en la lista, un menú más alto taparía la fila siguiente. */
export function PatientActions({ patient, onSchedule, onEdit, allowRemoval = false }: { patient: Patient; onSchedule: () => void; onEdit?: (trigger: HTMLButtonElement | null) => void; allowRemoval?: boolean }) {
  const navigate = useNavigate()
  const canSeeClinical = useAuthStore(state => state.user?.role === "admin" || state.user?.role === "medico")
  // La baja la pueden dar admin y recepción (el médico recibe 403).
  const canRemove = useAuthStore(state => state.user?.role === "admin" || state.user?.role === "recepcion") && allowRemoval
  const [confirm, setConfirm] = useState(false)
  const [confirmRemoval, setConfirmRemoval] = useState(false)
  const sharedMenu = useContext(PatientMenuContext)
  const [localMenu, setLocalMenu] = useState<string | null>(null)
  const menuId = useId()
  const trigger = useRef<HTMLButtonElement>(null)
  const activeMenu = sharedMenu?.active ?? localMenu
  const setActiveMenu = sharedMenu?.setActive ?? setLocalMenu
  const update = useUpdatePatient(patient.id)
  const remove = useDeletePatient()
  const inactive = patient.treatmentStatus === "inactivo"
  const name = `${patient.firstName} ${patient.lastName}`
  async function changeStatus() {
    try {
      await update.mutateAsync({ ...toPatientFormValues(patient), treatmentStatus: inactive ? "activo" : "inactivo" })
      toast.success(inactive ? "Paciente reactivado" : "Paciente desactivado")
      setConfirm(false)
    } catch (error) { toast.error(getErrorMessage(error)) }
  }
  async function removePatient() {
    try {
      await remove.mutateAsync(patient.id)
      toast.success("Paciente dado de baja")
      setConfirmRemoval(false)
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
        {canRemove && <DropdownMenuItem variant="destructive" onClick={() => setConfirmRemoval(true)}><Archive /><span>Dar de baja</span></DropdownMenuItem>}
      </DropdownMenuContent>
    </DropdownMenu>
    <ConfirmDialog open={confirm} onOpenChange={setConfirm} title={inactive ? "Reactivar paciente" : "Desactivar paciente"}
      description={inactive ? `¿Deseas reactivar a ${name}? Su estado será Activo.` : `¿Deseas desactivar a ${name}? Se conservarán sus citas, tratamientos, pagos e historia clínica.`}
      confirmLabel={inactive ? "Reactivar" : "Desactivar"} destructive={!inactive} isLoading={update.isPending} onConfirm={changeStatus} />
    <ConfirmDialog open={confirmRemoval} onOpenChange={setConfirmRemoval} title="Dar de baja al paciente"
      description={`¿Deseas dar de baja a ${name}? Saldrá de la lista de pacientes y se conservarán sus citas, tratamientos, pagos e historia clínica. Un administrador puede reactivarlo.`}
      confirmLabel="Dar de baja" destructive isLoading={remove.isPending} onConfirm={removePatient} />
  </div>
}
