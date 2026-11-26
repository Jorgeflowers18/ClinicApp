import { useId, type ReactNode } from "react"
import { ChevronDown, type LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Field,FieldError } from "@/components/ui/field"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import styles from "../archive.module.css"

export function ArchiveSelect({ label, value, items, onChange, disabled = false,error,validationField }: { label: string; value: string; items: Record<string, string>; onChange: (value: string) => void; disabled?: boolean;error?:string;validationField?:string }) {
  const id = useId()
  return <Field className={styles.field} data-invalid={Boolean(error)}>
    <label htmlFor={id}>
      {label}
    </label>
    <Select
      value={value}
      items={items}
      disabled={disabled}
      onValueChange={value => value && onChange(value)}
    >
      <SelectTrigger
        id={id}
        className="w-full"
        title={items[value]}
        aria-invalid={Boolean(error)}
        data-validation-field={validationField}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {Object.entries(items).map(([value, label]) => <SelectItem value={value} key={value}>
          {label}
        </SelectItem>)}
      </SelectContent>
    </Select>
    <FieldError>{error}</FieldError>
  </Field>
}
export function IconAction({ label, icon: Icon, onClick, disabled, pressed }: { label: string; icon: LucideIcon; onClick: () => void; disabled?: boolean; pressed?: boolean }) {
  return <Tooltip>
    <TooltipTrigger render={<Button
      type="button"
      size="icon-sm"
      variant={pressed ? "secondary" : "ghost"}
      aria-label={label}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
    >
      <Icon aria-hidden="true" />
    </Button>} />
    <TooltipContent>
      {label}
    </TooltipContent>
  </Tooltip>
}
export function ArchiveSection({ title, value, open, onToggle, children, status }: { title: string; value: string; open: boolean; onToggle: () => void; children: ReactNode; status?: string }) {
  const id = useId()
  return <section className={styles.accordion} data-modal-section={value}>
    <button
      type="button"
      className={styles.accordionTrigger}
      data-modal-section-trigger
      aria-expanded={open}
      aria-controls={id}
      onClick={onToggle}
    >
      <strong>
        {title}
      </strong>
      <span>
        {status}
      </span>
      <ChevronDown aria-hidden="true" style={{ transform: open ? "rotate(180deg)" : undefined }} />
    </button>
    <div
      className={styles.accordionMotion}
      data-open={open}
      data-validation-panel
      inert={!open}
      aria-hidden={!open || undefined}
      id={id}
    >
      <div>
        <div className={styles.accordionBody}>
          {children}
        </div>
      </div>
    </div>
  </section>
}
