import { expect, test, type Page } from "@playwright/test"

const widths = [320, 360, 375, 390, 430, 600, 768, 1024, 1280, 1440, 1920]
const modules = [
  ["Panel", "/"], ["Pacientes", "/pacientes"],
  ["Formulario de paciente", "/pacientes/nuevo"], ["Detalle de paciente", "/pacientes/pat_1"],
  ["Citas", "/citas"], ["Historial clínico", "/historial-clinico"],
  ["Historia del paciente", "/historial-clinico/paciente/pat_1?visita=hist_1"],
  ["Tratamientos", "/tratamientos"], ["Formulario de tratamiento", "/tratamientos/nuevo"],
  ["Detalle de tratamiento", "/tratamientos/trt_1"], ["Inventario", "/inventario"],
  ["Formulario de insumo", "/inventario/nuevo"], ["Detalle de insumo", "/inventario/inv_1"],
  ["Notificaciones", "/notificaciones"], ["Finanzas", "/finanzas"], ["Reportes", "/reportes"],
  ["Perfil de usuario", "/perfil-usuario"], ["Perfil institucional", "/perfil-institucion"],
] as const

async function login(page: Page, theme: "light" | "dark") {
  await page.goto("/login")
  await page.getByRole("button", { name: theme === "dark" ? "Tema oscuro" : "Tema claro", exact: true }).click()
  await expect(page.locator(".auth-brand-mark")).toHaveCSS("background-color", theme === "light" ? "rgb(83, 80, 204)" : "rgb(228, 242, 34)")
  await page.locator("#email").fill("admin@clinica.com")
  await page.locator("#password").fill("admin123")
  await page.getByRole("button", { name: "Ingresar", exact: true }).click()
  await page.getByRole("button", { name: "Continuar", exact: true }).click()
  await expect(page).toHaveURL(/\/$/)
  await page.mouse.move(0, 0)
}

async function geometry(page: Page) {
  return page.evaluate(() => {
    const visible = (element: Element) => {
      const style = getComputedStyle(element)
      return element.getClientRects().length > 0 && style.visibility !== "hidden" &&
        !element.closest('[aria-hidden="true"], [inert], .sr-only')
    }
    const controls = [...document.querySelectorAll<HTMLElement>('button, input:not([type="hidden"]), textarea, select, [role="combobox"]')]
      .filter(visible).filter((element) => !element.closest('[data-slot="table-container"], .rbc-calendar, .recharts-wrapper'))
    const outside = controls.filter((element) => {
      const rect = element.getBoundingClientRect()
      const clippedLabel = element.matches('button:not([role="combobox"])') && element.scrollWidth > element.clientWidth + 2
      return rect.left < -1 || rect.right > innerWidth + 1 || clippedLabel
    }).map((element) => ({ tag: element.tagName, text: element.getAttribute("aria-label") || element.textContent?.slice(0, 65), id: element.id }))
    const unlabeled = controls.filter((element) => element.matches("input, textarea, select")).filter((element) => {
      const field = element as HTMLInputElement
      return !field.labels?.length && !element.getAttribute("aria-label") && !element.getAttribute("aria-labelledby")
    }).map((element) => element.id || element.getAttribute("placeholder") || element.tagName)
    const primaryButtons = [...document.querySelectorAll<HTMLElement>('main [data-slot="button"][data-variant="default"]:not(:disabled)')]
      .filter(visible).map((element) => ({
        name: element.textContent?.trim(), background: getComputedStyle(element).backgroundColor,
        foreground: getComputedStyle(element).color,
      }))
    return { width: innerWidth, page: document.documentElement.scrollWidth, outside, unlabeled, primaryButtons }
  })
}

