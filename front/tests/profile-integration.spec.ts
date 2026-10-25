import { expect, test, type Locator, type Page } from "@playwright/test"

const widths = [320, 360, 375, 390, 430, 600, 768, 1024, 1280, 1440, 1920]
const photo = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII="

async function expectLogo(logo: Locator, theme: "light" | "dark") {
  await expect(logo).toHaveCSS("background-color", theme === "light" ? "rgb(83, 80, 204)" : "rgb(228, 242, 34)")
  await expect(logo).toHaveCSS("color", theme === "light" ? "rgb(255, 255, 255)" : "rgb(8, 9, 10)")
  await expect(logo).toHaveCSS("border-radius", "12px")
  const rect = await logo.boundingBox()
  expect(rect!.width).toBe(rect!.height)
}

async function enter(page: Page, theme: "light" | "dark", role = "admin") {
  await page.goto("/login")
  await page.getByRole("button", { name: theme === "light" ? "Tema claro" : "Tema oscuro", exact: true }).click()
  await page.locator("#email").fill(`${role}@clinica.com`)
  await page.locator("#password").fill(`${role}123`)
  await page.getByRole("button", { name: "Ingresar", exact: true }).click()
  await expect(page.getByRole("heading", { name: "Completa tu perfil", exact: true })).toBeVisible()
}

async function session(page: Page) {
  return page.evaluate(() => JSON.parse(sessionStorage.getItem("clinicapp.mock-session")!))
}

