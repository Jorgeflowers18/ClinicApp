import { expect, test, type Page } from "@playwright/test"

test.use({ reducedMotion: "reduce" })
const widths = [320, 360, 375, 390, 430, 600, 768, 1024, 1280, 1440, 1920]
async function login(page: Page, theme: string) {
  await page.goto("/login")
  await page.getByRole("button", { name: theme === "light" ? "Tema claro" : "Tema oscuro", exact: true }).click()
  await page.locator("#email").fill("admin@clinica.com")
  await page.locator("#password").fill("admin123")
  await page.getByRole("button", { name: "Ingresar", exact: true }).click()
  await page.getByRole("button", { name: "Continuar", exact: true }).click()
  await expect(page).toHaveURL(/\/$/)
}

for (const theme of ["light", "dark"]) {
  test(`page actions are integrated, reachable and correctly sized across eleven widths in ${theme}`, async ({ page }, testInfo) => {
    await login(page, theme)
    const measurements = []
    for (const route of ["/pacientes/nuevo", "/pacientes/pat_5/editar", "/tratamientos/nuevo", "/inventario/nuevo", "/perfil-usuario", "/perfil-institucion", "/notificaciones"]) {
      await page.goto(route)
      if (route === "/notificaciones") await page.getByRole("tab", { name: "Plantillas de mensajes", exact: true }).click()
      const actions = route === "/tratamientos/nuevo" ? page.locator('.treatment-dialog .treatment-form-actions') : route === "/inventario/nuevo" ? page.locator('.inventory-dialog .inventory-form-actions') : page.locator('main [data-form-actions][data-context="page"]')
      await expect(actions).toHaveCount(1)
      for (const width of widths) {
        await page.setViewportSize({ width, height: 900 })
        if (route === "/tratamientos/nuevo") await actions.scrollIntoViewIfNeeded()
        await actions.scrollIntoViewIfNeeded()
        await expect(actions).toHaveCSS("position", "static")
        await expect(actions).toHaveCSS("border-radius", "0px")
        await expect(actions).toHaveCSS("border-left-width", "0px")
        await expect(actions).toHaveCSS("border-top-width", "0px")
        await expect(actions).toHaveCSS("box-shadow", "none")
        await expect(actions).toHaveCSS("background-color", "rgba(0, 0, 0, 0)")
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
        for (const button of await actions.getByRole("button").all()) {
          await expect(button).toHaveCSS("min-height", width < 1024 ? "44px" : "40px")
          const box = (await button.boundingBox())!
          expect(box.x).toBeGreaterThanOrEqual(-1)
          expect(box.x + box.width).toBeLessThanOrEqual(width + 1)
          expect(box.y + box.height).toBeLessThanOrEqual(901)
          if (await button.getAttribute("data-variant") === "default" && await button.isEnabled()) await expect(button).toHaveCSS("background-color", theme === "light" ? "rgb(83, 80, 204)" : "rgb(228, 242, 34)")
        }
        measurements.push({ route, width })
      }
    }
    await testInfo.attach("page-action-matrix", { body: JSON.stringify(measurements), contentType: "application/json" })
  })

  test(`administrative creation and cancel keep their existing callbacks in ${theme}`, async ({ page }) => {
    await login(page, theme)
    await page.goto("/tratamientos")
    await page.getByRole("button", { name: "Nuevo tratamiento", exact: true }).click()
    await page.getByRole("button", { name: "Cancelar", exact: true }).click()
    await expect(page).toHaveURL(/\/tratamientos$/)
    await page.getByRole("button", { name: "Nuevo tratamiento", exact: true }).click()
    await page.locator("#name").fill("Tratamiento de acciones")
    await page.locator("#category").fill("Odontología general")
    await page.locator("#price").fill("60")
    await page.getByRole("button", { name: "Crear tratamiento", exact: true }).click()
    await expect(page.getByRole("row", { name: "Ver tratamiento: Tratamiento de acciones", exact: true })).toBeVisible()
    await page.goto("/inventario/nuevo")
    await page.locator("#name").fill("Insumo de acciones")
    await page.locator("#category").fill("Material dental")
    await page.locator("#unit").fill("Unidad")
    await page.locator("#unitCost").fill("2.50")
    await page.getByRole("button", { name: "Crear insumo", exact: true }).click()
    await expect(page.getByRole("heading", { name: "Insumo de acciones", exact: true })).toBeVisible()
  })

  test(`appointment dialog and branch sheet keep integrated actions accessible with a reduced keyboard viewport in ${theme}`, async ({ page }) => {
    await login(page, theme)
    await page.goto("/citas")
    await page.getByRole("button", { name: "Nueva cita", exact: true }).click()
    const appointment = page.getByRole("dialog", { name: "Nueva cita", exact: true })
    await appointment.getByLabel("Notas", { exact: true }).fill("Borrador conservado")
    for (const size of [{ width: 1440, height: 900 }, { width: 375, height: 360 }]) {
      await page.setViewportSize(size)
      const footer = appointment.locator('[data-form-actions][data-context="dialog"]')
      await footer.scrollIntoViewIfNeeded()
      await expect(footer).toHaveCSS("border-radius", "0px")
      await expect(footer).toHaveCSS("border-left-width", "0px")
      await expect(footer.getByRole("button", { name: "Agendar cita", exact: true })).toBeInViewport()
      await expect(appointment.getByLabel("Notas", { exact: true })).toHaveValue("Borrador conservado")
    }
    await appointment.getByRole("button", { name: "Cancelar", exact: true }).click()
    await page.getByRole("button", { name: "Descartar cambios", exact: true }).click()
    await expect(appointment).not.toBeVisible()
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto("/perfil-institucion")
    await page.getByRole("button", { name: "Crear sede", exact: true }).click()
    const sheet = page.getByRole("dialog", { name: "Nueva sede", exact: true })
    await sheet.getByLabel("Nombre de la sede", { exact: true }).fill("Sede conservada")
    await page.setViewportSize({ width: 375, height: 360 })
    const footer = sheet.locator('[data-form-actions][data-context="sheet"]')
    await expect(footer).toHaveCSS("border-radius", "0px")
    await expect(footer.getByRole("button", { name: "Guardar sede", exact: true })).toBeInViewport()
    await sheet.getByRole("button", { name: "Guardar sede", exact: true }).click()
    await expect(sheet).not.toBeVisible()
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("clinicapp.institution-profile")!).branches.some((branch: { name: string }) => branch.name === "Sede conservada"))).toBe(true)
  })
}
