import { test, expect, type Download, type Page } from "@playwright/test"

// Cada prueba corre en un contexto nuevo: IndexedDB vacía, semillas insertadas una vez y mocks en memoria
// recién cargados. `page.goto` recarga la app y reinicia los mocks en memoria (citas, asignaciones), así
// que las verificaciones entre módulos navegan dentro de la app.

async function login(page: Page, role = "admin") {
  await page.goto("/login")
  await page.getByLabel("Correo electrónico").fill(`${role}@clinica.com`)
  await page.locator("#password").fill(`${role}123`)
  await page.getByRole("button", { name: "Ingresar", exact: true }).click()
  await page.getByRole("button", { name: "Continuar", exact: true }).click()
  await expect(page).toHaveURL(/\/$/)
}

const frameOf = (page: Page) => page.frameLocator('iframe[title="Odontograma y periodontograma del paciente"]')

async function waitForChart(page: Page) {
  await expect(frameOf(page).locator("#toothGrid")).toBeVisible()
}

async function chooseOption(page: Page, label: string, option: string | RegExp) {
  await page.getByLabel(label, { exact: true }).click()
  await page.getByRole("option", { name: option }).click()
}

async function readDownload(download: Download) {
  const stream = await download.createReadStream()
  const chunks: Buffer[] = []
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk))
  return Buffer.concat(chunks)
}

async function waitForAutosave(page: Page) {
  await expect(page.getByRole("status").filter({ hasText: "Borrador guardado" })).toBeVisible()
}

async function closeVisit(page: Page) {
  await page.getByRole("button", { name: "Cerrar visita", exact: true }).click()
  await page.getByRole("alertdialog").getByRole("button", { name: "Cerrar visita", exact: true }).click()
  await expect(page.getByText("Visita cerrada · solo lectura")).toBeVisible()
}

