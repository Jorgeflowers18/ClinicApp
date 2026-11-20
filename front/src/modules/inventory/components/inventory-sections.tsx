import type { ReactNode } from "react"
import { Accordion } from "@base-ui/react/accordion"
import { ChevronDown, CircleAlert } from "lucide-react"
import type { useInventoryAccordion } from "../hooks/use-inventory-accordion"

export function InventorySections({ controller, groups }: { controller: ReturnType<typeof useInventoryAccordion>; groups: { id: string; title: string; invalid?: boolean; summary?: string; content: ReactNode }[] }) {
  return <Accordion.Root value={controller.open ? [controller.open] : []} multiple={false} keepMounted className="inventory-sections" onValueChange={controller.onValueChange}>
    {groups.map(group => <Accordion.Item key={group.id} value={group.id} className="inventory-section" data-inventory-section={group.id}>
      <Accordion.Header><Accordion.Trigger className="inventory-section-trigger"><span>{group.title}</span><small data-invalid={group.invalid || undefined}>{group.invalid ? <><CircleAlert aria-hidden="true" />Revisar</> : group.summary}</small><ChevronDown aria-hidden="true" /></Accordion.Trigger></Accordion.Header>
      <Accordion.Panel keepMounted className="inventory-section-panel" render={(props, state) => <div {...props} inert={!state.open} aria-hidden={!state.open || undefined} />}><div className="inventory-section-content">{group.content}</div></Accordion.Panel>
    </Accordion.Item>)}
  </Accordion.Root>
}
