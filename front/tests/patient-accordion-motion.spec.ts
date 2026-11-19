import { setAccessTheme } from "./helpers/access-theme"
import { expect, test, type Page } from "@playwright/test"

test.use({ reducedMotion: "no-preference", timezoneId: "America/Guayaquil" })
const dialog = (page: Page) => page.getByRole("dialog", { name: /^(Nuevo|Editar) paciente$/ })
const trigger = (page: Page, key: string) => page.locator(`#patient-section-${key} [data-patient-section-trigger]`)
async function login(page: Page, theme: string) {
  await page.goto("/login")
  await setAccessTheme(page, theme === "light" ? "light" : "dark")
  await page.locator("#email").fill("admin@clinica.com")
  await page.locator("#password").fill("admin123")
  await page.getByRole("button", { name: "Ingresar", exact: true }).click()
  await page.getByRole("button", { name: "Continuar", exact: true }).click()
  await expect(page).toHaveURL(/\/$/)
  await page.goto("/pacientes")
  await page.evaluate(() => document.fonts.ready)
}
async function settled(page: Page, key: string | null) {
  await expect.poll(() => page.locator(".patient-section-panel:not([hidden])").count()).toBe(key ? 1 : 0)
  if (!key) return
  await expect(trigger(page, key)).toHaveAttribute("aria-expanded", "true")
  await expect.poll(() => page.locator(`#patient-section-${key} .patient-section-panel`).evaluate(panel => panel.getAnimations().filter(animation => animation.playState === "running").length)).toBe(0)
}
async function recordSwitch(page: Page, key: string) {
  return page.evaluate(async key => {
    const start = performance.now()
    const samples: { t: number; heights: number[]; opacity: number[]; visible: number; top: number; bottom: number; background: number; page: number }[] = []
    const root = document.querySelector<HTMLElement>('[data-slot="dialog-content"][data-open]')!
    const main = document.querySelector("main")!
    document.querySelector<HTMLButtonElement>(`#patient-section-${key} [data-patient-section-trigger]`)!.click()
    await new Promise<void>(resolve => {
      function frame(timestamp: number) {
        const panels = [...root.querySelectorAll<HTMLElement>(".patient-section-panel")]
        const box = root.getBoundingClientRect()
        // rAF timestamps share the CSS animation timeline; callback wall time can
        // run late under load and incorrectly attribute a dropped frame to a jump.
        samples.push({ t: timestamp - start, heights: panels.map(panel => panel.getBoundingClientRect().height), opacity: panels.map(panel => Number(getComputedStyle(panel).opacity)), visible: panels.filter(panel => !panel.hidden && panel.getBoundingClientRect().height > 0.5).length, top: box.top, bottom: box.bottom, background: main.scrollTop, page: window.scrollY })
        if (performance.now() - start < 750) requestAnimationFrame(frame)
        else resolve()
      }
      requestAnimationFrame(frame)
    })
    return samples
  }, key)
}