test("visita completa: odontograma, validación, plan con catálogo, cierre y exportaciones", async ({ page }) => {
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  await login(page)

  // Paciente sin visitas: estado vacío y diálogo de nueva visita.
  await page.goto("/historial-clinico/paciente/pat_5")
  await expect(page.getByText("Aún no hay visitas registradas")).toBeVisible()
  await page.getByRole("button", { name: "Nueva visita", exact: true }).click()
  const dialog = page.getByRole("dialog")
  await expect(dialog.getByText("Primera visita del paciente")).toBeVisible()
  // La administradora no es profesional: el profesional se elige a mano.
  await chooseOption(page, "Profesional", /Dra\. Carla Ríos/)
  await dialog.getByRole("button", { name: "Iniciar visita" }).click()
  await expect(page.getByText("Borrador en edición")).toBeVisible()
  await waitForChart(page)
  await expect(page.getByRole("button", { name: "Cerrar visita", exact: true })).toBeEnabled()

  // Odontograma real dentro del iframe, con el tema de la app.
  const editor = frameOf(page)
  await expect(editor.locator("#toothGrid > *")).not.toHaveCount(0)
  await editor.getByRole("option", { name: "16", exact: true }).click()
  const [mobilityValue] = await editor.locator("#mobilitySelect").selectOption({ index: 1 })
  await editor.locator("#calculusRow label").click()
  await expect(editor.locator("#calculusToggle")).toBeChecked()
  await page.getByRole("button", { name: "Cambiar tema" }).click()
  await expect(page.locator("html")).toHaveClass(/dark/)
  await expect(editor.locator("html")).toHaveClass(/dark/)
  const outerColor = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue("--background").trim()
  )
  await expect
    .poll(async () =>
      editor.locator("html").evaluate((node) => getComputedStyle(node).getPropertyValue("--clinic-background").trim())
    )
    .toBe(outerColor)
  await page.screenshot({ path: "test-results/dental-dark.png", fullPage: true })
  await page.getByRole("button", { name: "Cambiar tema" }).click()
  await expect(page.locator("html")).not.toHaveClass(/dark/)

  await editor.locator("#appViewDentalChart").click()
  await expect(editor.locator("#perioInlinePanel")).toBeVisible()
  const measurement = editor.locator('input[data-perio$=":pd"]').first()
  const measurementKey = (await measurement.getAttribute("data-perio"))!
  await measurement.fill("5")
  await measurement.press("Tab")
  const margin = editor.locator(`input[data-perio="${measurementKey.replace(":pd", ":gm")}"]`)
  await margin.fill("2")
  await margin.press("Tab")
  await editor.locator(`input[data-perio="${measurementKey.replace(":pd", ":bop")}"]`).check()
  await editor.locator("button[data-furc-entrance]").first().click()
  await editor.locator("button[data-plaque-surface]").first().click()
  await editor.locator("#appViewOdontogram").click()

  // Cerrar sin datos obligatorios: errores en línea y salto a la pestaña con errores.
  await page.getByRole("tab", { name: "Plan de tratamiento", exact: true }).click()
  await page.getByRole("button", { name: "Cerrar visita", exact: true }).click()
  await expect(page.getByText("Describe el motivo de consulta")).toBeVisible()
  await expect(page.getByText("Registra el diagnóstico")).toBeVisible()
  const consultationTab = page.getByRole("tab", { name: "Evolución y diagnóstico Con errores", exact: true })
  await expect(consultationTab).toHaveAttribute("aria-selected", "true")

  await page.getByLabel("Motivo de consulta", { exact: true }).fill("Control odontológico de prueba")
  await page.getByLabel("Diagnóstico", { exact: true }).fill("Registro de hallazgos de prueba")
  await page.getByLabel("Evolución por visita", { exact: true }).fill("Evolución documentada en la visita inicial")
  await page.getByLabel("Procedimientos realizados", { exact: true }).fill("Evaluación y registro")
  await page.getByLabel("Notas profesionales", { exact: true }).fill("Nota de prueba <script>window.injected=true</script>")

  // Plan: tratamiento del catálogo aprobado para asignar al cerrar.
  await page.getByRole("tab", { name: "Plan de tratamiento", exact: true }).click()
  await chooseOption(page, "Tratamiento del catálogo", /^Limpieza dental/)
  await page.getByLabel("Pieza / zona", { exact: true }).fill("16")
  await page.getByLabel("Sesiones", { exact: true }).fill("2")
  await chooseOption(page, "Estado", "Aprobado · en curso")
  await page.getByRole("button", { name: "Agregar al plan" }).click()
  await expect(page.getByText("Se asigna al paciente al cerrar la visita")).toBeVisible()

  await page.getByRole("tab", { name: "Consentimientos", exact: true }).click()
  await page.getByRole("button", { name: "Agregar consentimiento" }).click()
  await page.getByLabel("Procedimiento autorizado").fill("Limpieza de prueba")
  await page.getByLabel("Información, riesgos y alternativas explicados").fill("Información de ejemplo proporcionada al paciente")
  await chooseOption(page, "Estado del consentimiento", "Firmado en documento")
  await page.getByLabel("Nombre del firmante").fill("Paciente de prueba")
  await page.getByLabel("Fecha de firma / decisión").fill("2026-09-20")

  await page.getByRole("tab", { name: "Fotos y documentos", exact: true }).click()
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jf1sAAAAASUVORK5CYII=",
    "base64"
  )
  await page
    .getByLabel("Seleccionar archivos clínicos")
    .setInputFiles({ name: "radiografia-prueba.png", mimeType: "image/png", buffer: png })
  await expect(page.getByText("radiografia-prueba.png", { exact: true })).toBeVisible()
  await waitForAutosave(page)

  // El borrador sobrevive a una recarga.
  await page.reload()
  await waitForChart(page)
  await page.getByRole("tab", { name: "Evolución y diagnóstico", exact: true }).click()
  await expect(page.getByLabel("Diagnóstico", { exact: true })).toHaveValue("Registro de hallazgos de prueba")

  await closeVisit(page)
  await expect(page.getByText("Se asignaron 1 tratamientos al paciente", { exact: false })).toBeVisible()

  // La asignación creada se ve en el plan y en el módulo de Tratamientos.
  await page.getByRole("tab", { name: "Plan de tratamiento", exact: true }).click()
  await expect(page.getByText("0/2 sesiones · En progreso")).toBeVisible()

  const jsonPromise = page.waitForEvent("download")
  await page.getByRole("button", { name: "Historia completa JSON" }).click()
  const record = JSON.parse((await readDownload(await jsonPromise)).toString())
  expect(record.visits).toHaveLength(1)
  const [visit] = record.visits
  expect(visit.status).toBe("cerrada")
  expect(visit.professionalId).toBe("prof_1")
  expect(visit.attachments).toHaveLength(1)
  expect(visit.plan[0]).toMatchObject({ treatmentId: "trt_1", status: "en-curso", sessions: 2 })
  expect(visit.plan[0].assignmentId).toBeTruthy()
  expect(visit.consents[0].status).toBe("firmado")
  const teeth = visit.chart.payload.teeth
  expect(teeth["16"].calculus).toBe(true)
  expect(teeth["16"].mobility).toBe(mobilityValue)
  const [measuredTooth, measuredSite] = measurementKey.split(":")
  expect(teeth[measuredTooth].perio.pd[measuredSite]).toBe(5)
  expect(teeth[measuredTooth].perio.gm[measuredSite]).toBe(2)
  expect(teeth[measuredTooth].perio.bop).toContain(measuredSite)

  const documentPromise = page.waitForEvent("download")
  await page.getByRole("button", { name: "Documento de la visita", exact: true }).click()
  const html = (await readDownload(await documentPromise)).toString()
  expect(html).toContain("&lt;script&gt;window.injected=true&lt;/script&gt;")
  expect(html).not.toContain("<script>")
  expect(html).toContain("Dra. Carla Ríos")
  // La imagen del odontograma viaja incrustada en el documento (y por tanto en el PDF impreso).
  const embedded = html.match(/<img src="data:image\/png;base64,([A-Za-z0-9+/]+=*)" alt="Odontograma de la visita">/)
  expect(embedded).not.toBeNull()
  expect(Buffer.from(embedded![1], "base64").subarray(1, 4).toString()).toBe("PNG")
  // Se exporta con la pestaña del odontograma oculta: la imagen no debe salir en blanco.
  const inkedSamples = await page.evaluate(async (src) => {
    const image = new Image()
    image.src = src
    await image.decode()
    const canvas = document.createElement("canvas")
    canvas.width = image.naturalWidth
    canvas.height = image.naturalHeight
    const context = canvas.getContext("2d")!
    context.drawImage(image, 0, 0)
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
    let inked = 0
    for (let index = 0; index < pixels.length; index += 4 * 97) {
      if (pixels[index] < 200 || pixels[index + 1] < 200 || pixels[index + 2] < 200) inked += 1
    }
    return inked
  }, `data:image/png;base64,${embedded![1]}`)
  expect(inkedSamples).toBeGreaterThan(200)

  // El menú «Exportar» del editor sigue descargando su propia imagen después de la captura.
  await page.getByRole("tab", { name: "Odontograma y periodontograma", exact: true }).click()
  const editorPngPromise = page.waitForEvent("download")
  await editor.locator("#btnExportMenu").click()
  await editor.getByRole("menuitem", { name: "Imagen PNG" }).click()
  const editorPng = await editorPngPromise
  expect(editorPng.suggestedFilename()).toMatch(/^odontogram-.*\.png$/)

  // «Imprimir / Guardar PDF» abre la ventana de impresión con la imagen incrustada.
  const popupPromise = page.waitForEvent("popup")
  await page.getByRole("button", { name: "Imprimir / Guardar PDF" }).click()
  const popup = await popupPromise
  await expect(popup.locator('img[alt="Odontograma de la visita"]')).toHaveCount(1)
  await expect.poll(() => popup.locator('img[alt="Odontograma de la visita"]').evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0)
  await popup.close()

  await page.getByRole("tab", { name: "Fotos y documentos", exact: true }).click()
  const attachmentPromise = page.waitForEvent("download")
  await page.getByRole("button", { name: "Descargar", exact: true }).click()
  expect(await readDownload(await attachmentPromise)).toEqual(png)

  // Indicadores calculados desde el periodontograma.
  await page.getByRole("tab", { name: "Seguimiento por visita", exact: true }).click()
  await expect(page.getByText("Sitios con bolsa ≥ 4 mm", { exact: true })).toBeVisible()

  // Segunda visita: parte del odontograma anterior y el ítem ya asignado no se arrastra.
  await page.getByRole("button", { name: "Nueva visita", exact: true }).click()
  await chooseOption(page, "Profesional", /Dra\. Carla Ríos/)
  await page.getByRole("dialog").getByRole("button", { name: "Iniciar visita" }).click()
  await expect(page.getByText("Borrador en edición")).toBeVisible()
  await waitForChart(page)
  await page.getByRole("tab", { name: "Evolución y diagnóstico", exact: true }).click()
  await expect(page.getByLabel("Diagnóstico", { exact: true })).toHaveValue("")
  await page.getByLabel("Motivo de consulta", { exact: true }).fill("Segunda visita")
  await page.getByLabel("Diagnóstico", { exact: true }).fill("Segundo registro")
  await page.getByRole("tab", { name: "Plan de tratamiento", exact: true }).click()
  await expect(page.getByText("Agrega tratamientos del catálogo al plan de la visita.")).toBeVisible()
  await closeVisit(page)
  await page.getByRole("tab", { name: "Seguimiento por visita", exact: true }).click()
  await expect(page.getByRole("button", { name: "Consultar visita", exact: true })).toHaveCount(1)
  await page.getByRole("button", { name: "Consultar visita", exact: true }).click()
  await page.getByRole("tab", { name: "Evolución y diagnóstico", exact: true }).click()
  await expect(page.getByLabel("Diagnóstico", { exact: true })).toHaveValue("Registro de hallazgos de prueba")
  await expect(page.getByLabel("Diagnóstico", { exact: true })).toHaveAttribute("readonly", "")

  // Navegando dentro de la app (sin recargar los mocks): el tratamiento quedó asignado a la paciente.
  await page.getByRole("tab", { name: "Plan de tratamiento", exact: true }).click()
  await page.getByRole("link", { name: "Limpieza dental" }).click()
  await expect(page).toHaveURL(/\/tratamientos\/trt_1$/)
  await expect(page.getByText(/Valentina/).first()).toBeVisible()

  // Aislamiento por paciente y visitas de ejemplo migradas del historial clásico.
  await page.goto("/historial-clinico/paciente/pat_1")
  await waitForChart(page)
  await page.getByRole("tab", { name: "Evolución y diagnóstico", exact: true }).click()
  await expect(page.getByLabel("Diagnóstico", { exact: true })).toHaveValue("Sin hallazgos relevantes.")
  await page.getByRole("tab", { name: "Fotos y documentos", exact: true }).click()
  await expect(page.getByText("radiografia-prueba.png", { exact: true })).toHaveCount(0)
  expect(errors).toEqual([])
})

