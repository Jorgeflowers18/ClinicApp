import type { Page } from "@playwright/test"

/** The public access screens reuse the same approved switch as the Header. */
export async function setAccessTheme(page: Page, theme: string) {
  await page.locator(".auth-toolbar").getByRole("switch", { name: "Modo oscuro", exact: true }).setChecked(theme === "dark")
}