async function contrastFailures(page: Page) {
  return page.evaluate(() => {
    const context = document.createElement("canvas").getContext("2d")!
    const luminance = (rgb: number[]) => {
      const values = rgb.map((value) => value / 255).map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
      return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722
    }
    return [...document.querySelectorAll<HTMLElement>('[data-slot="button"], [data-slot="field-label"], [data-slot="table-head"], [data-slot="select-trigger"], .clinic-sidebar-link')]
      .filter((element) => element.getClientRects().length && getComputedStyle(element).visibility !== "hidden" && !element.closest('[disabled], [aria-disabled="true"], [aria-hidden="true"], [inert], .sr-only'))
      .map((element) => {
        context.clearRect(0, 0, 1, 1)
        context.fillStyle = "white"
        context.fillRect(0, 0, 1, 1)
        const ancestors = []
        for (let current: HTMLElement | null = element; current; current = current.parentElement) ancestors.unshift(current)
        for (const current of ancestors) {
          context.fillStyle = getComputedStyle(current).backgroundColor
          context.fillRect(0, 0, 1, 1)
        }
        const background = [...context.getImageData(0, 0, 1, 1).data].slice(0, 3)
        context.fillStyle = getComputedStyle(element).color
        context.fillRect(0, 0, 1, 1)
        const text = [...context.getImageData(0, 0, 1, 1).data].slice(0, 3)
        const levels = [luminance(background), luminance(text)].sort((a, b) => b - a)
        return { name: element.getAttribute("aria-label") || element.textContent?.trim().slice(0, 60), ratio: (levels[0] + 0.05) / (levels[1] + 0.05) }
      }).filter((result) => result.ratio < 4.5)
  })
}

for (const theme of ["light", "dark"] as const) {
  for (const [name, route] of modules) {
    test(`${name}: all 11 widths in ${theme}`, async ({ page }, testInfo) => {
      await login(page, theme)
      await page.goto(route)
      await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible()
      await expect(page.getByText("Página no encontrada", { exact: true })).toHaveCount(0)
      await expect(page.locator('[data-slot="skeleton"]')).toHaveCount(0)
      if (route.includes("?visita=")) await expect(page.frameLocator("iframe").locator("#toothGrid > *").first()).toBeVisible()
      const measured = []
      for (const width of widths) {
        await page.setViewportSize({ width, height: 1000 })
        await expect.poll(async () => (await geometry(page)).outside, {
          message: `${name} ${theme} ${width}px controls after responsive layout settles`,
        }).toEqual([])
        const result = await geometry(page)
        expect(result.page, `${name} ${theme} ${width}px page overflow`).toBeLessThanOrEqual(width)
        expect(result.outside, `${name} ${theme} ${width}px clipped controls`).toEqual([])
        expect(result.unlabeled, `${name} unlabeled inputs`).toEqual([])
        for (const button of result.primaryButtons) {
          expect(button.background, `${name} ${width}px primary: ${button.name}`).toBe(theme === "light" ? "rgb(83, 80, 204)" : "rgb(228, 242, 34)")
          expect(button.foreground, `${name} ${width}px primary text: ${button.name}`).toBe(theme === "light" ? "rgb(255, 255, 255)" : "rgb(8, 9, 10)")
        }
        if (width === 1440) expect(await contrastFailures(page), `${name} ${theme} text contrast`).toEqual([])
        const header = page.locator(".clinic-app-header")
        if (await header.count()) {
          await expect(header).toHaveCSS("background-color", theme === "light" ? "rgb(255, 255, 255)" : "rgb(15, 16, 17)")
          await expect(page.locator(".clinic-app-sidebar .clinic-brand-mark")).toHaveCSS("background-color", theme === "light" ? "rgb(83, 80, 204)" : "rgb(228, 242, 34)")
          const activeLinks = page.locator('.clinic-app-sidebar .clinic-sidebar-link[aria-current="page"]')
          for (const link of await activeLinks.all()) await expect(link).toHaveCSS("color", theme === "light" ? "rgb(83, 80, 204)" : "rgb(255, 255, 255)")
          if (width < 1024) {
            await expect(page.locator(".clinic-app-sidebar")).toBeHidden()
            await expect(page.getByRole("button", { name: "Abrir menú", exact: true })).toBeVisible()
          }
        }
        measured.push({ module: name, theme, ...result })
      }
      await testInfo.attach("responsive-matrix", { body: JSON.stringify(measured, null, 2), contentType: "application/json" })
    })
  }
}
