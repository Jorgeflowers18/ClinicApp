import { useCallback, useEffect, useId, useRef } from "react"
import { Accordion } from "@base-ui/react/accordion"
import { Building2, ChevronDown, HeartPulse, LayoutDashboard, LockKeyhole, Settings2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { FieldError } from "@/components/ui/field"
import { Switch } from "@/components/ui/switch"
import { useModalAccordion } from "@/shared/hooks/use-modal-accordion"
import { navItems, navigationSections } from "@/app/nav-config"
import { editableRoleModuleIds, enabledModuleCount, groupRoleModules, protectedRoleModuleIds, updateRoleModuleSelection } from "../lib/role-module-groups"
import styles from "./administrative-ui.module.css"

const groupIcons = { clinical: HeartPulse, operations: LayoutDashboard, configuration: Settings2 }
const groups = groupRoleModules(navigationSections)

export function RoleModuleSelector({ value, onChange, protectedRole = false, disabled = false, invalid = false, assignableIds, moduleErrors = {}, errorMessage, validationAttempt = 0, revealInvalid = true }: {
  value: string[]; onChange: (value: string[]) => void; protectedRole?: boolean; disabled?: boolean; invalid?: boolean; assignableIds?: readonly string[]
  moduleErrors?: Readonly<Record<string, string>>; errorMessage?: string; validationAttempt?: number; revealInvalid?: boolean
}) {
  const id = useId()
  const root = useRef<HTMLFieldSetElement>(null)
  const accordion = useModalAccordion(root, "clinical")
  const firstInvalidModule = groups.flatMap(group => group.modules).find(module => moduleErrors[module.id])?.id
  const hasError = invalid || Boolean(firstInvalidModule)
  const firstError = firstInvalidModule ? moduleErrors[firstInvalidModule] : errorMessage
  const request = accordion.request
  const revealError = useCallback(() => {
    if (!hasError) return
    const group = groups.find(group => group.modules.some(module => module.id === firstInvalidModule)) ?? groups[0]
    const selector = firstInvalidModule ? `[data-role-module="${CSS.escape(firstInvalidModule)}"]:not(:disabled):not([aria-disabled="true"])` : '[role="switch"]:not(:disabled):not([aria-disabled="true"])'
    request(group.id, revealInvalid ? selector : undefined)
  }, [hasError, firstInvalidModule, revealInvalid, request])
  useEffect(() => { revealError() }, [revealError, firstError, validationAttempt])
  const total = enabledModuleCount(navigationSections, value)
  const editable = editableRoleModuleIds(navigationSections, { protectedRole, assignableIds })
  const canEnable = !disabled && editable.some(module => !value.includes(module))
  const canClear = !disabled && editable.some(module => value.includes(module))
  const change = (targets: readonly string[], enabled: boolean) => {
    if (!disabled) onChange(updateRoleModuleSelection(value, targets.filter(module => editable.includes(module)), enabled))
  }
  // The form validator can focus this group after the reveal; finish on the erroneous switch.
  return <fieldset ref={root} className={styles.permissions} data-validation-field="sections" tabIndex={-1} aria-invalid={hasError} aria-describedby={errorMessage ? "catalog-sections-error" : undefined}
    onFocus={event => { if (event.target === event.currentTarget && revealInvalid) revealError() }}>
    <legend className="sr-only">Acceso a módulos</legend>
    <div className={styles.permissionsTitle}>
      <div className={styles.permissionsSummary}><span>Acceso a módulos</span><span aria-live="polite">{total} de {navigationSections.length} módulos habilitados</span></div>
      <div className={styles.bulkActions} role="group" aria-label="Selección general de módulos">
        <Button type="button" variant="secondary" size="sm" disabled={!canEnable} onClick={() => change(editable, true)}>Habilitar todos</Button>
        <Button type="button" variant="secondary" size="sm" disabled={!canClear} onClick={() => change(editable, false)}>Quitar todos</Button>
      </div>
    </div>
    <Accordion.Root multiple={false} keepMounted value={accordion.open ? [accordion.open] : []} onValueChange={accordion.onValueChange} className={styles.permissionGroups}>
    {groups.map(group => {
      const GroupIcon = groupIcons[group.id]
      const editableGroup = editable.filter(module => group.modules.some(item => item.id === module))
      const allEnabled = editableGroup.length > 0 && editableGroup.every(module => value.includes(module))
      const action = allEnabled ? "Quitar grupo" : "Habilitar grupo"
      const count = enabledModuleCount(group.modules, value)
      return <Accordion.Item key={group.id} value={group.id} data-modal-section={group.id} className={styles.permissionGroup}>
        <Accordion.Header className={styles.groupHeading}>
          <Accordion.Trigger data-modal-section-trigger className={styles.groupTrigger} aria-labelledby={id + group.id} aria-describedby={id + group.id + "-count"}>
            <GroupIcon size={17} aria-hidden="true" /><span id={id + group.id} className={styles.groupLabel}>{group.label}</span>
            <span id={id + group.id + "-count"} className={styles.groupCounter} aria-live="polite" aria-label={`${count} de ${group.modules.length} módulos habilitados`}>{count}/{group.modules.length}</span>
            <ChevronDown size={16} className={styles.groupChevron} aria-hidden="true" />
          </Accordion.Trigger>
        </Accordion.Header>
        <Accordion.Panel keepMounted role="region" aria-labelledby={id + group.id} data-validation-panel className={styles.groupPanel}
          render={(props, state) => <div {...props} inert={!state.open} aria-hidden={!state.open || undefined} />}>
        <div className={styles.groupContent}>
        <div className={styles.groupActions}><Button type="button" variant="ghost" size="xs" className={styles.groupAction} aria-label={`${action} ${group.label}`} disabled={disabled || !editableGroup.length} onClick={() => change(editableGroup, !allEnabled)}>{action}</Button></div>
        <div className={styles.moduleRows}>{group.modules.map(module => {
          const nav = navItems.find(item => (item.module ?? (item.to === "/historial-clinico" ? "Historia clínica" : item.label)) === module.id)
          const Icon = nav?.icon ?? Building2
          const protectedModule = protectedRole && protectedRoleModuleIds.includes(module.id)
          const locked = protectedModule || Boolean(assignableIds && !assignableIds.includes(module.id))
          const lockReason = protectedModule ? "Acceso obligatorio del rol protegido." : "Este módulo no está disponible dentro de tu autorización actual."
          const controlId = id + "-" + encodeURIComponent(module.id)
          const error = moduleErrors[module.id]
          const describedBy = [locked ? controlId + "-restriction" : "", error ? controlId + "-error" : ""].filter(Boolean).join(" ") || undefined
          return <div key={module.id} className={styles.moduleEntry}><div className={styles.moduleRow}>
            <label htmlFor={controlId}><Icon size={17} aria-hidden="true" /><span>{module.label}</span></label>
            <span className={styles.moduleControl}>
              {locked && <span title={lockReason} className={styles.moduleLock}><LockKeyhole size={14} aria-hidden="true" /><span id={controlId + "-restriction"} className="sr-only">{lockReason}</span></span>}
              <Switch id={controlId} data-role-module={module.id} aria-label={module.label} aria-invalid={Boolean(error)} aria-describedby={describedBy} disabled={disabled || locked} checked={value.includes(module.id)}
                onCheckedChange={checked => change([module.id], checked)} />
            </span>
          </div>{error && <FieldError id={controlId + "-error"}>{error}</FieldError>}</div>
        })}</div>
        </div></Accordion.Panel>
      </Accordion.Item>
    })}
    </Accordion.Root>
  </fieldset>
}
