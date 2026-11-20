import { useForm, FormProvider } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@/components/ui/button"
import { useCreateSupplier, useUpdateSupplier } from "../api/inventory.queries"
import { supplierSchema, type Supplier, type SupplierFormValues } from "../types/inventory.types"
import { useInventorySubmit } from "../hooks/use-inventory-submit"
import { InventoryDialog } from "./inventory-dialog"
import { InventoryField, InventoryFormError } from "./inventory-form-fields"

interface Props { returnFocus?: () => HTMLElement | null; open: boolean; onOpenChange: (open: boolean) => void; supplier?: Supplier | null }
export function SupplierFormDialog(props: Props) { return props.open ? <SupplierEditor key={props.supplier?.id ?? "new"} {...props} /> : null }
function SupplierEditor({ supplier, onOpenChange, returnFocus }: Props) {
  const create = useCreateSupplier(), update = useUpdateSupplier()
  const form = useForm<SupplierFormValues>({ resolver: zodResolver(supplierSchema), defaultValues: supplier ? { name: supplier.name, contactName: supplier.contactName ?? "", phone: supplier.phone ?? "", email: supplier.email ?? "", address: supplier.address ?? "", notes: supplier.notes ?? "" } : { name: "", contactName: "", phone: "", email: "", address: "", notes: "" } })
  const save = useInventorySubmit(form, values => supplier ? update.mutateAsync({ id: supplier.id, values }) : create.mutateAsync(values), supplier ? "Proveedor actualizado" : "Proveedor creado")
  const { isDirty, isSubmitting } = form.formState
  return <InventoryDialog returnFocus={returnFocus} size="supplier" title={supplier ? "Editar proveedor" : "Nuevo proveedor"} description="Los proveedores registrados aqu? pueden elegirse al crear una orden de compra." dirty={isDirty} pending={isSubmitting} onClose={() => onOpenChange(false)}>
    {({ close, cancel }) => <FormProvider {...form}><form className="inventory-editor" noValidate onSubmit={event => void form.handleSubmit(values => save(values, close))(event)}><InventoryFormError /><fieldset disabled={isSubmitting} className="inventory-form-group"><h3>Información general</h3><InventoryField name="name" label="Nombre" /><h3>Información de contacto</h3>
      <div className="inventory-form-grid"><InventoryField name="contactName" label="Persona de contacto" /><InventoryField name="phone" label="Teléfono" /><InventoryField name="email" label="Correo electrónico" type="email" /><InventoryField name="address" label="Dirección" /></div>
      <InventoryField name="notes" label="Notas / condiciones (opcional)" type="textarea" placeholder="Plazos de entrega, pedidos mínimos, condiciones de pago..." />
    </fieldset><div className="inventory-form-actions"><Button type="button" variant="outline" disabled={isSubmitting} onClick={cancel}>Cancelar</Button><Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Guardando..." : supplier ? "Guardar cambios" : "Crear proveedor"}</Button></div></form></FormProvider>}
  </InventoryDialog>
}
