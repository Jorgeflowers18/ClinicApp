import { setAccessTheme } from "./helpers/access-theme"
import { expect, test, type Page } from "@playwright/test"
import { settleCalendarLayout } from "./helpers/calendar-layout"

test.use({ reducedMotion: "reduce", timezoneId: "America/Guayaquil" })
test.describe.configure({ mode: "parallel" })
const modal = (page: Page) => page.locator('.inventory-dialog[role="dialog"]')
const panel = (page: Page) => page.getByRole('tabpanel')
async function login(page: Page, theme: string) {
  await page.clock.install({ time: new Date('2026-11-19T17:00:00Z') })
  await page.goto('/login')
  await setAccessTheme(page, theme === 'light' ? "light" : "dark")
  await page.locator('#email').fill('admin@clinica.com'); await page.locator('#password').fill('admin123')
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click()
  await page.getByRole('button', { name: 'Continuar', exact: true }).click()
  await expect(page).toHaveURL(/\/$/)
}
async function inventory(page: Page) {
  await page.getByRole('link', { name: 'Inventario', exact: true }).click()
  await expect(panel(page).getByText('Alcohol antiséptico 70% (litro)', { exact: true }).filter({ visible: true })).toBeVisible()
}
async function tab(page: Page, name: string) {
  const target = page.getByRole('tab', { name, exact: true })
  if (await target.count() && await target.getAttribute('aria-selected') === 'true') return
  if (await target.count() && (await target.boundingBox())!.width > 4) await target.click()
  else { await page.getByRole('button', { name: /^Más pestañas/ }).click(); await page.getByRole('menuitemradio', { name, exact: true }).click() }
  await expect(page.getByRole('tab', { name, exact: true })).toHaveAttribute('aria-selected', 'true')
}
async function group(page: Page, name: string) {
  const section = modal(page).locator(`[data-inventory-section="${name}"]`)
  const trigger = section.locator('.inventory-section-trigger')
  if (await trigger.getAttribute('aria-expanded') !== 'true') await trigger.click()
  await expect(trigger).toHaveAttribute('aria-expanded', 'true')
  await section.locator('.inventory-section-panel').evaluate(async node => {
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
    await Promise.allSettled(node.getAnimations().map(animation => animation.finished))
  })
  await expect(modal(page).locator('.inventory-section-trigger[aria-expanded="true"]')).toHaveCount(1)
}
async function close(page: Page) {
  await modal(page).getByRole('button', { name: 'Cerrar formulario de inventario', exact: true }).click()
  if (await page.getByRole('alertdialog').count()) await page.getByRole('alertdialog').getByRole('button', { name: 'Descartar cambios', exact: true }).click()
  await expect(modal(page)).toHaveCount(0)
}
async function snapshot(page: Page) {
  return page.evaluate(async () => {
    const path = '/src/modules/inventory/api/inventory.mock-data.ts'
    const source = await import(path)
    return JSON.parse(JSON.stringify({ items: source.mockInventoryItems, lots: source.mockStockLots, movements: source.mockStockMovements, suppliers: source.mockSuppliers, orders: source.mockPurchaseOrders, cycles: source.mockSterilizationCycles }))
  })
}
async function itemFields(page: Page, name: string) {
  await modal(page).getByLabel('Nombre', { exact: true }).fill(name)
  await modal(page).getByLabel('Categoría', { exact: true }).fill('Material de prueba')
  await modal(page).getByLabel('Unidad de medida', { exact: true }).fill('ml')
  await modal(page).getByLabel('Costo unitario (USD)', { exact: true }).fill('2.75')
  await modal(page).getByLabel('Proveedor', { exact: true }).fill('Proveedor de texto libre')
}
async function purchaseLine(page: Page, index: number, item: string, quantity = '2') {
  await group(page, 'lines')
  await modal(page).getByRole('button', { name: 'Agregar línea', exact: true }).click()
  await modal(page).getByLabel('Insumo', { exact: true }).nth(index).click()
  await page.getByRole('option', { name: item, exact: true }).click()
  await modal(page).getByLabel('Cantidad', { exact: true }).nth(index).fill(quantity)
  await modal(page).getByLabel('Costo unit. (USD)', { exact: true }).nth(index).fill('3.25')
}

