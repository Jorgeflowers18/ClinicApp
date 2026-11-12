import { expect, test, type Page } from "@playwright/test"
import { clinicalNavigation } from "./helpers/clinical-navigation"

test.describe.configure({ mode: "parallel" })

const names = [
  "Datos del paciente", "Antecedentes", "Odontograma y periodontograma", "Plan de tratamiento",
  "Consentimiento y declaración", "Fotos y documentos", "Atenciones", "Tratamientos", "Citas", "Sección de prueba",
]
const previous = (page: Page) => page.getByRole("button", { name: "Anterior", exact: true, includeHidden: true })
const next = (page: Page) => page.getByRole("button", { name: "Siguiente", exact: true, includeHidden: true })
const groups = (page: Page) => page.getByRole("group", { name: "Navegación entre secciones", exact: true, includeHidden: true })

async function fixture(page: Page, total: number, theme: string, active = 1) {
  await page.goto(`/tests/fixtures/clinical-navigation.html?total=${total}&theme=${theme}&active=${active}`)
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Prueba aislada de navegación clínica")
  await expect(page.getByLabel("Número de guardados")).toHaveText("0")
}

async function position(page: Page, index: number, total: number) {
  await expect(clinicalNavigation(page).getByText(`Sección ${index} de ${total}`, { exact: true })).toBeVisible()
  await expect(previous(page)).toHaveCount(index > 1 ? 1 : 0)
  await expect(next(page)).toHaveCount(index < total ? 1 : 0)
  await expect(groups(page)).toHaveCount(total > 1 ? 1 : 0)
  for (const button of await groups(page).getByRole("button").all()) {
    await expect(button).toHaveAttribute("type", "button")
    await expect(button).toBeEnabled()
  }
}

for (const theme of ["light", "dark"] as const) {
  for (const total of [1, 2, 3, 10]) {
    test(`${total} available sections render only real destinations and keep save independent in ${theme}`, async ({ page }) => {
      await fixture(page, total, theme)
      await page.getByLabel("Dato de prueba", { exact: true }).fill("Edición pendiente")
      for (let index = 1; index <= total; index++) {
        await position(page, index, total)
        await expect(clinicalNavigation(page).getByRole("heading", { level: 2 })).toHaveText(names[index - 1])
        await expect(page.getByLabel("Dato de prueba", { exact: true })).toHaveValue("Edición pendiente")
        await expect(page.getByLabel("Número de guardados")).toHaveText("0")
        if (index < total) await next(page).click()
      }
      for (let index = total; index > 1; index--) {
        await previous(page).click()
        await position(page, index - 1, total)
      }
      if (total > 1) {
        await clinicalNavigation(page).getByRole("button", { name: "Ver secciones", exact: true }).click()
        await expect(page.getByRole("menuitemradio")).toHaveCount(total)
        await page.getByRole("menuitemradio").last().click()
        await expect(page.getByRole("menu")).toHaveCount(0)
        await position(page, total, total)
      } else {
        await expect(clinicalNavigation(page).getByRole("button")).toHaveCount(0)
        await expect(page.locator('[data-slot="clinical-navigation-footer"]')).toHaveCount(0)
      }
      await expect(page.getByLabel("Número de guardados")).toHaveText("0")
      await page.getByRole("button", { name: "Guardar cambios", exact: true }).click()
      await expect(page.getByLabel("Número de guardados")).toHaveText("1")
      await expect(page.getByLabel("Valor guardado")).toHaveText("Edición pendiente")
      await page.setViewportSize({ width: 320, height: 900 })
      await position(page, total, total)
      if (total === 1) await expect(page.locator('[data-slot="clinical-navigation-footer"]')).toHaveCount(0)
      else await expect(page.locator('[data-slot="clinical-navigation-footer"]')).toBeVisible()
    })
  }

  test(`availability changes, reorder and removed selections preserve a valid destination and draft in ${theme}`, async ({ page }) => {
    await fixture(page, 3, theme, 3)
    await page.getByLabel("Dato de prueba", { exact: true }).fill("Borrador conservado")
    await page.getByLabel("Cantidad disponible", { exact: true }).selectOption("10")
    await position(page, 3, 10)
    await page.getByRole("button", { name: "Invertir orden", exact: true }).click()
    await position(page, 8, 10)
    await expect(clinicalNavigation(page).getByRole("heading")).toHaveText(names[2])
    await page.getByRole("button", { name: "Solo segunda y cuarta disponibles", exact: true }).click()
    await position(page, 1, 2)
    await expect(page.getByLabel("Identificador activo")).toHaveText("antecedentes")
    await clinicalNavigation(page).getByRole("button", { name: "Ver secciones", exact: true }).click()
    await expect(page.getByRole("menuitemradio")).toHaveText(["1.Antecedentes", "2.Plan de tratamiento"])
    await page.getByRole("menuitemradio").last().click()
    await position(page, 2, 2)
    await page.getByRole("button", { name: "Quitar sección activa", exact: true }).click()
    await position(page, 1, 1)
    await expect(page.getByLabel("Identificador activo")).toHaveText("antecedentes")
    await page.getByRole("button", { name: "Quitar sección activa", exact: true }).click()
    await expect(clinicalNavigation(page)).toHaveCount(0)
    await expect(groups(page)).toHaveCount(0)
    await expect(page.locator('[data-slot="clinical-navigation-footer"]')).toHaveCount(0)
    await page.getByLabel("Cantidad disponible", { exact: true }).selectOption("3")
    await position(page, 2, 3)
    await expect(page.getByLabel("Dato de prueba", { exact: true })).toHaveValue("Borrador conservado")
    await expect(page.getByLabel("Número de guardados")).toHaveText("0")
  })

  test(`menu selection, keyboard focus and theme changes remain coherent in ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.emulateMedia({ reducedMotion: "reduce" })
    await fixture(page, 3, theme, 2)
    const trigger = clinicalNavigation(page).getByRole("button", { name: "Ver secciones", exact: true })
    await trigger.focus()
    await trigger.press("Enter")
    await expect(page.getByRole("menuitemradio", { checked: true })).toHaveAccessibleName(`2. ${names[1]}`)
    await page.keyboard.press("End")
    await expect(page.getByRole("menuitemradio").last()).toBeFocused()
    await page.keyboard.press("Enter")
    await position(page, 3, 3)
    await expect(trigger).toBeFocused()
    await trigger.press("ArrowDown")
    await page.keyboard.press("Home")
    await page.keyboard.press("Enter")
    await position(page, 1, 3)
    await expect(trigger).toBeFocused()
    await trigger.press("Enter")
    await page.keyboard.press("Escape")
    await expect(trigger).toBeFocused()
    expect(await trigger.evaluate((node) => getComputedStyle(node).boxShadow)).not.toBe("none")
    await page.getByRole("button", { name: "Cambiar tema de la prueba", exact: true }).click()
    await position(page, 1, 3)
    await page.setViewportSize({ width: 1440, height: 1000 })
    await expect(page.locator('[data-slot="clinical-navigation-footer"]')).toHaveCount(0)
    await position(page, 1, 3)
  })
}