test("la cita abre la visita vinculada y queda completada al cerrarla", async ({ page }) => {
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  await login(page, "medico")

  await page.goto("/historial-clinico/paciente/pat_2?cita=apt_2")
  const dialog = page.getByRole("dialog")
  await expect(dialog.getByText("Nueva visita", { exact: true })).toBeVisible()
  // La cita viene preseleccionada y define el profesional (el de la cita, no el del usuario).
  await expect(dialog.getByLabel("Profesional", { exact: true })).toContainText("Dr. Andrés Vega")
  await expect(dialog.getByLabel("Cita", { exact: true })).not.toContainText("Sin cita vinculada")
  await dialog.getByRole("button", { name: "Iniciar visita" }).click()
  await waitForChart(page)
  await page.getByRole("tab", { name: "Evolución y diagnóstico", exact: true }).click()
  await page.getByLabel("Motivo de consulta", { exact: true }).fill("Consulta agendada")
  await page.getByLabel("Diagnóstico", { exact: true }).fill("Caries en pieza 26")
  await expect(page.getByLabel("Cita vinculada", { exact: true })).not.toContainText("Sin cita vinculada")
  await closeVisit(page)
  await expect(page.getByText("La cita vinculada quedó como completada")).toBeVisible()
  expect(errors).toEqual([])
})

test("rutas antiguas redirigen a la historia del paciente", async ({ page }) => {
  await login(page)
  await page.goto("/historial-clinico/paciente/pat_1/odontologia")
  await expect(page).toHaveURL(/\/historial-clinico\/paciente\/pat_1$/)
  await page.goto("/historial-clinico/nuevo?pacienteId=pat_3")
  await expect(page).toHaveURL(/\/historial-clinico\/paciente\/pat_3$/)
  await page.goto("/historial-clinico/hist_1")
  await expect(page).toHaveURL(/\/historial-clinico$/)
  await expect(page.getByRole("cell", { name: "Sin hallazgos relevantes." })).toBeVisible()
})

test("recepción no puede acceder al módulo clínico", async ({ page }) => {
  await login(page, "recepcion")
  await page.goto("/historial-clinico/paciente/pat_1")
  await expect(page).toHaveURL(/\/403$/)
  await expect(page.locator("iframe")).toHaveCount(0)
})
