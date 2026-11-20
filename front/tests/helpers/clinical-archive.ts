import { expect, type Page } from "@playwright/test"
import { setAccessTheme } from "./access-theme"

export async function loginArchive(page: Page, theme: "light" | "dark" = "dark", role = "admin") {
  await page.goto("/login")
  await setAccessTheme(page, theme)
  await page.locator("#email").fill(`${role}@clinica.com`)
  await page.locator("#password").fill(`${role}123`)
  await page.getByRole("button", { name: "Ingresar", exact: true }).click()
  await page.getByRole("button", { name: "Continuar", exact: true }).click()
  await expect(page).toHaveURL(/\/$/)
}
export async function openArchive(page: Page, patientId = "pat_5") {
  await page.goto(`/pacientes/${patientId}`)
  await page.getByRole("tab", { name: "Archivo clínico", exact: true }).click()
  await expect(page.getByRole("region", { name: "Archivo clínico", exact: true })).toBeVisible()
}
/** Generated color rectangles, never actual clinical or identifying images. */
export async function seedArchive(page: Page, count = 2, patientId = "pat_5") {
  return page.evaluate(async ({ count, patientId }) => {
    const apiPath = "/src/modules/clinical-history/archive/api.ts", typesPath = "/src/modules/clinical-history/archive/types.ts", clientPath = "/src/shared/lib/query-client.ts", keysPath = "/src/modules/clinical-history/api/clinical-history.queries.ts"
    const [{ archiveApi }, { emptyFileDraft }, { queryClient }, { clinicalHistoryKeys }] = await Promise.all([import(apiPath), import(typesPath), import(clientPath), import(keysPath)])
    let catalog = await archiveApi.category({ name: "Controles de prueba", description: "Archivos sintéticos", color: "cyan", archivedAt: null })
    catalog = await archiveApi.tag("Prueba visual")
    const ids: string[] = []
    for (let index = 0; index < count; index++) {
      const canvas = document.createElement("canvas"); canvas.width = 400; canvas.height = 260
      const context = canvas.getContext("2d")!
      context.fillStyle = `hsl(${index * 17 + 50} 60% 40%)`; context.fillRect(0, 0, 400, 260); context.fillStyle = "white"; context.fillRect(index * 3 + 20, 20, 30, 30)
      const blob = await new Promise<Blob>(resolve => canvas.toBlob(result => resolve(result!), "image/png"))
      const history = await archiveApi.attach(patientId, new File([blob], `prueba-${index + 1}.png`, { type: "image/png" }), { ...emptyFileDraft(), displayName: `Imagen de prueba ${index + 1}`, clinicalType: "fotografias", categoryId: catalog.categories[0].id, tagIds: [catalog.tags[0].id], studyDate: index ? "2026-11-18" : "2026-11-10", zone: "Zona de prueba", notes: "Solo rectángulos sintéticos" })
      ids.push(history.record.attachments.at(-1).id)
      queryClient.setQueryData(clinicalHistoryKeys.record(patientId), history)
    }
    queryClient.setQueryData(["clinical-history", "archive-catalog"], catalog)
    return ids
  }, { count, patientId })
}
export async function archiveChoice(page: Page, label: string, option: string, scope = page.getByRole("region", { name: "Archivo clínico", exact: true })) {
  await scope.getByLabel(label, { exact: true }).click()
  await page.getByRole("option", { name: option, exact: true }).click()
}
