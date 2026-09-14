import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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

      <Tabs defaultValue="insumos">
        <TabsList>
          <TabsTrigger value="insumos">Insumos</TabsTrigger>
          <TabsTrigger value="compras">Compras</TabsTrigger>
          <TabsTrigger value="proveedores">Proveedores</TabsTrigger>
          <TabsTrigger value="esterilizacion">Esterilización</TabsTrigger>
          <TabsTrigger value="stock-critico">Stock crítico</TabsTrigger>
        </TabsList>

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
      </Tabs>
    </div>
  )
}
