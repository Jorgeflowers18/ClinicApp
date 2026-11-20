import { expect, type Page } from "@playwright/test"

export const encounterStepNames = ["Motivo", "Signos vitales y riesgo", "Examen clínico", "Diagnóstico y pronóstico", "Tratamientos y evolución", "Revisión"]
export const activeEncounterStep = (page: Page) => page.locator('[data-encounter-step]:not([hidden])')
export const encounterStepSelector = (page: Page) => page.getByRole("combobox", { name: "Paso de la atención", exact: true })

export async function selectEncounterStep(page: Page, name: string) {
  const selector = encounterStepSelector(page)
  if (await selector.textContent() && (await selector.locator('[data-slot="select-value"]').textContent()) === name) return
  await selector.click()
  const index = encounterStepNames.indexOf(name)
  await page.getByRole("option", { name: `${index + 1}. ${name}`, exact: true }).click()
  await expect(selector).toContainText(name)
}

export async function openEncounterGroup(page: Page, id: string) {
  const group = activeEncounterStep(page).locator(`[data-encounter-group="${id}"]`)
  const trigger = group.locator(".clinic-encounter-group-trigger")
  if (await trigger.getAttribute("aria-expanded") !== "true") await trigger.click()
  await expect(trigger).toHaveAttribute("aria-expanded", "true")
  await expect(group.locator(".clinic-encounter-group-panel")).not.toHaveAttribute("hidden", "")
  await group.locator(".clinic-encounter-group-panel").evaluate(async panel => {
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
    await Promise.allSettled(panel.getAnimations().map(animation => animation.finished))
  })
}
