import { test, expect, type Page } from "@playwright/test"

async function login(page: Page) {
  await page.goto("/login")
  await page.getByLabel("Correo electrónico").fill("admin@clinica.com")
  await page.locator("#password").fill("admin123")
  await page.getByRole("button", { name: "Ingresar", exact: true }).click()
  await page.getByRole("button", { name: "Continuar", exact: true }).click()
  await expect(page).toHaveURL(/\/$/)
}

async function setTheme(page: Page, theme: "dark" | "light") {
  const currentIsDark = await page.locator("html").evaluate((element) => element.classList.contains("dark"))
  if (currentIsDark !== (theme === "dark")) {
    const currentThemeButton = currentIsDark ? "Modo oscuro" : "Modo claro"
    await page.getByRole("button", { name: currentThemeButton, exact: true }).click()
  }
  await expect.poll(() =>
    page.locator("html").evaluate((element) => element.classList.contains("dark"))
  ).toBe(theme === "dark")
}

test("shared Linear tokens follow both themes without altering clinical components", async ({ page }) => {
  await page.goto("/login")
  await expect.poll(() =>
    page.locator("html").evaluate((element) => element.classList.contains("dark"))
  ).toBe(false)

  await login(page)

  await setTheme(page, "dark")
  await expect.poll(() =>
    page.locator("main").evaluate((element) => getComputedStyle(element).backgroundColor)
  ).toBe("rgb(8, 9, 10)")
  await expect.poll(() =>
    page.locator("[data-slot='card']").first().evaluate((element) => getComputedStyle(element).backgroundColor)
  ).toBe("rgb(15, 16, 17)")
  await expect.poll(() =>
    page.locator(".clinic-pilot-primary-button").evaluate((element) => getComputedStyle(element).backgroundColor)
  ).toBe("rgb(228, 242, 34)")

  await page.goto("/pacientes")
  await expect(page.getByRole("textbox", { name: "Buscar pacientes" })).toBeVisible()
  await expect.poll(() =>
    page.locator(".clinic-patients-table [data-slot='table-container']")
      .evaluate((element) => getComputedStyle(element).backgroundColor)
  ).toBe("rgb(15, 16, 17)")

  await setTheme(page, "light")
  await expect.poll(() =>
    page.locator("main").evaluate((element) => getComputedStyle(element).backgroundColor)
  ).toBe("rgb(247, 247, 248)")
  await expect.poll(() =>
    page.locator(".clinic-pilot-primary-button").evaluate((element) => getComputedStyle(element).backgroundColor)
  ).toBe("rgb(83, 80, 204)")

  await page.goto("/historial-clinico/paciente/pat_1?visita=hist_1")
  await expect(page.locator(".clinic-clinical-shell")).toBeVisible()
  await expect(page.locator(".clinic-admin-shell")).toHaveCount(0)
  await expect.poll(() =>
    page.locator("main").evaluate((element) => getComputedStyle(element).backgroundColor)
  ).toBe("rgb(247, 247, 248)")
})
