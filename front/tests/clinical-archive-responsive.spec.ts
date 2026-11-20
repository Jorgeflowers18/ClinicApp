import { expect, test } from "@playwright/test"
import { loginArchive, openArchive, seedArchive } from "./helpers/clinical-archive"

test.use({ timezoneId: "America/Guayaquil", reducedMotion: "reduce" })
for (const theme of ["light", "dark"] as const) {
  test(`archive gallery, list, upload and comparator fit twelve widths in ${theme}`, async ({ page }, testInfo) => {
    test.setTimeout(180000)
    const errors: string[] = []
    page.on("pageerror", error => errors.push(error.message))
    await loginArchive(page, theme)
    await seedArchive(page)
    await openArchive(page)
    const matrix = []
    for (const width of [320, 360, 375, 390, 430, 600, 768, 1024, 1280, 1440, 1920, 2560]) {
      await page.setViewportSize({ width, height: 900 })
      await page.waitForTimeout(100)
      for (const view of ["galería", "lista"]) {
        await page.getByRole("button", { name: `Vista de ${view}`, exact: true }).click()
        const geometry = await page.getByRole("region", { name: "Archivo clínico", exact: true }).evaluate(node => {
          const bounds = node.getBoundingClientRect()
          const controls = [...node.querySelectorAll<HTMLElement>("button,input,table")].filter(item => { const box = item.getBoundingClientRect(); return box.width > 4 && box.height > 4 && getComputedStyle(item).visibility !== "hidden" && !item.closest("[inert]") })
          return { bounds: bounds.toJSON(), pageWidth: document.documentElement.scrollWidth, overflow: controls.filter(item => { const box = item.getBoundingClientRect(); return box.left < bounds.left - 1 || box.right > bounds.right + 1 }).map(item => item.getAttribute("aria-label") || item.textContent) }
        })
        expect(geometry.pageWidth, `${width} ${view}`).toBeLessThanOrEqual(width)
        expect(geometry.overflow, `${width} ${view}`).toEqual([])
        matrix.push({ width, view, ...geometry })
      }
      await page.getByRole("button", { name: "Adjuntar archivos", exact: true }).click()
      const upload = page.getByRole("dialog", { name: "Adjuntar archivos clínicos", exact: true })
      const box = await upload.boundingBox()
      expect(box!.x).toBeGreaterThanOrEqual(0)
      expect(box!.x + box!.width).toBeLessThanOrEqual(width)
      await upload.getByRole("button", { name: /^Clasificación clínica/ }).click()
      await expect(upload.getByRole("button", { name: /^Archivos/ })).toHaveAttribute("aria-expanded", "false")
      await expect(upload.getByRole("button", { name: "Guardar archivos", exact: true })).toBeInViewport()
      expect(await upload.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBeTruthy()
      await upload.getByRole("button", { name: "Cancelar", exact: true }).click()
      if ([375, 1440, 2560].includes(width)) await page.screenshot({ path: `test-results/clinical-archive/archive-${theme}-${width}.png` })
    }
    await page.setViewportSize({ width: 1440, height: 650 })
    await page.locator(".clinic-app-header [data-sidebar-toggle]").click()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1440)
    // Layout equivalent of 200% browser zoom: half the CSS viewport, including short height.
    await page.setViewportSize({ width: 720, height: 450 })
    await page.getByRole("button", { name: "Adjuntar archivos", exact: true }).click()
    const short = page.getByRole("dialog", { name: "Adjuntar archivos clínicos", exact: true })
    await short.getByRole("button", { name: /^Información adicional/ }).click()
    await expect(short.getByRole("button", { name: "Cancelar", exact: true })).toBeInViewport()
    await short.getByRole("button", { name: "Cancelar", exact: true }).click()
    await page.setViewportSize({ width: 390, height: 844 })
    await page.getByRole("checkbox", { name: "Comparar Imagen de prueba 1", exact: true }).check()
    await page.getByRole("checkbox", { name: "Comparar Imagen de prueba 2", exact: true }).check()
    await page.getByRole("button", { name: "Comparar", exact: true }).click()
    const comparator = page.getByRole("dialog", { name: "Comparación visual de imágenes", exact: true })
    await expect(comparator.locator("img")).toHaveCount(2)
    expect(await comparator.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBeTruthy()
    await comparator.screenshot({ path: `test-results/clinical-archive/compare-${theme}-mobile.png` })
    await comparator.getByRole("button", { name: "Cerrar", exact: true }).click()
    expect(errors).toEqual([])
    await testInfo.attach(`responsive-${theme}.json`, { body: JSON.stringify(matrix, null, 2), contentType: "application/json" })
  })
}
