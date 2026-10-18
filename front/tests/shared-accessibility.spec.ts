import { test, expect } from "@playwright/test"

test("patients table exposes accessible search and actions and supports keyboard navigation", async ({ page }) => {
  await page.goto("/login")
  await page.getByLabel("Correo electrónico").fill("admin@clinica.com")
  await page.locator("#password").fill("admin123")
  await page.getByRole("button", { name: "Ingresar", exact: true }).click()
  await page.getByRole("button", { name: "Continuar", exact: true }).click()
  await expect(page).toHaveURL(/\/$/)

  await page.goto("/pacientes")
  await expect(page.getByRole("textbox", { name: "Buscar pacientes" })).toBeVisible()
  await expect(page.getByRole("button", { name: /Acciones del paciente/ }).first()).toBeVisible()

  const firstPatientRow = page.getByRole("row", { name: /Abrir detalles del paciente/ }).first()
  await expect(firstPatientRow).toBeVisible()
  await firstPatientRow.focus()
  await expect(firstPatientRow).toBeFocused()
  await firstPatientRow.press("Enter")
  await expect(page).toHaveURL(/\/pacientes\/[^/]+$/)

  await page.goto("/pacientes")
  const nextPatientRow = page.getByRole("row", { name: /Abrir detalles del paciente/ }).first()
  await nextPatientRow.focus()
  await nextPatientRow.press("Space")
  await expect(page).toHaveURL(/\/pacientes\/[^/]+$/)

  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto("/pacientes")
  const firstPatientCard = page.getByRole("button", { name: /Abrir detalles del paciente/ }).first()
  await expect(firstPatientCard).toBeVisible()
  await firstPatientCard.focus()
  await firstPatientCard.press("Enter")
  await expect(page).toHaveURL(/\/pacientes\/[^/]+$/)
})
