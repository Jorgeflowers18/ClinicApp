import { AdaptiveTabs } from "@/components/ui/adaptive-tabs"
import { TabsContent } from "@/components/ui/tabs"
import { PageHeader } from "@/shared/components/page-header"

import { CriticalStockTab } from "../components/critical-stock-tab"
import { InventoryItemsTab } from "../components/inventory-items-tab"
import { PurchaseOrdersTab } from "../components/purchase-orders-tab"
import { SterilizationTab } from "../components/sterilization-tab"
import { SuppliersTab } from "../components/suppliers-tab"

export function InventoryListPage() {
  return (
    <div className="space-y-4">
      <PageHeader
        title="Inventario"
        description="Controla el stock, las compras y la esterilización de insumos de la clínica."
      />

      <AdaptiveTabs
        defaultValue="insumos"
        items={[
          { value: "insumos", label: "Insumos", accessibleLabel: "Insumos" },
          { value: "compras", label: "Compras", accessibleLabel: "Compras" },
          { value: "proveedores", label: "Proveedores", accessibleLabel: "Proveedores" },
          { value: "esterilizacion", label: "Esterilización", accessibleLabel: "Esterilización" },
          { value: "stock-critico", label: "Stock crítico", accessibleLabel: "Stock crítico" },
        ]}
      >
        <TabsContent value="insumos" className="pt-4">
          <InventoryItemsTab />
        </TabsContent>
        <TabsContent value="compras" className="pt-4">
          <PurchaseOrdersTab />
        </TabsContent>
        <TabsContent value="proveedores" className="pt-4">
          <SuppliersTab />
        </TabsContent>
        <TabsContent value="esterilizacion" className="pt-4">
          <SterilizationTab />
        </TabsContent>
        <TabsContent value="stock-critico" className="pt-4">
          <CriticalStockTab />
        </TabsContent>
      </AdaptiveTabs>
    </div>
  )
}
