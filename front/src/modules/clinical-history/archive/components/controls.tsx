import { useId, type ReactNode } from "react"
import { ChevronDown, type LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import styles from "../archive.module.css"

export function ArchiveSelect({ label, value, items, onChange, disabled = false }: { label: string; value: string; items: Record<string, string>; onChange: (value: string) => void; disabled?: boolean }) {
  const id = useId()
  return <div className={styles.field}>
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
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {Object.entries(items).map(([value, label]) => <SelectItem value={value} key={value}>
          {label}
        </SelectItem>)}
      </SelectContent>
    </Select>
  </div>
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
export function ArchiveSection({ title, open, onToggle, children, status }: { title: string; open: boolean; onToggle: () => void; children: ReactNode; status?: string }) {
  const id = useId()
  return <section className={styles.accordion}>
    <button
      type="button"
      className={styles.accordionTrigger}
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
      inert={!open}
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