for (const theme of ["light", "dark"]) {
  test(`sequential measured motion and preserved drafts in both modal modes, ${theme}`, async ({ page }, testInfo) => {
    await login(page, theme)
    const measurements = []
    for (const mode of ["create", "edit"]) {
      if (mode === "create") await page.getByRole("button", { name: "Nuevo paciente", exact: true }).click()
      else {
        await page.getByRole("button", { name: "Acciones del paciente Valentina Suárez", exact: true }).click()
        await page.getByRole("menuitem", { name: "Editar paciente", exact: true }).click()
      }
      await settled(page, "personal")
      await page.locator("#firstName").fill("Borrador conservado")
      for (const [previous, next] of [[0, "contact"], [1, "emergency"], [2, "preferences"]] as const) {
        const samples = await recordSwitch(page, next)
        await testInfo.attach(`${mode}-${next}-frames`, { body: JSON.stringify(samples), contentType: "application/json" })
        const nextIndex = ["personal", "contact", "emergency", "preferences"].indexOf(next)
        expect(Math.max(...samples.map(sample => sample.visible))).toBe(1)
        const closed = samples.find(sample => sample.heights[previous] < 0.5)!
        const opening = samples.find(sample => sample.heights[nextIndex] > 0.5)!
        expect(closed.t).toBeLessThanOrEqual(opening.t)
        expect(closed.t).toBeGreaterThan(120)
        expect(closed.t).toBeLessThan(350)
        const finalHeight = samples.at(-1)!.heights[nextIndex]
        const opened = samples.find(sample => sample.heights[nextIndex] >= finalHeight - 0.5)!
        expect(opened.t - opening.t).toBeGreaterThan(140)
        expect(opened.t - opening.t).toBeLessThan(350)
        expect(samples.some(sample => sample.opacity[previous] > 0.1 && sample.opacity[previous] < 0.9)).toBe(true)
        expect(samples.some(sample => sample.opacity[nextIndex] > 0.1 && sample.opacity[nextIndex] < 0.9)).toBe(true)
        expect(new Set(samples.map(sample => sample.background)).size).toBe(1)
        expect(samples.every(sample => sample.page === 0)).toBe(true)
        // Centering follows the animated height, without any discontinuity at the handoff.
        const maximumSpeed = Math.max(...samples.flatMap(sample => sample.heights)) / 180 * 1.25
        for (let i = 1; i < samples.length; i++) {
          const elapsed = samples[i].t - samples[i - 1].t
          if (elapsed > 1 && elapsed < 35) expect(Math.abs(samples[i].top - samples[i - 1].top) / elapsed).toBeLessThan(maximumSpeed)
        }
        measurements.push({ mode, next, closedAt: closed.t, openedAt: opened.t, samples })
        await settled(page, next)
        if (next === "contact") await page.locator("#phone").fill("0987654321")
        if (next === "emergency") await page.locator("#insurancePolicy").fill("Borrador seguro")
      }
      await page.locator("#notes").fill("Borrador de observaciones")
      await trigger(page, "personal").click()
      await settled(page, "personal")
      await expect(page.locator("#firstName")).toHaveValue("Borrador conservado")
      await trigger(page, "personal").click()
      await settled(page, null)
      await dialog(page).getByRole("button", { name: "Cancelar", exact: true }).click()
      await page.getByRole("button", { name: "Descartar cambios", exact: true }).click()
      await expect(dialog(page)).toHaveCount(0)
    }
    await testInfo.attach("frame-measurements", { body: JSON.stringify(measurements), contentType: "application/json" })
  })

  test(`interrupted motion follows the last request and closes accessibly, ${theme}`, async ({ page }) => {
    const warnings: string[] = []
    page.on("console", message => { if (message.text().includes("Collapsible or Accordion panel")) warnings.push(message.text()) })
    await login(page, theme)
    await page.getByRole("button", { name: "Nuevo paciente", exact: true }).click()
    await settled(page, "personal")
    await page.locator("#firstName").focus()
    await page.evaluate(() => {
      for (const key of ["contact", "emergency", "preferences"]) document.querySelector<HTMLButtonElement>(`#patient-section-${key} [data-patient-section-trigger]`)!.click()
    })
    await expect(page.locator("#patient-section-personal .patient-section-panel")).toHaveAttribute("inert", "")
    await expect(page.locator("#firstName")).not.toBeFocused()
    await settled(page, "preferences")
    await page.evaluate(() => {
      for (const key of ["contact", "contact"]) document.querySelector<HTMLButtonElement>(`#patient-section-${key} [data-patient-section-trigger]`)!.click()
    })
    await settled(page, null)
    // Interrupt an opening animation, too, rather than only changing the close queue.
    await page.evaluate(() => document.querySelector<HTMLButtonElement>("#patient-section-emergency [data-patient-section-trigger]")!.click())
    await expect.poll(() => page.locator("#patient-section-emergency .patient-section-panel").evaluate(panel => panel.getBoundingClientRect().height)).toBeGreaterThan(1)
    await page.evaluate(() => document.querySelector<HTMLButtonElement>("#patient-section-personal [data-patient-section-trigger]")!.click())
    await settled(page, "personal")
    // Functional completion does not require CSS animations or a transitionend event.
    await page.addStyleTag({ content: ".patient-section-panel { animation: none !important; transition: none !important; }" })
    await trigger(page, "contact").click()
    await settled(page, "contact")
    await trigger(page, "contact").press("Space")
    await settled(page, null)
    expect(warnings).toEqual([])
  })

  for (const width of [375, 1024]) {
    test(`animated validation focuses after expansion and saves with a stable background, ${theme}, ${width}`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 900 })
      await login(page, theme)
      await page.getByRole("button", { name: "Nuevo paciente", exact: true }).click()
      await settled(page, "personal")
      await page.locator("#firstName").fill("Elena")
      await page.locator("#lastName").fill("Guerrero")
      await page.locator("#documentId").fill("0100000009")
      await page.locator("#birthDate").fill("1995-11-14")
      await trigger(page, "contact").click()
      await settled(page, "contact")
      await page.locator("#phone").fill("abc")
      await trigger(page, "preferences").click()
      await settled(page, "preferences")
      await page.locator("#notes").fill("Observaciones conservadas durante la animación")
      const background = await page.locator("main").evaluate(main => main.scrollTop)
      await dialog(page).getByRole("button", { name: "Crear paciente", exact: true }).click()
      await expect(page.locator("#phone")).toBeFocused()
      await settled(page, "contact")
      await expect.poll(() => page.locator("#phone").evaluate(field => {
        const bounds = field.closest(".patient-form-sections")!.getBoundingClientRect()
        const box = field.getBoundingClientRect()
        return box.top >= bounds.top && box.bottom <= bounds.bottom
      })).toBe(true)
      expect(await page.locator("main").evaluate(main => main.scrollTop)).toBe(background)
      expect(await page.locator("#phone").evaluate(field => field.closest(".patient-section-panel")!.getAnimations().filter(animation => animation.playState === "running").length)).toBe(0)
      await page.screenshot({ path: testInfo.outputPath(`validation-${theme}-${width}.png`) })
      await page.locator("#phone").fill("0987654321")
      await dialog(page).getByRole("button", { name: "Crear paciente", exact: true }).click()
      await expect(dialog(page)).toHaveCount(0)
      await expect(page.getByRole("button", { name: "Acciones del paciente Elena Guerrero", exact: true })).toBeVisible()
      await page.getByRole("button", { name: "Acciones del paciente Elena Guerrero", exact: true }).click()
      await page.getByRole("menuitem", { name: "Editar paciente", exact: true }).click()
      await settled(page, "personal")
      await trigger(page, "preferences").click()
      await settled(page, "preferences")
      await expect(page.locator("#notes")).toHaveValue("Observaciones conservadas durante la animación")
      await page.locator("#notes").fill("Actualización conservada")
      await dialog(page).getByRole("button", { name: "Guardar cambios", exact: true }).click()
      await expect(dialog(page)).toHaveCount(0)
    })
  }
}
