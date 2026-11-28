import { Children, createContext, useContext, useId, useState, type CSSProperties, type ReactNode } from "react"
import { Link } from "react-router-dom"
import { Tabs as TabsPrimitive } from "@base-ui/react/tabs"
import { ChevronRight, type LucideIcon } from "lucide-react"

import { Card } from "@/components/ui/card"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { resolveSectionValue } from "@/shared/lib/section-selection"
import { cn } from "@/lib/utils"
import styles from "./section-navigation.module.css"

interface SectionCardPresentation {
  id?: string
  title: string
  description: string
  icon: LucideIcon
  selected?: boolean
  disabled?: boolean
  indicator?: ReactNode
  className?: string
}

export type SectionNavigationCardProps = SectionCardPresentation & (
  | { variant?: "link"; to: string }
  | { variant: "selection"; value: string; onSelect?: () => void }
)

/** One visual pattern; route links and in-page tabs keep their native semantics. */
export function SectionNavigationCard(props: SectionNavigationCardProps) {
  const { id, title, description, icon: Icon, selected, disabled, className } = props
  const descriptionId = useId()
  const indicator = props.indicator === undefined && props.variant !== "selection"
    ? <ChevronRight size={16} aria-hidden="true" /> : props.indicator
  const content = <>
    <Icon className={styles.icon} size={20} strokeWidth={2} aria-hidden="true" />
    <span className={styles.text}><span className={styles.title}>{title}</span><span id={descriptionId} className={styles.description}>{description}</span></span>
    {indicator && <span className={styles.indicator} aria-hidden="true">{indicator}</span>}
  </>
  const attributes = { id, className: styles.control, "aria-label": title, "aria-describedby": descriptionId, "data-indicator": Boolean(indicator) }

  return <Card size="sm" className={cn(styles.card, className)} data-slot="section-navigation-card" data-selected={selected || undefined} data-disabled={disabled || undefined}>
    {props.variant === "selection"
      ? <TabsPrimitive.Tab {...attributes} value={props.value} disabled={disabled} onClick={props.onSelect}>{content}</TabsPrimitive.Tab>
      : disabled
        ? <span {...attributes} role="link" aria-disabled="true">{content}</span>
        : <Link {...attributes} to={props.to} aria-current={selected ? "page" : undefined}>{content}</Link>}
  </Card>
}

interface SectionNavigationGridProps {
  label: string
  children: ReactNode
  variant?: "link" | "selection"
  className?: string
}

export function SectionNavigationGrid({ label, children, variant = "link", className }: SectionNavigationGridProps) {
  const count = Children.toArray(children).length
  const columns = count === 5 || count === 6 ? 3 : Math.max(1, Math.min(4, count))
  const style = {
    "--section-navigation-columns": columns,
    "--section-navigation-tablet-columns": Math.max(1, Math.min(2, count)),
  } as CSSProperties
  const attributes = { "aria-label": label, "data-slot": "section-navigation-grid", className: styles.grid }
  return <div className={cn(styles.layout, className)} style={style}>
    {variant === "selection"
      ? <TabsPrimitive.List {...attributes}>{children}</TabsPrimitive.List>
      : <nav {...attributes}>{children}</nav>}
  </div>
}

export interface SectionNavigationItem extends Omit<SectionCardPresentation, "selected" | "className"> {
  value: string
  permitted?: boolean
}

const ActiveSectionContext = createContext<{ selected: string; available: string[] }>({ selected: "", available: [] })

interface SectionNavigationTabsProps {
  label: string
  items: readonly SectionNavigationItem[]
  children: ReactNode
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  className?: string
}

/** Retains the existing Tabs panels and their keepMounted/data-loading behavior. */
export function SectionNavigationTabs({ label, items, children, value, defaultValue, onValueChange, className }: SectionNavigationTabsProps) {
  const [uncontrolled, setUncontrolled] = useState(defaultValue)
  const visible = items.filter(item => item.permitted !== false)
  const selected = resolveSectionValue(visible, value ?? uncontrolled, defaultValue)
  if (!selected) return <p role="status" className="text-sm text-muted-foreground">No hay secciones disponibles para tu perfil.</p>
  return <ActiveSectionContext.Provider value={{ selected, available: visible.map(item => item.value) }}><Tabs value={selected} className={cn("min-w-0", className)} onValueChange={next => {
    if (!visible.some(item => item.value === next && !item.disabled)) return
    if (value === undefined) setUncontrolled(next)
    onValueChange?.(next)
  }}>
    <SectionNavigationGrid label={label} variant="selection">
      {visible.map(item => <SectionNavigationCard key={item.value} {...item} variant="selection" selected={item.value === selected} />)}
    </SectionNavigationGrid>
    <div className="min-w-0">{children}</div>
  </Tabs></ActiveSectionContext.Provider>
}

/** Load on first selection, then retain filters and drafts while hidden. */
export function SectionNavigationPanel({ value, children, className }: { value: string; children: ReactNode; className?: string }) {
  const { selected, available } = useContext(ActiveSectionContext)
  const [visited, setVisited] = useState(false)
  if (selected === value && !visited) setVisited(true)
  if (!available.includes(value)) return null
  return <TabsContent value={value} keepMounted className={className}>{visited && children}</TabsContent>
}
