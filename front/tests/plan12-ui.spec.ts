import { expect, test } from "@playwright/test"

import { apiAs, createPatient, login, ok, today, unique } from "./helpers/api"

// Plan 12, puntos 2.2, 2.3, 2.6 y 4.2: la UI no muestra datos que la API no calcula y explica los errores en su campo.

test("Finanzas no muestra vencimientos, mora ni seguros (dependen del financiamiento de cada clínica)", async ({ page }) => {
  const api = await apiAs("admin")
  const stamp = unique()
  const patient = await createPatient(api, `Vence${stamp}`)
  const treatment = await ok(await api.post("treatments", { data: { name: `Limpieza ${stamp}`, category: "Prueba", durationMinutes: 30, price: 25, active: true, consumption: [] } }))
  await ok(await api.post("treatment-assignments", { data: { treatmentId: treatment.id, patientId: patient.id, date: today(), tooth: "", sourceEncounterId: null, sourceKey: `e2e:${stamp}`, price: 25 } }))

  await login(page, "admin")
  await page.goto("/finanzas")
  await expect(page.getByText("Total pendiente").first()).toBeVisible()
  await expect(page.getByText(`Vence${stamp} Prueba E2E`).filter({ visible: true }).first()).toBeVisible()
  for (const hidden of ["Total vencido", "Seguros pendientes", "Próximo venc.", "Días mora", "Vencido"]) await expect(page.getByText(hidden, { exact: true })).toHaveCount(0)

  await page.goto(`/pacientes/${patient.id}`)
  await page.getByRole("tab", { name: "Finanzas", exact: true }).click()
  await expect(page.getByText("Total pendiente").first()).toBeVisible()
  await expect(page.getByText("Total vencido", { exact: true })).toHaveCount(0)
  await expect(page.getByText(/Próximo vencimiento/)).toHaveCount(0)
})

test("el buscador de pacientes dice lo que busca el servidor", async ({ page }) => {
  await login(page, "recepcion")
  await page.goto("/pacientes")
  await expect(page.getByLabel("Buscar pacientes").first()).toHaveAttribute("placeholder", "Buscar por nombre, documento, teléfono o N.° de historia…")
})

test("un periodo de más de 366 días se explica junto al selector y no se pide al servidor", async ({ page }) => {
  const periods: string[] = []
  page.on("response", (response) => {
    const url = new URL(response.url())
    if (url.pathname.startsWith("/api/reports/")) periods.push(`${response.status()} ${url.searchParams.get("from")}..${url.searchParams.get("to")}`)
  })
  await login(page, "admin")
  await page.goto("/reportes")
  await page.locator("#desktopReportPreset").click()
  await page.getByRole("option", { name: "Personalizado", exact: true }).click()
  await page.locator("#desktopReportFrom").fill("2024-01-01")
  await page.locator("#desktopReportTo").fill("2026-01-01")

  await expect(page.locator("#reportPeriodError")).toHaveText(/El periodo no puede superar 366 días/)
  await expect(page.locator("#desktopReportTo")).toHaveAttribute("aria-invalid", "true")
  expect(periods.some((entry) => entry.includes("2024-01-01..2026-01-01"))).toBe(false)
  expect(periods.every((entry) => !entry.startsWith("400"))).toBe(true)
  // Los reportes siguen con el último periodo válido, sin el aviso de error genérico.
  await expect(page.getByText("No se pudo cargar este reporte")).toHaveCount(0)

  // Un periodo válido quita el aviso y se pide.
  await page.locator("#desktopReportFrom").fill("2025-06-01")
  await expect(page.locator("#reportPeriodError")).toHaveCount(0)
  await expect.poll(() => periods.some((entry) => entry === "200 2025-06-01..2026-01-01")).toBe(true)
})

test("Inicio muestra los tratamientos realizados este mes", async ({ page }) => {
  const api = await apiAs("admin")
  const stamp = unique()
  const patient = await createPatient(api, `Inicio${stamp}`)
  const treatment = await ok(await api.post("treatments", { data: { name: `Control ${stamp}`, category: "Prueba", durationMinutes: 30, price: 20, active: true, consumption: [] } }))
  await ok(await api.post("treatment-assignments", { data: { treatmentId: treatment.id, patientId: patient.id, date: today(), tooth: "", sourceEncounterId: null, sourceKey: `e2e:${stamp}`, price: 20 } }))

  const month = today().slice(0, 7)
  const last = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate()
  const summary = await ok(await api.get(`reports/summary?from=${month}-01&to=${month}-${last}`))
  expect(summary.treatmentsPerformed).toBeGreaterThanOrEqual(1)
  expect(summary).not.toHaveProperty("activeTreatments")

  await login(page, "admin")
  await page.goto("/")
  const card = page.locator(".clinic-kpi-card").filter({ hasText: "Tratamientos realizados este mes" })
  await expect(card.locator(".clinic-kpi-value")).toHaveText(String(summary.treatmentsPerformed))
  await expect(page.getByText("Tratamientos en curso")).toHaveCount(0)
})