for (const theme of ['light', 'dark']) {
  test(`inventory complete filters, equality threshold and critical stock beyond page 100 in ${theme}`, async ({ page }) => {
    await login(page, theme)
    await page.evaluate(async () => {
      const a = '/src/modules/inventory/api/inventory.mock-data.ts', b = '/src/modules/inventory/api/inventory.api.ts'
      const { mockInventoryItems } = await import(a), { inventoryApi } = await import(b)
      for (let i = 0; i < 121; i++) mockInventoryItems.push({ ...mockInventoryItems[0], id: `fixture_${i}`, name: `Prueba ${i}`, category: i >= 119 ? 'Categoría distante' : 'Pruebas', supplier: 'Proveedor de pruebas', kind: i === 120 ? 'instrumental' : 'consumible', stock: i === 120 ? 0 : i === 119 ? 4 : 20, minStock: i === 120 ? 0 : 4 })
      const original = inventoryApi.list
      ;(window as unknown as { listReads: number }).listReads = 0
      inventoryApi.list = async query => { (window as unknown as { listReads: number }).listReads++; return original(query) }
    })
    await inventory(page)
    await expect(panel(page).locator('[data-slot="pagination-bar"]')).toContainText('de 127')
    await panel(page).getByLabel('Filtrar por categoría', { exact: true }).click()
    await page.getByRole('option', { name: 'Categoría distante', exact: true }).click()
    await expect(panel(page).locator('[data-slot="pagination-bar"]')).toContainText('de 2')
    await panel(page).getByLabel('Filtrar por tipo', { exact: true }).click()
    await page.getByRole('option', { name: 'Instrumental esterilizable', exact: true }).click()
    await panel(page).getByLabel('Filtrar por stock', { exact: true }).click()
    await page.getByRole('option', { name: 'Agotado', exact: true }).click()
    await panel(page).getByLabel('Buscar insumos', { exact: true }).fill('PROVEEDOR DE PRUEBAS')
    await expect(panel(page).getByText('Prueba 120', { exact: true }).filter({ visible: true })).toBeVisible()
    await expect(panel(page).locator('[data-slot="pagination-bar"]')).toContainText('de 1')
    expect(await page.evaluate(() => (window as unknown as { listReads: number }).listReads)).toBe(2)
    await panel(page).getByRole('button', { name: 'Restablecer filtros', exact: true }).click()
    await expect(panel(page).locator('[data-slot="pagination-bar"]')).toContainText('de 127')
    await tab(page, 'Stock crítico')
    await panel(page).getByLabel('Buscar insumos críticos', { exact: true }).fill('Prueba 119')
    await expect(panel(page).locator('[data-slot="pagination-bar"]')).toContainText('de 1')
    await expect(panel(page).getByText('Prueba 119', { exact: true }).filter({ visible: true })).toBeVisible()
    await expect(panel(page).getByRole('meter')).toHaveAttribute('aria-valuenow', '4')
    await expect(panel(page).getByRole('meter')).toHaveAttribute('aria-valuemax', '4')
    await panel(page).getByLabel('Buscar insumos críticos', { exact: true }).fill('Prueba 120')
    await expect(panel(page).locator('[data-slot="pagination-bar"]')).toContainText('de 1')
    await expect(panel(page).getByText('Prueba 120', { exact: true }).filter({ visible: true })).toBeVisible()
    await expect(panel(page).getByRole('meter')).toHaveCount(0)
    await tab(page, 'Insumos')
    await expect(panel(page).getByLabel('Buscar insumos', { exact: true })).toHaveValue('')
  })

  test(`item modal preserves defaults, free supplier, stock and edited values in ${theme}`, async ({ page }) => {
    await login(page, theme); await inventory(page)
    const before = await snapshot(page)
    await panel(page).getByLabel('Buscar insumos', { exact: true }).fill('Prueba')
    await panel(page).getByRole('button', { name: 'Nuevo insumo', exact: true }).click()
    await expect(modal(page).getByLabel('Stock mínimo', { exact: true })).toHaveValue('0')
    await expect(modal(page).getByLabel('Tipo de insumo', { exact: true })).toContainText('Consumible')
    await itemFields(page, 'Prueba de insumo')
    await modal(page).getByRole('button', { name: 'Crear insumo', exact: true }).click({ clickCount: 2 })
    await expect(modal(page)).toHaveCount(0)
    await expect(page).toHaveURL(/\/inventario$/)
    await expect(panel(page).getByLabel('Buscar insumos', { exact: true })).toHaveValue('Prueba')
    await expect(panel(page).getByText('Prueba de insumo', { exact: true }).filter({ visible: true })).toBeVisible()
    const after = await snapshot(page), created = after.items.filter(item => item.name === 'Prueba de insumo')
    expect(created).toHaveLength(1)
    expect(created[0]).toMatchObject({ stock: 0, minStock: 0, unitCost: 2.75, kind: 'consumible', unit: 'ml', supplier: 'Proveedor de texto libre' })
    expect(after.movements).toEqual(before.movements); expect(after.lots).toEqual(before.lots)
    await panel(page).getByRole('button', { name: 'Acciones del insumo Prueba de insumo', exact: true }).click()
    await page.getByRole('menuitem', { name: 'Editar', exact: true }).click()
    await expect(modal(page).getByLabel('Proveedor', { exact: true })).toHaveValue('Proveedor de texto libre')
    await modal(page).getByLabel('Costo unitario (USD)', { exact: true }).fill('4.125')
    await page.evaluate(async () => { const p = '/src/shared/lib/query-client.ts'; await (await import(p)).queryClient.invalidateQueries({ queryKey: ['inventory-items', 'list'] }) })
    await expect(modal(page).getByLabel('Costo unitario (USD)', { exact: true })).toHaveValue('4.125')
    await modal(page).getByRole('button', { name: 'Guardar cambios', exact: true }).click()
    await expect(modal(page)).toHaveCount(0)
    expect((await snapshot(page)).items.find(item => item.id === created[0].id)).toMatchObject({ stock: 0, unitCost: 4.125 })
  })

  test(`movements retain stock rules and errors without duplicate postings in ${theme}`, async ({ page }) => {
    await login(page, theme); await page.goto('/inventario/inv_1')
    await expect(page.getByRole('heading', { name: 'Guantes de nitrilo (caja x100)', exact: true })).toBeVisible()
    const before = await snapshot(page), initial = before.items.find(item => item.id === 'inv_1').stock
    await page.getByRole('button', { name: 'Registrar movimiento', exact: true }).click()
    await modal(page).getByLabel('Cantidad', { exact: true }).fill('2')
    await modal(page).getByLabel('Motivo', { exact: true }).fill('Entrada de prueba')
    await modal(page).getByRole('button', { name: 'Registrar', exact: true }).click({ clickCount: 2 })
    await expect(modal(page)).toHaveCount(0)
    let after = await snapshot(page)
    expect(after.items.find(item => item.id === 'inv_1').stock).toBe(initial + 2)
    expect(after.movements.filter(item => item.reason === 'Entrada de prueba')).toHaveLength(1)
    expect(after.lots.length).toBe(before.lots.length + 1)
    await page.getByRole('button', { name: 'Registrar movimiento', exact: true }).click()
    await modal(page).getByLabel('Tipo de movimiento', { exact: true }).click(); await page.getByRole('option', { name: 'Salida', exact: true }).click()
    await modal(page).getByLabel('Cantidad', { exact: true }).fill(String(initial + 100))
    await modal(page).getByLabel('Motivo', { exact: true }).fill('Salida rechazada de prueba')
    await modal(page).getByRole('button', { name: 'Registrar', exact: true }).click()
    await expect(modal(page).getByLabel('Cantidad', { exact: true })).toBeFocused()
    await expect(modal(page).getByText(/No puede superar el stock disponible/)).toBeVisible()
    expect(await snapshot(page)).toEqual(after)
    await modal(page).getByLabel('Cantidad', { exact: true }).fill('1')
    await modal(page).getByLabel('Motivo', { exact: true }).fill('Salida válida de prueba')
    await modal(page).getByRole('button', { name: 'Registrar', exact: true }).click()
    await expect(modal(page)).toHaveCount(0)
    after = await snapshot(page)
    expect(after.items.find(item => item.id === 'inv_1').stock).toBe(initial + 1)
  })

  test(`purchase accordion retains lines, validates hidden fields and posts stock only on receipt in ${theme}`, async ({ page }) => {
    await login(page, theme); await inventory(page); await tab(page, 'Compras')
    const before = await snapshot(page)
    await panel(page).getByRole('button', { name: 'Nueva orden', exact: true }).click()
    await purchaseLine(page, 0, 'Guantes de nitrilo (caja x100)')
    await purchaseLine(page, 1, 'Anestesia local (cartucho)', '3')
    await group(page, 'notes'); await modal(page).getByLabel('Notas (opcional)', { exact: true }).fill('Compra de prueba')
    await modal(page).getByRole('button', { name: 'Crear orden', exact: true }).click()
    await expect(modal(page).getByLabel('Proveedor', { exact: true })).toBeFocused()
    await modal(page).getByLabel('Proveedor', { exact: true }).click(); await page.getByRole('option', { name: 'Distribuidora Médica S.A.', exact: true }).click()
    await group(page, 'lines'); await expect(modal(page).getByLabel('Cantidad', { exact: true }).nth(1)).toHaveValue('3')
    await group(page, 'notes'); await expect(modal(page).getByLabel('Notas (opcional)', { exact: true })).toHaveValue('Compra de prueba')
    await modal(page).getByRole('button', { name: 'Crear orden', exact: true }).click({ clickCount: 2 })
    await expect(modal(page)).toHaveCount(0)
    let after = await snapshot(page)
    const created = after.orders.filter(order => order.notes === 'Compra de prueba')
    expect(created).toHaveLength(1); expect(created[0].status).toBe('pendiente')
    expect(after.items).toEqual(before.items); expect(after.movements).toEqual(before.movements); expect(after.lots).toEqual(before.lots)
    await panel(page).getByLabel('Buscar compras', { exact: true }).fill('Compra de prueba')
    await expect(panel(page).locator('[data-slot="pagination-bar"]')).toContainText('de 1')
    await panel(page).getByRole('row', { name: 'Ver orden de compra de Distribuidora Médica S.A.', exact: true }).click()
    await expect(modal(page).getByRole('button', { name: /Guardar|Editar/ })).toHaveCount(0)
    await expect(modal(page).getByText('Compra de prueba', { exact: true })).toBeVisible()
    await close(page)
    await panel(page).getByRole('button', { name: 'Acciones de compra de Distribuidora Médica S.A.', exact: true }).click(); await page.getByRole('menuitem', { name: 'Recibir', exact: true }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Recibir', exact: true }).click({ clickCount: 2 })
    await expect(page.getByRole('alertdialog')).toHaveCount(0)
    await expect(panel(page).getByText('Recibida', { exact: true }).filter({ visible: true })).toBeVisible()
    after = await snapshot(page)
    expect(after.items.find(item => item.id === 'inv_1').stock).toBe(before.items.find(item => item.id === 'inv_1').stock + 2)
    expect(after.items.find(item => item.id === 'inv_2').stock).toBe(before.items.find(item => item.id === 'inv_2').stock + 3)
    expect(after.movements.filter(item => item.purchaseOrderId === created[0].id)).toHaveLength(2)
    expect(after.lots.filter(item => item.purchaseOrderId === created[0].id)).toHaveLength(2)
    await panel(page).getByRole('button', { name: 'Acciones de compra de Distribuidora Médica S.A.', exact: true }).click()
    await expect(page.getByRole('menuitem', { name: 'Recibir', exact: true })).toHaveCount(0)
    await expect(page.getByRole('menuitem', { name: 'Cancelar', exact: true })).toHaveCount(0)
  })

  test(`purchase cancellation and rejected saves preserve stock and allow a safe correction in ${theme}`, async ({ page }) => {
    await login(page, theme); await inventory(page); await tab(page, 'Compras')
    const before = await snapshot(page), pending = before.orders.find(order => order.status === 'pendiente')
    const supplierName = before.suppliers.find(supplier => supplier.id === pending.supplierId).name
    await panel(page).getByLabel('Buscar compras', { exact: true }).fill(supplierName)
    await expect(panel(page).locator('[data-slot="pagination-bar"]')).toContainText('de 1')
    await panel(page).getByRole('button', { name: `Acciones de compra de ${supplierName}`, exact: true }).click()
    await page.getByRole('menuitem', { name: 'Cancelar', exact: true }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Cancelar orden', exact: true }).click()
    await expect(page.getByRole('alertdialog')).toHaveCount(0)
    const cancelled = await snapshot(page)
    expect(cancelled.orders.find(order => order.id === pending.id).status).toBe('cancelada')
    expect(cancelled.items).toEqual(before.items); expect(cancelled.movements).toEqual(before.movements); expect(cancelled.lots).toEqual(before.lots)
    await panel(page).getByRole('button', { name: 'Nueva orden', exact: true }).click()
    await modal(page).getByLabel('Proveedor', { exact: true }).click(); await page.getByRole('option').first().click()
    await purchaseLine(page, 0, 'Guantes de nitrilo (caja x100)')
    await page.evaluate(async () => {
      const a = '/src/modules/inventory/api/inventory.api.ts', b = '/src/shared/types/common.ts'
      const { inventoryApi } = await import(a), { ApiError } = await import(b), original = inventoryApi.createPurchaseOrder
      inventoryApi.createPurchaseOrder = async () => { inventoryApi.createPurchaseOrder = original; throw new ApiError('Error de prueba', 400, [{ field: 'lines.0.quantity', message: 'Cantidad rechazada de prueba' }]) }
    })
    await group(page, 'general'); await modal(page).getByRole('button', { name: 'Crear orden', exact: true }).click()
    await expect(modal(page).getByLabel('Cantidad', { exact: true })).toBeFocused()
    await expect(modal(page).getByLabel('Cantidad', { exact: true })).toHaveAccessibleDescription('Cantidad rechazada de prueba')
    expect(await snapshot(page)).toEqual(cancelled)
    await modal(page).getByLabel('Cantidad', { exact: true }).fill('3')
    await modal(page).getByRole('button', { name: 'Crear orden', exact: true }).click(); await expect(modal(page)).toHaveCount(0)
    const after = await snapshot(page)
    expect(after.orders.length).toBe(cancelled.orders.length + 1)
    expect(after.items).toEqual(before.items); expect(after.movements).toEqual(before.movements); expect(after.lots).toEqual(before.lots)
  })

  test(`supplier forms retain real relationships and blocked deletion in ${theme}`, async ({ page }) => {
    await login(page, theme); await inventory(page); await tab(page, 'Proveedores')
    const before = await snapshot(page)
    await panel(page).getByRole('button', { name: 'Nuevo proveedor', exact: true }).click()
    await modal(page).getByLabel('Nombre', { exact: true }).fill('Proveedor de prueba')
    await modal(page).getByLabel('Correo electrónico', { exact: true }).fill('correo inválido')
    await modal(page).getByRole('button', { name: 'Crear proveedor', exact: true }).click()
    await expect(modal(page).getByLabel('Correo electrónico', { exact: true })).toHaveAccessibleDescription('Correo inválido')
    await modal(page).getByLabel('Correo electrónico', { exact: true }).fill('proveedor@example.test')
    await modal(page).getByLabel('Notas / condiciones (opcional)', { exact: true }).fill('Condiciones originales')
    await modal(page).getByRole('button', { name: 'Crear proveedor', exact: true }).click()
    await expect(modal(page)).toHaveCount(0)
    await panel(page).getByRole('button', { name: 'Acciones del proveedor Proveedor de prueba', exact: true }).click(); await page.getByRole('menuitem', { name: 'Editar', exact: true }).click()
    await expect(modal(page).getByLabel('Notas / condiciones (opcional)', { exact: true })).toHaveValue('Condiciones originales')
    await modal(page).getByLabel('Teléfono', { exact: true }).fill('0991234567')
    await modal(page).getByRole('button', { name: 'Guardar cambios', exact: true }).click(); await expect(modal(page)).toHaveCount(0)
    await panel(page).getByRole('button', { name: 'Acciones del proveedor Distribuidora Médica S.A.', exact: true }).click(); await page.getByRole('menuitem', { name: 'Eliminar', exact: true }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Eliminar', exact: true }).click()
    await expect(page.getByText('No se puede eliminar: el proveedor tiene órdenes de compra asociadas', { exact: true })).toBeVisible()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Cancelar', exact: true }).click()
    const after = await snapshot(page)
    expect(after.items).toEqual(before.items); expect(after.orders).toEqual(before.orders); expect(after.movements).toEqual(before.movements)
    expect(after.suppliers.find(item => item.name === 'Proveedor de prueba')).toMatchObject({ phone: '0991234567', notes: 'Condiciones originales' })
  })

  test(`sterilization preserves selections, failed results and sanitary history in ${theme}`, async ({ page }) => {
    await login(page, theme); await inventory(page); await tab(page, 'Esterilización')
    const before = await snapshot(page)
    await panel(page).getByRole('button', { name: 'Nuevo ciclo', exact: true }).click()
    await group(page, 'results'); await modal(page).getByLabel('Resultado', { exact: true }).click(); await page.getByRole('option', { name: 'Fallido', exact: true }).click()
    await modal(page).getByLabel('Notas (opcional)', { exact: true }).fill('Ciclo fallido de prueba')
    await modal(page).getByRole('button', { name: 'Registrar ciclo', exact: true }).click()
    await expect(modal(page).locator('#itemIds')).toBeFocused()
    await modal(page).getByRole('checkbox', { name: 'Espejo bucal', exact: true }).check()
    await group(page, 'general'); await modal(page).getByLabel('Responsable', { exact: true }).click(); await page.getByRole('option').first().click()
    await group(page, 'instruments'); await expect(modal(page).getByRole('checkbox', { name: 'Espejo bucal', exact: true })).toBeChecked()
    await group(page, 'results'); await expect(modal(page).getByLabel('Resultado', { exact: true })).toContainText('Fallido')
    await modal(page).getByRole('button', { name: 'Registrar ciclo', exact: true }).click({ clickCount: 2 }); await expect(modal(page)).toHaveCount(0)
    await panel(page).getByLabel('Buscar ciclos', { exact: true }).fill('Ciclo fallido de prueba')
    await expect(panel(page).locator('[data-slot="pagination-bar"]')).toContainText('de 1')
    await expect(panel(page).getByText('Fallido', { exact: true }).filter({ visible: true })).toBeVisible()
    const after = await snapshot(page), records = after.cycles.filter(item => item.notes === 'Ciclo fallido de prueba')
    expect(records).toHaveLength(1); expect(records[0]).toMatchObject({ result: 'fallido', itemIds: ['inv_6'] })
    expect(after.cycles.filter(item => item.id !== records[0].id)).toEqual(before.cycles)
    expect(after.items).toEqual(before.items); expect(after.movements).toEqual(before.movements)
    expect(after.lots).toEqual(before.lots)
  })

  test(`all inventory forms guard drafts, trap focus and retain a single internal scroller in ${theme}`, async ({ page }) => {
    await login(page, theme); await inventory(page)
    const before = await snapshot(page)
    for (const [section, button, field] of [['Insumos', 'Nuevo insumo', 'Nombre'], ['Compras', 'Nueva orden', 'Proveedor'], ['Proveedores', 'Nuevo proveedor', 'Nombre'], ['Esterilización', 'Nuevo ciclo', 'Fecha']]) {
      await tab(page, section)
      const opener = panel(page).getByRole('button', { name: button, exact: true }); await opener.click()
      if (field === 'Proveedor') { await modal(page).getByLabel(field, { exact: true }).click(); await page.getByRole('option').first().click() }
      else await modal(page).getByLabel(field, { exact: true }).fill(field === 'Fecha' ? '2026-11-18' : 'Borrador de prueba')
      const scroll = await page.locator('main').evaluate(node => node.scrollTop)
      await page.mouse.move(3, 3); await page.mouse.wheel(0, 600)
      expect(await page.locator('main').evaluate(node => node.scrollTop)).toBe(scroll)
      for (const method of ['x', 'cancel', 'escape', 'outside']) {
        if (method === 'x') await modal(page).getByRole('button', { name: 'Cerrar formulario de inventario', exact: true }).click()
        if (method === 'cancel') await modal(page).getByRole('button', { name: 'Cancelar', exact: true }).click()
        if (method === 'escape') await page.keyboard.press('Escape')
        if (method === 'outside') await page.mouse.click(3, 3)
        await expect(page.getByRole('alertdialog')).toBeVisible()
        await page.getByRole('alertdialog').getByRole('button', { name: 'Continuar editando', exact: true }).click()
        await expect(page.getByRole('alertdialog')).toHaveCount(0)
        await expect(modal(page)).toBeVisible()
      }
      for (let i = 0; i < 12; i++) { await page.keyboard.press('Tab'); await expect.poll(() => modal(page).evaluate(node => node.contains(document.activeElement))).toBe(true) }
      await close(page); await expect(opener).toBeFocused()
    }
    expect(await snapshot(page)).toEqual(before)
  })

  test(`loading, failed queries and pending writes never show false empty states or lose data in ${theme}`, async ({ page }) => {
    await login(page, theme); await inventory(page)
    await page.evaluate(async () => {
      const path = '/src/modules/inventory/api/inventory.api.ts', { inventoryApi } = await import(path), original = inventoryApi.get
      inventoryApi.get = async id => { inventoryApi.get = original; return new Promise(resolve => { (window as unknown as { releaseItem: () => void }).releaseItem = () => { void original(id).then(resolve) } }) }
    })
    await panel(page).getByRole('button', { name: 'Acciones del insumo Resina compuesta', exact: true }).click(); await page.getByRole('menuitem', { name: 'Editar', exact: true }).click()
    await expect(modal(page).getByLabel('Cargando insumo', { exact: true })).toBeVisible()
    await expect(modal(page).getByLabel('Nombre', { exact: true })).toHaveCount(0)
    await page.evaluate(() => (window as unknown as { releaseItem: () => void }).releaseItem())
    await expect(modal(page).getByLabel('Nombre', { exact: true })).toHaveValue('Resina compuesta')
    await modal(page).getByLabel('Nombre', { exact: true }).fill('Resina de prueba')
    await page.evaluate(async () => {
      const path = '/src/modules/inventory/api/inventory.api.ts', { inventoryApi } = await import(path), original = inventoryApi.update
      inventoryApi.update = async (id, values) => { inventoryApi.update = original; return new Promise((resolve, reject) => { (window as unknown as { releaseWrite: () => void }).releaseWrite = () => { void original(id, values).then(resolve, reject) } }) }
    })
    await modal(page).getByRole('button', { name: 'Guardar cambios', exact: true }).click()
    await expect(modal(page).getByRole('button', { name: 'Cerrar formulario de inventario', exact: true })).toBeDisabled()
    await page.keyboard.press('Escape'); await expect(modal(page)).toBeVisible()
    expect(await page.evaluate(() => !window.dispatchEvent(new Event('beforeunload', { cancelable: true })))).toBe(true)
    await page.evaluate(() => (window as unknown as { releaseWrite: () => void }).releaseWrite())
    await expect(modal(page)).toHaveCount(0)
    await tab(page, 'Stock crítico')
    await page.evaluate(async () => { const path = '/src/shared/lib/query-client.ts', { queryClient } = await import(path); await queryClient.fetchQuery({ queryKey: ['inventory-items', 'list', 'complete-catalog'], staleTime: 0, retry: false, queryFn: async () => { throw new Error('Fallo de consulta de prueba') } }).catch(() => undefined) })
    await expect(panel(page).getByText('No se pudo cargar la información', { exact: true }).filter({ visible: true })).toBeVisible()
    await expect(panel(page).getByText('No hay insumos en el mínimo o por debajo.', { exact: true }).filter({ visible: true })).toHaveCount(0)
  })

  test(`inventory accordion animates sequentially and supports reduced motion in ${theme}`, async ({ page }) => {
    await login(page, theme); await inventory(page); await tab(page, 'Compras')
    await page.emulateMedia({ reducedMotion: 'no-preference' }); await panel(page).getByRole('button', { name: 'Nueva orden', exact: true }).click()
    const samples = await modal(page).evaluate(async root => {
      const previous = root.querySelector('[data-inventory-section="general"] .inventory-section-panel')!
      root.querySelector<HTMLElement>('[data-inventory-section="lines"] .inventory-section-trigger')!.click()
      const samples: { open: number; height: number }[] = [], start = performance.now()
      while (performance.now() - start < 520) { samples.push({ open: root.querySelectorAll('.inventory-section-trigger[aria-expanded="true"]').length, height: previous.getBoundingClientRect().height }); await new Promise(r => requestAnimationFrame(r)) }
      return samples
    })
    expect(Math.max(...samples.map(s => s.open))).toBeLessThanOrEqual(1)
    expect(new Set(samples.filter(s => s.height > 0).map(s => Math.round(s.height))).size).toBeGreaterThan(2)
    await page.emulateMedia({ reducedMotion: 'reduce' }); await group(page, 'general')
    await expect(modal(page).locator('.inventory-section-panel').first()).toHaveCSS('transition-duration', '0s')
  })

  test(`five inventory tabs and proportional dialogs fit eleven widths in ${theme}`, async ({ page }, testInfo) => {
    test.setTimeout(240000)
    await login(page, theme); await inventory(page)
    const matrix = []
    for (const width of [320, 360, 375, 390, 430, 600, 768, 1024, 1280, 1440, 1920]) {
      await page.setViewportSize({ width, height: 900 }); await settleCalendarLayout(page)
      for (const section of ['Insumos', 'Compras', 'Proveedores', 'Esterilización', 'Stock crítico']) {
        await tab(page, section)
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
      }
      for (const [section, button] of [['Insumos', 'Nuevo insumo'], ['Compras', 'Nueva orden'], ['Proveedores', 'Nuevo proveedor'], ['Esterilización', 'Nuevo ciclo']]) {
        await tab(page, section); await panel(page).getByRole('button', { name: button, exact: true }).click()
        const editor = modal(page); await expect(editor).toBeVisible()
        if (section === 'Compras') await purchaseLine(page, 0, 'Guantes de nitrilo (caja x100)')
        if (section === 'Esterilización') await group(page, 'instruments')
        const actions = editor.locator('.inventory-form-actions'); await actions.scrollIntoViewIfNeeded(); await expect(actions).toBeInViewport()
        await expect(actions).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)'); await expect(actions).toHaveCSS('border-top-width', '0px')
        const bounds = (await editor.boundingBox())!
        expect(bounds.x).toBeGreaterThanOrEqual(-1); expect(bounds.x + bounds.width).toBeLessThanOrEqual(width + 1)
        expect(await editor.evaluate(node => node.scrollWidth)).toBeLessThanOrEqual(await editor.evaluate(node => node.clientWidth))
        for (const button of await actions.getByRole('button').all()) expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(width < 1024 ? 44 : 40)
        await close(page)
        matrix.push({ width, section, bounds })
      }
    }
    for (const viewport of [{ width: 390, height: 380 }, { width: 720, height: 450 }]) {
      await page.setViewportSize(viewport); await tab(page, 'Insumos'); await panel(page).getByRole('button', { name: 'Nuevo insumo', exact: true }).click()
      await modal(page).getByLabel('Nombre', { exact: true }).fill('Espacio reducido')
      await modal(page).getByRole('button', { name: 'Crear insumo', exact: true }).scrollIntoViewIfNeeded(); await expect(modal(page).getByRole('button', { name: 'Crear insumo', exact: true })).toBeInViewport(); await close(page)
    }
    await testInfo.attach('inventory-responsive-matrix', { body: JSON.stringify(matrix), contentType: 'application/json' })
  })
}