for (const theme of ["light", "dark"] as const) {
  test(`adaptive logos and initial setup preserve the existing redirect and draft in ${theme}`, async ({ page }, testInfo) => {
    await page.goto("/login")
    await page.getByRole("button", { name: theme === "light" ? "Tema claro" : "Tema oscuro", exact: true }).click()
    for (const path of ["/login", "/recuperar-contrasena", "/solicitar-acceso"]) {
      await page.goto(path)
      await expectLogo(page.locator('[data-slot="brand-logo"]'), theme)
    }
    await enter(page, theme)
    await expect(page.locator(".clinic-app-shell")).toHaveCount(0)
    await page.goto("/pacientes")
    await expect(page).toHaveURL(/\/perfil-usuario$/)
    await page.getByLabel("Cargo", { exact: true }).fill("Directora clínica")
    const measurements = []
    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 })
      await expectLogo(page.locator('[data-slot="brand-logo"]'), theme)
      const layout = await page.evaluate(() => {
        const controls = [...document.querySelectorAll<HTMLElement>('button, input:not([type="file"]), textarea, .clinic-file-upload')]
        return {
          width: innerWidth, scroll: document.documentElement.scrollWidth,
          outside: controls.filter((element) => {
            const rect = element.getBoundingClientRect()
            return rect.left < 0 || rect.right > innerWidth
          }).map((element) => element.id || element.textContent),
        }
      })
      expect(layout.scroll).toBeLessThanOrEqual(width)
      expect(layout.outside).toEqual([])
      measurements.push({ theme, ...layout })
    }
    await testInfo.attach("initial-setup-responsive", { body: JSON.stringify(measurements), contentType: "application/json" })
    await page.getByRole("button", { name: theme === "dark" ? "Cambiar a tema claro" : "Cambiar a tema oscuro" }).click()
    await expect(page.getByLabel("Cargo", { exact: true })).toHaveValue("Directora clínica")
    await expectLogo(page.locator('[data-slot="brand-logo"]'), theme === "dark" ? "light" : "dark")
    await page.getByRole("button", { name: "Continuar", exact: true }).click()
    await expect(page).toHaveURL(/\/pacientes$/)
    expect((await session(page)).user.profile.title).toBe("Directora clínica")
  })

  test(`profile editing keeps the main layout, saves real fields and preserves avatars in ${theme}`, async ({ page }) => {
    await enter(page, theme)
    await page.getByRole("button", { name: "Continuar", exact: true }).click()
    await expect(page).toHaveURL(/\/$/)
    const before = await session(page)
    const menu = page.locator(".clinic-app-sidebar")
    await menu.getByRole("link", { name: "Mi perfil", exact: true }).click()
    await expect(page.getByRole("heading", { name: "Mi perfil", exact: true })).toBeVisible()
    await expect(page.getByText("Administra tu información personal y profesional", { exact: true })).toBeVisible()
    await expect(page.getByText("Configuración inicial", { exact: true })).toHaveCount(0)
    await expect(page.getByRole("button", { name: "Continuar", exact: true })).toHaveCount(0)
    await expect(page.locator(".clinic-app-shell")).toHaveCount(1)
    await expect(menu.locator('a[aria-current="page"]')).toHaveCount(1)
    await expect(menu.getByRole("link", { name: "Mi perfil", exact: true })).toHaveAttribute("aria-current", "page")
    await expect(menu.getByRole("link", { name: "Perfil institucional", exact: true })).not.toHaveAttribute("aria-current", "page")
    await page.getByLabel("Nombre completo", { exact: true }).fill("  Ana Morales  ")
    await page.getByLabel("Cargo", { exact: true }).fill("  Directora  ")
    await page.getByLabel("Especialidad", { exact: true }).fill("Odontología")
    await page.getByLabel("Biografía breve", { exact: true }).fill("  Atención integral  ")
    await page.getByRole("button", { name: "Seleccionar color #7c3aed", exact: true }).click()
    await page.locator('input[type="file"]').setInputFiles({ name: "avatar.png", mimeType: "image/png", buffer: Buffer.from(photo, "base64") })
    await expect(page.getByRole("img", { name: "Avatar del usuario", exact: true })).toBeVisible()
    const draft = await page.getByLabel("Biografía breve", { exact: true }).inputValue()
    await menu.getByRole("button", { name: theme === "dark" ? "Modo oscuro" : "Modo claro", exact: true }).click()
    await expect(page.getByLabel("Biografía breve", { exact: true })).toHaveValue(draft)
    await page.getByRole("button", { name: "Guardar cambios", exact: true }).click()
    await expect(page).toHaveURL(/\/$/)
    const saved = await session(page)
    expect(saved.accessToken).toBe(before.accessToken)
    expect(saved.user.role).toBe(before.user.role)
    expect(saved.user.profile).toEqual({
      fullName: "Ana Morales", title: "Directora", specialty: "Odontología", bio: "Atención integral",
      avatarColor: "#7c3aed", avatarImage: `data:image/png;base64,${photo}`,
    })
    await page.goto("/perfil-usuario")
    await expect(page.getByLabel("Nombre completo", { exact: true })).toHaveValue("Ana Morales")
    await expect(page.getByRole("img", { name: "Avatar del usuario", exact: true })).toHaveAttribute("src", saved.user.profile.avatarImage)
    await expect(page.getByRole("button", { name: "Seleccionar color #7c3aed", exact: true })).toHaveCSS("background-color", "rgb(124, 58, 237)")
    await page.setViewportSize({ width: 320, height: 640 })
    await page.getByRole("button", { name: "Abrir menú", exact: true }).click()
    const mobile = page.locator(".clinic-app-sidebar-panel")
    await mobile.getByRole("link", { name: "Perfil institucional", exact: true }).click()
    await expect(mobile).toBeHidden()
    await expect(page.getByRole("heading", { name: "Perfil institucional", exact: true })).toBeVisible()
    await page.getByRole("button", { name: "Abrir menú", exact: true }).click()
    await expect(mobile.locator('a[aria-current="page"]')).toHaveCount(1)
    await expect(mobile.getByRole("link", { name: "Perfil institucional", exact: true })).toHaveAttribute("aria-current", "page")
    await mobile.getByRole("link", { name: "Mi perfil", exact: true }).click()
    await expect(page.getByLabel("Nombre completo", { exact: true })).toHaveValue("Ana Morales")
  })

  test(`institution fields, branches and custom clinic logos retain their identity in ${theme}`, async ({ page }) => {
    await enter(page, theme)
    await page.getByRole("button", { name: "Continuar", exact: true }).click()
    await page.goto("/perfil-institucion")
    await expect(page.locator(".clinic-app-header")).toBeVisible()
    await expectLogo(page.locator("main [data-slot=brand-logo]"), theme)
    const text = page.getByLabel("Texto del logo", { exact: true })
    await text.fill("CD")
    await expect(page.locator("main .clinic-institution-mark")).toHaveCSS("background-color", "rgb(83, 80, 204)")
    await page.getByLabel("Nombre de la clínica", { exact: true }).fill("Clínica de prueba")
    await page.getByRole("button", { name: "Crear sede", exact: true }).first().click()
    await page.getByLabel("Nombre de la sede", { exact: true }).fill("Sede Centro")
    await page.getByRole("button", { name: "Guardar cambios", exact: true }).click()
    await page.reload()
    await expect(page.getByLabel("Nombre de la clínica", { exact: true })).toHaveValue("Clínica de prueba")
    await expect(page.getByLabel("Nombre de la sede", { exact: true })).toHaveValue("Sede Centro")
    await page.locator('input[type="file"]').setInputFiles({ name: "clinic.png", mimeType: "image/png", buffer: Buffer.from(photo, "base64") })
    await page.getByRole("button", { name: "Guardar cambios", exact: true }).click()
    await page.getByRole("button", { name: theme === "dark" ? "Modo oscuro" : "Modo claro", exact: true }).click()
    await expect(page.getByRole("img", { name: "Logo de la clínica", exact: true })).toHaveAttribute("src", `data:image/png;base64,${photo}`)
    await page.getByRole("button", { name: "Salir", exact: true }).click()
    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByRole("img", { name: "Logo de la clínica", exact: true })).toHaveAttribute("src", `data:image/png;base64,${photo}`)
    await page.getByRole("link", { name: "Solicitar acceso", exact: true }).click()
    await expect(page.getByRole("img", { name: "Logo de la clínica", exact: true })).toHaveAttribute("src", `data:image/png;base64,${photo}`)
  })
}

for (const role of ["admin", "medico", "recepcion"]) {
  test(`${role} keeps the same profile access and institutional permission`, async ({ page }) => {
    await enter(page, "light", role)
    await page.getByRole("button", { name: "Continuar", exact: true }).click()
    await page.goto("/perfil-usuario")
    await expect(page.getByRole("heading", { name: "Mi perfil", exact: true })).toBeVisible()
    await expect(page.locator(".clinic-app-sidebar").getByRole("link", { name: "Perfil institucional", exact: true })).toHaveCount(role === "admin" ? 1 : 0)
    await page.goto("/perfil-institucion")
    if (role === "admin") {
      await expect(page.getByRole("heading", { name: "Perfil institucional", exact: true })).toBeVisible()
    } else {
      await expect(page).toHaveURL(/\/403$/)
    }
  })
}
