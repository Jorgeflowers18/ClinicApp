import { expect, test, type Page } from "@playwright/test"

const frameOf = (page: Page) => page.frameLocator('iframe[title="Odontograma y periodontograma del paciente"]')

async function login(page: Page) {
  await page.goto("/login")
  await page.getByLabel("Correo electrónico").fill("admin@clinica.com")
  await page.locator("#password").fill("admin123")
  await page.getByRole("button", { name: "Ingresar", exact: true }).click()
  await page.getByRole("button", { name: "Continuar", exact: true }).click()
}

test("diagnósticos del caso responden al viewport y conservan el estado de la visita", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await login(page)
  await page.goto("/historial-clinico/paciente/pat_5")
  await page.getByRole("button", { name: "Nueva visita", exact: true }).click()
  await page.getByLabel("Profesional", { exact: true }).click()
  await page.getByRole("option", { name: /Dra\. Carla Ríos/ }).click()
  await page.getByRole("dialog").getByRole("button", { name: "Iniciar visita" }).click()

  const editor = frameOf(page)
  await expect(editor.locator("#toothGrid")).toBeVisible()
  await editor.locator("#openCaseDiagnosesBtn").click()
  const modal = editor.locator("#caseDiagnosesModal")
  const emptyState = editor.locator("#caseDiagnosesSection")
  await expect(modal).toBeVisible()
  await expect.poll(() =>
    modal.evaluate((node) => {
      const frame = window.frameElement!
      const frameRect = frame.getBoundingClientRect()
      const dialogRect = node.getBoundingClientRect()
      const top = frameRect.top + dialogRect.top
      const bottom = frameRect.top + dialogRect.bottom
      return top >= 0 && bottom <= window.parent.innerHeight
    })
  ).toBe(true)
  const dialogPosition = await modal.evaluate((node) => {
    const frameRect = window.frameElement!.getBoundingClientRect()
    const dialogRect = node.getBoundingClientRect()
    return { top: frameRect.top + dialogRect.top, bottom: frameRect.top + dialogRect.bottom }
  })
  expect(dialogPosition.top).toBeGreaterThanOrEqual(0)
  expect(dialogPosition.bottom).toBeLessThanOrEqual(844)
  await expect.poll(() => emptyState.evaluate((node) => getComputedStyle(node, "::before").content))
    .toContain("Aún no hay diagnósticos registrados")

  for (const width of [320, 375, 390, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 1400 })
    const fits = await modal.evaluate((node) => {
      const dialog = node.getBoundingClientRect()
      const close = node.querySelector<HTMLButtonElement>(".odon-settings-close")!.getBoundingClientRect()
      const select = node.querySelector<HTMLSelectElement>("#caseDxAddSelect")!.getBoundingClientRect()
      return document.documentElement.scrollWidth <= window.innerWidth
        && dialog.left >= 0
        && dialog.right <= window.innerWidth
        && dialog.width <= window.innerWidth
        && Math.abs(close.right - (dialog.right - 12)) <= 1
        && select.left >= dialog.left
        && select.right <= dialog.right
    })
    expect(fits, `Diagnosis dialog overflow at ${width}px`).toBe(true)
  }

  await editor.locator("#caseDxAddSelect").selectOption("jawSizeAnomaly")
  await expect(editor.locator(".case-diagnoses-row .dx-label")).toHaveText("Anomalías mayores del tamaño maxilar")
  await expect(editor.locator(".case-diagnoses-row .dx-code")).toHaveText("K07.0")
  await expect.poll(() => emptyState.evaluate((node) => getComputedStyle(node, "::before").content)).toBe("none")
  await expect(page.getByRole("status").filter({ hasText: "Borrador guardado" })).toBeVisible()

  await page.reload()
  await expect(editor.locator("#toothGrid")).toBeVisible()
  await editor.locator("#openCaseDiagnosesBtn").click()
  await expect(editor.locator(".case-diagnoses-row .dx-label")).toHaveText("Anomalías mayores del tamaño maxilar")
  await expect(editor.locator(".case-diagnoses-row .dx-code")).toHaveText("K07.0")
  const removeDiagnosis = editor.locator(".case-dx-remove")
  await removeDiagnosis.scrollIntoViewIfNeeded()
  await removeDiagnosis.click()
  await expect(editor.locator(".case-diagnoses-row")).toHaveCount(0)

  await page.goto("/historial-clinico/paciente/pat_1?visita=hist_1")
  const closedEditor = frameOf(page)
  await expect(closedEditor.locator("#toothGrid")).toBeVisible()
  await closedEditor.locator("#openCaseDiagnosesBtn").click()
  await expect(closedEditor.locator("#caseDxAddSelect")).toBeDisabled()
  const removeButton = closedEditor.locator(".case-dx-remove")
  if (await removeButton.count()) await expect(removeButton).toBeDisabled()
})
