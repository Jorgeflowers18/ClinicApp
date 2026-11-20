import { useRef } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { InventoryItemFormDialog } from "../components/inventory-item-form-dialog"
import { InventoryListPage } from "./inventory-list-page"
import { InventoryItemDetailPage } from "./inventory-item-detail-page"

export function InventoryItemFormPage() {
  const { id } = useParams<{ id: string }>(), navigate = useNavigate()
  const destination = useRef(id ? `/inventario/${id}` : "/inventario")
  return <>{id ? <InventoryItemDetailPage /> : <InventoryListPage />}<InventoryItemFormDialog open itemId={id} onSaved={item => { destination.current = `/inventario/${item.id}` }} onOpenChange={open => { if(!open) navigate(destination.current, { replace: true }) }} /></>
}
