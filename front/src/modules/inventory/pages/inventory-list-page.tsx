import { useState } from "react"
import { Package, ShoppingCart, Truck, ShieldCheck, TriangleAlert } from "lucide-react"
import { AdaptiveTabs } from "@/components/ui/adaptive-tabs"
import { TabsContent } from "@/components/ui/tabs"
import { PageHeader } from "@/shared/components/page-header"
import { CriticalStockTab } from "../components/critical-stock-tab"
import { InventoryItemsTab } from "../components/inventory-items-tab"
import { PurchaseOrdersTab } from "../components/purchase-orders-tab"
import { SterilizationTab } from "../components/sterilization-tab"
import { SuppliersTab } from "../components/suppliers-tab"
import "../inventory.css"

export function InventoryListPage() {
  const [tab, setTab] = useState("insumos")
  return <div className="inventory-module space-y-4"><PageHeader title="Inventario" description="Controla el stock, las compras y la esterilización de insumos de la clínica." />
    <AdaptiveTabs value={tab} onValueChange={setTab} variant="line" items={[
      { value: "insumos", label: <><Package aria-hidden="true" />Insumos</>, accessibleLabel: "Insumos" },
      { value: "compras", label: <><ShoppingCart aria-hidden="true" />Compras</>, accessibleLabel: "Compras" },
      { value: "proveedores", label: <><Truck aria-hidden="true" />Proveedores</>, accessibleLabel: "Proveedores" },
      { value: "esterilizacion", label: <><ShieldCheck aria-hidden="true" />Esterilización</>, accessibleLabel: "Esterilización" },
      { value: "stock-critico", label: <><TriangleAlert aria-hidden="true" />Stock crítico</>, accessibleLabel: "Stock crítico" },
    ]}>
      <TabsContent keepMounted value="insumos" className="pt-3"><InventoryItemsTab onCritical={() => setTab("stock-critico")} /></TabsContent>
      <TabsContent keepMounted value="compras" className="pt-3"><PurchaseOrdersTab /></TabsContent>
      <TabsContent keepMounted value="proveedores" className="pt-3"><SuppliersTab /></TabsContent>
      <TabsContent keepMounted value="esterilizacion" className="pt-3"><SterilizationTab /></TabsContent>
      <TabsContent keepMounted value="stock-critico" className="pt-3"><CriticalStockTab /></TabsContent>
    </AdaptiveTabs>
  </div>
}
