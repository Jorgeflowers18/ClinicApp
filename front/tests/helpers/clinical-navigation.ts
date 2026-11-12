import { expect, type Page } from "@playwright/test"

export const clinicalNavigation = (page: Page) => page.getByRole("navigation", { name: "Secciones de la historia clínica", exact: true })

export async function selectRecordSection(page: Page, label: string) {
  await clinicalNavigation(page).getByRole("button", { name: "Ver secciones", exact: true }).click()
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  await page.getByRole("menuitemradio", { name: new RegExp(`^(?:\\d+\\. )?${escaped}(?: Con errores)?$`) }).click()
  await expect(page.getByRole("menu")).toHaveCount(0)
  await expectRecordSection(page, label)
}

export async function expectRecordSection(page: Page, label: string) {
  const name = label.replace(/ Con errores$/, "")
  await expect(clinicalNavigation(page).getByRole("heading", { level: 2 })).toHaveText(name)
  await expect(page.getByRole("region", { name, exact: true })).toBeVisible()
  if (label.endsWith(" Con errores")) await expect(clinicalNavigation(page).getByText("Con errores", { exact: true })).toBeVisible()
}
