import { Package, ShoppingCart, Truck, ShieldCheck, TriangleAlert } from "lucide-react"
import { SectionNavigationTabs } from "@/shared/components/section-navigation"
import { useSectionQueryState } from "@/shared/hooks/use-section-query-state"
import { TabsContent } from "@/components/ui/tabs"
import { PageHeader } from "@/shared/components/page-header"
import { CriticalStockTab } from "../components/critical-stock-tab"
import { InventoryItemsTab } from "../components/inventory-items-tab"
import { PurchaseOrdersTab } from "../components/purchase-orders-tab"
import { SterilizationTab } from "../components/sterilization-tab"
import { SuppliersTab } from "../components/suppliers-tab"
import "../inventory.css"

const sections = [
  { value: "insumos", title: "Insumos", description: "Existencias y movimientos", icon: Package },
  { value: "compras", title: "Compras", description: "Órdenes y recepción de insumos", icon: ShoppingCart },
  { value: "proveedores", title: "Proveedores", description: "Contactos y datos comerciales", icon: Truck },
  { value: "esterilizacion", title: "Esterilización", description: "Ciclos e instrumental", icon: ShieldCheck },
  { value: "stock-critico", title: "Stock crítico", description: "Existencias bajo el mínimo", icon: TriangleAlert },
]

export function InventoryListPage() {
  const [tab, setTab] = useSectionQueryState(sections, "insumos")
  return <div className="inventory-module space-y-4"><PageHeader title="Inventario" description="Controla el stock, las compras y la esterilización de insumos de la clínica." />
    <SectionNavigationTabs label="Secciones de Inventario" value={tab} onValueChange={setTab} items={sections}>
      <TabsContent keepMounted value="insumos" className="pt-3"><InventoryItemsTab onCritical={() => setTab("stock-critico")} /></TabsContent>
      <TabsContent keepMounted value="compras" className="pt-3"><PurchaseOrdersTab /></TabsContent>
      <TabsContent keepMounted value="proveedores" className="pt-3"><SuppliersTab /></TabsContent>
      <TabsContent keepMounted value="esterilizacion" className="pt-3"><SterilizationTab /></TabsContent>
      <TabsContent keepMounted value="stock-critico" className="pt-3"><CriticalStockTab /></TabsContent>
    </SectionNavigationTabs>
  </div>
}
