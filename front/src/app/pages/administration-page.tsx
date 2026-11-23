import { useState } from "react"
import { DoorOpen, Stethoscope } from "lucide-react"

import { AdaptiveTabs } from "@/components/ui/adaptive-tabs"
import { TabsContent } from "@/components/ui/tabs"
import { PageHeader } from "@/shared/components/page-header"
import { ProfessionalsAdmin, RoomsAdmin } from "@/modules/appointments/components/agenda-catalogs-admin"

/** Administración (solo admin): los catálogos que usan la agenda y la historia clínica. */
export function AdministrationPage() {
  const [tab, setTab] = useState("profesionales")
  return <div className="space-y-4">
    <PageHeader title="Administración" description="Gestiona los profesionales y consultorios de la clínica." />
    <AdaptiveTabs value={tab} onValueChange={setTab} variant="line" items={[
      { value: "profesionales", label: <><Stethoscope aria-hidden="true" />Profesionales</>, accessibleLabel: "Profesionales" },
      { value: "consultorios", label: <><DoorOpen aria-hidden="true" />Consultorios</>, accessibleLabel: "Consultorios" },
    ]}>
      <TabsContent value="profesionales" className="pt-3"><ProfessionalsAdmin /></TabsContent>
      <TabsContent value="consultorios" className="pt-3"><RoomsAdmin /></TabsContent>
    </AdaptiveTabs>
  </div>
}
