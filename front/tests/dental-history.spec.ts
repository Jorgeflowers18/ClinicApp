import { test, expect, type Download, type Locator, type Page } from "@playwright/test"

// Cada prueba corre en un contexto nuevo: IndexedDB vacía, semillas insertadas una vez y mocks en memoria
// recién cargados. `page.goto` recarga la app y reinicia los mocks en memoria (pacientes, citas,
// asignaciones), así que las verificaciones entre módulos navegan dentro de la app.

async function login(page: Page, role = "admin") {
  await page.goto("/login")
  await page.getByLabel("Correo electrónico").fill(`${role}@clinica.com`)
  await page.locator("#password").fill(`${role}123`)
  await page.getByRole("button", { name: "Ingresar", exact: true }).click()
  await page.getByRole("button", { name: "Continuar", exact: true }).click()
  await expect(page).toHaveURL(/\/$/)
}

/** Editor de la historia. Mientras hay otro diálogo con editor abierto, usar el del diálogo. */
const frameOf = (page: Page) => page.frameLocator('iframe[title="Odontograma y periodontograma del paciente"]').first()

async function waitForChart(page: Page) {
  await expect(frameOf(page).locator("#toothGrid")).toBeVisible()
  await expect(page.getByRole("button", { name: "Registrar atención", exact: true }).first()).toBeEnabled()
}

async function chooseOption(scope: Page | Locator, page: Page, label: string, option: string | RegExp) {
  await scope.getByLabel(label, { exact: true }).click()
  await page.getByRole("option", { name: option }).click()
}

const radio = (scope: Page | Locator, group: string, option: string) =>
  scope.getByRole("radiogroup", { name: group, exact: true }).getByRole("radio", { name: option, exact: true })

async function readDownload(download: Download) {
  const stream = await download.createReadStream()
  const chunks: Buffer[] = []
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk))
  return Buffer.concat(chunks)
}

async function downloadJson(page: Page) {
  const promise = page.waitForEvent("download")
  await page.getByRole("button", { name: "Historia completa JSON" }).click()
  return JSON.parse((await readDownload(await promise)).toString())
}

const saveBar = (page: Page) => page.getByRole("region", { name: "Cambios sin guardar" })
const tab = (page: Page, name: string) => page.getByRole("tab", { name, exact: true })

async function saveChanges(page: Page, sections: string[]) {
  await saveBar(page).getByRole("button", { name: "Guardar cambios" }).click()
  const confirm = page.getByRole("alertdialog")
  for (const section of sections) await expect(confirm).toContainText(section)
  await confirm.getByRole("button", { name: "Guardar cambios" }).click()
  await expect(page.getByText("Cambios guardados en la historia clínica", { exact: true }).last()).toBeVisible()
  await expect(saveBar(page)).toHaveCount(0)
}

/** Página «Registrar atención»: paso actual y botones de la barra inferior. */
const currentStep = (page: Page) => page.getByRole("navigation", { name: "Pasos de la atención" }).locator('[aria-current="step"]')
const nextStep = (page: Page) => page.getByRole("button", { name: "Siguiente", exact: true })
const saveEncounter = (page: Page) => page.getByRole("button", { name: "Guardar atención", exact: true })

async function goToStep(page: Page, name: string) {
  await page.getByRole("navigation", { name: "Pasos de la atención" }).getByRole("button", { name }).click()
  await expect(currentStep(page)).toContainText(name)
}

async function addDiagnosis(page: Page, description: string, priority = "Alta") {
  await page.getByRole("button", { name: "Agregar diagnóstico" }).click()
  const row = page.getByRole("listitem", { name: /^Diagnóstico \d+$/ }).last()
  await row.getByLabel("Diagnóstico clínico / CIE-10", { exact: true }).fill(description)
  await radio(row, "Prioridad", priority).click()
}

async function confirmEncounter(page: Page, texts: string[] = []) {
  await saveEncounter(page).click()
  const confirm = page.getByRole("alertdialog")
  for (const text of texts) await expect(confirm).toContainText(text)
  await confirm.getByRole("button", { name: "Confirmar y guardar" }).click()
  await expect(page.getByText("Atención registrada", { exact: true })).toBeVisible()
  await expect(page).toHaveURL(/\/historial-clinico\/paciente\/pat_\d+\?atencion=/)
}

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jf1sAAAAASUVORK5CYII=",
  "base64"
)

/** Cuenta muestras con tinta en la imagen: una captura con el editor oculto sale en blanco. */
async function inkedSamples(page: Page, src: string) {
  return page.evaluate(async (source) => {
    const image = new Image()
    image.src = source
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
  }, src)
}

test("historia editable: odontograma, plan, consentimiento, archivos, guardado con confirmación y exportaciones", async ({ page }) => {
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  await login(page)

  // Paciente sin atenciones: la historia se edita al abrirla y sin cambios no hay barra de guardado.
  await page.goto("/historial-clinico/paciente/pat_5")
  await waitForChart(page)
  await expect(saveBar(page)).toHaveCount(0)

  // Odontograma real dentro del iframe, con el tema de la app.
  const editor = frameOf(page)
  await expect(editor.locator("#toothGrid > *")).not.toHaveCount(0)
  await editor.getByRole("option", { name: "16", exact: true }).click()
  const [mobilityValue] = await editor.locator("#mobilitySelect").selectOption({ index: 1 })
  await editor.locator("#calculusRow label").click()
  await expect(editor.locator("#calculusToggle")).toBeChecked()
  await expect(saveBar(page)).toContainText("Odontograma y periodontograma")
  await page.getByRole("button", { name: "Modo claro", exact: true }).click()
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
  await page.getByRole("button", { name: "Modo oscuro", exact: true }).click()
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

  // Plan: tratamiento propuesto del catálogo.
  await tab(page, "Plan de tratamiento").click()
  const planForm = page.getByRole("form", { name: "Agregar tratamiento propuesto" })
  await chooseOption(planForm, page, "Tratamiento del catálogo", /^Limpieza dental/)
  await planForm.getByLabel("Pieza / zona", { exact: true }).fill("16")
  await planForm.getByRole("button", { name: "Agregar", exact: true }).click()
  await expect(page.getByRole("cell", { name: "Limpieza dental", exact: true })).toBeVisible()

  // Consentimiento de datos: aceptado exige firmante, cédula y fecha.
  await tab(page, "Consentimiento y declaración").click()
  await chooseOption(page, page, "Estado", "Aceptado")
  await saveBar(page).getByRole("button", { name: "Guardar cambios" }).click()
  await expect(page.getByText("Indica el nombre de quien firma")).toBeVisible()
  await expect(tab(page, "Consentimiento y declaración Con errores")).toHaveAttribute("aria-selected", "true")
  await page.getByLabel("Nombre de quien firma", { exact: true }).fill("Paciente de prueba")
  await page.getByLabel("Cédula de quien firma", { exact: true }).fill("0102030405")
  await page.getByLabel("Fecha de la decisión", { exact: true }).fill("2026-09-20")

  await tab(page, "Fotos y documentos").click()
  await page
    .getByLabel("Seleccionar archivos clínicos")
    .setInputFiles({ name: "radiografia-prueba.png", mimeType: "image/png", buffer: png })
  await expect(page.getByText("radiografia-prueba.png", { exact: true })).toBeVisible()
  await expect(page.getByText(/Fotografías clínicas · /)).toBeVisible()

  await saveChanges(page, ["Odontograma y periodontograma", "Plan de tratamiento", "Consentimiento de datos", "Fotos y documentos"])
  await expect(page.getByText("Consentimiento de datos pendiente")).toHaveCount(0)

  // Lo guardado sobrevive a una recarga.
  await page.reload()
  await waitForChart(page)
  await expect(saveBar(page)).toHaveCount(0)
  await tab(page, "Consentimiento y declaración").click()
  await expect(page.getByLabel("Nombre de quien firma", { exact: true })).toHaveValue("Paciente de prueba")

  // Descartar vuelve al último estado guardado.
  await tab(page, "Plan de tratamiento").click()
  await page.getByRole("button", { name: "Quitar Limpieza dental de los propuestos" }).click()
  await expect(page.getByText("No hay tratamientos propuestos.")).toBeVisible()
  await saveBar(page).getByRole("button", { name: "Descartar cambios" }).click()
  await page.getByRole("alertdialog").getByRole("button", { name: "Descartar" }).click()
  await expect(page.getByRole("cell", { name: "Limpieza dental", exact: true })).toBeVisible()
  await expect(saveBar(page)).toHaveCount(0)
  await waitForChart(page)

  const history = await downloadJson(page)
  expect(history.encounters).toEqual([])
  expect(history.record.plan[0]).toMatchObject({ treatmentId: "trt_1", tooth: "16", phase: "" })
  expect(history.record.dataConsent).toMatchObject({ status: "aceptado", signerName: "Paciente de prueba" })
  expect(history.record.attachments).toHaveLength(1)
  expect(history.record.attachments[0].kind).toBe("fotografias")
  const teeth = history.record.chart.payload.teeth
  expect(teeth["16"].calculus).toBe(true)
  expect(teeth["16"].mobility).toBe(mobilityValue)
  const [measuredTooth, measuredSite] = measurementKey.split(":")
  expect(teeth[measuredTooth].perio.pd[measuredSite]).toBe(5)
  expect(teeth[measuredTooth].perio.gm[measuredSite]).toBe(2)
  expect(teeth[measuredTooth].perio.bop).toContain(measuredSite)

  // Documento de la historia, exportado con la pestaña del odontograma oculta.
  const documentPromise = page.waitForEvent("download")
  await page.getByRole("button", { name: "Documento de la historia", exact: true }).click()
  const html = (await readDownload(await documentPromise)).toString()
  expect(html).toContain("Paciente de prueba")
  expect(html).toContain("radiografia-prueba.png")
  expect(html).toContain("Datos del paciente")
  expect(html).toContain("HC-000005")
  expect(html).toContain("Plan de tratamiento por fases")
  const embedded = html.match(/<img src="data:image\/png;base64,([A-Za-z0-9+/]+=*)" alt="Odontograma actual">/)
  expect(embedded).not.toBeNull()
  expect(Buffer.from(embedded![1], "base64").subarray(1, 4).toString()).toBe("PNG")
  expect(await inkedSamples(page, `data:image/png;base64,${embedded![1]}`)).toBeGreaterThan(200)

  // El menú «Exportar» del editor sigue descargando su propia imagen después de la captura.
  await tab(page, "Odontograma y periodontograma").click()
  const editorPngPromise = page.waitForEvent("download")
  await editor.locator("#btnExportMenu").click()
  await editor.getByRole("menuitem", { name: "Imagen PNG" }).click()
  expect((await editorPngPromise).suggestedFilename()).toMatch(/^odontogram-.*\.png$/)

  // «Imprimir / Guardar PDF» abre la ventana de impresión con la imagen incrustada.
  const popupPromise = page.waitForEvent("popup")
  await page.getByRole("button", { name: "Imprimir / Guardar PDF" }).click()
  const popup = await popupPromise
  const popupImage = popup.locator('img[alt="Odontograma actual"]')
  await expect(popupImage).toHaveCount(1)
  await expect.poll(() => popupImage.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0)
  await popup.close()

  await tab(page, "Fotos y documentos").click()
  const attachmentPromise = page.waitForEvent("download")
  await page.getByRole("button", { name: "Descargar", exact: true }).click()
  expect(await readDownload(await attachmentPromise)).toEqual(png)

  // Indicadores calculados desde el periodontograma, incluidos los máximos de sondaje e inserción.
  await tab(page, "Evolución periodontal").click()
  await expect(page.getByText("Sitios con bolsa ≥ 4 mm", { exact: true })).toBeVisible()
  const maxDepth = page.getByText("Profundidad de sondaje máxima", { exact: true }).locator("..")
  await expect(maxDepth).toContainText("5 mm")
  const maxAttachment = page.getByText("Pérdida de inserción clínica máxima", { exact: true }).locator("..")
  await expect(maxAttachment).toContainText("7 mm")

  // Aislamiento por paciente.
  await page.goto("/historial-clinico/paciente/pat_1")
  await waitForChart(page)
  await tab(page, "Fotos y documentos").click()
  await expect(page.getByText("radiografia-prueba.png", { exact: true })).toHaveCount(0)
  expect(errors).toEqual([])
})

test("antecedentes, alertas, datos del paciente, declaración y plan por fases", async ({ page }) => {
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  await login(page)

  await page.goto("/historial-clinico/paciente/pat_3")
  await waitForChart(page)
  // Sin alergias ni alertas no hay franja; la declaración está pendiente.
  await expect(page.getByRole("region", { name: "Alertas médicas" })).toHaveCount(0)
  await expect(page.getByText("Declaración de veracidad pendiente")).toBeVisible()

  // El texto libre «Antecedentes médicos» de la ficha quedó como «Otro» en la historia.
  await tab(page, "Antecedentes").click()
  await expect(page.getByLabel("Detalle de Otro", { exact: true })).toHaveValue("Ortodoncia con seguimiento mensual.")

  // «Niega antecedentes relevantes» es excluyente; Cirugías previas exige el detalle.
  await page.getByRole("checkbox", { name: "Niega antecedentes relevantes" }).click()
  await page.getByRole("checkbox", { name: "Cirugías previas: personal" }).click()
  await page.getByRole("checkbox", { name: "Hipertensión arterial: familiar" }).click()
  await expect(saveBar(page)).toContainText("Antecedentes médicos")
  await saveBar(page).getByRole("button", { name: "Guardar cambios" }).click()
  await expect(page.getByText("«Niega antecedentes relevantes» no se puede marcar junto con otros antecedentes")).toBeVisible()
  await expect(page.getByText("Indica cuál y cuándo")).toBeVisible()
  await expect(tab(page, "Antecedentes Con errores")).toHaveAttribute("aria-selected", "true")
  await page.getByRole("checkbox", { name: "Niega antecedentes relevantes" }).click()
  await page.getByLabel("Detalle de Cirugías previas", { exact: true }).fill("Apendicectomía en 2015")

  // Alergias y medicación: listas dinámicas; cada fila exige su primer campo.
  const allergies = page.getByRole("region", { name: "Alergias", exact: true })
  await page.getByRole("button", { name: "Agregar alergia" }).click()
  await allergies.getByLabel("Alergia / reacción", { exact: true }).fill("Urticaria")
  await allergies.getByLabel("Medicamento o sustancia", { exact: true }).fill("Ibuprofeno")
  await page.getByRole("button", { name: "Agregar medicamento" }).click()
  await saveBar(page).getByRole("button", { name: "Guardar cambios" }).click()
  await expect(page.getByText("Indica el medicamento")).toBeVisible()
  await page.getByRole("region", { name: "Medicación actual" }).getByLabel("Medicamento actual", { exact: true }).fill("Losartán")
  await page.getByRole("checkbox", { name: "Anticoagulantes / antiagregantes" }).click()

  // Hábitos: al marcar «Sí» se piden las características.
  await radio(page, "Tabaco / vapeo", "Sí").click()
  await page.getByLabel("Tipo, cantidad y años", { exact: true }).fill("Cigarrillo, 5 al día, 10 años")
  await radio(page, "Higiene oral", "Sí").click()
  await radio(page, "Calidad", "Deficiente").click()
  // El elemento repetido en periodontales se muestra desde su sección original.
  const periodontal = page.locator("#antecedentes-periodontales")
  await expect(periodontal).toContainText("Tabaquismo / vapeo:Sí")
  await expect(periodontal).toContainText("Higiene deficiente:Sí")

  // Datos del paciente: mismo registro que la ficha; N.° de historia y edad automáticos.
  await tab(page, "Datos del paciente").click()
  await expect(page.getByText("HC-000003", { exact: true })).toBeVisible()
  await expect(page.getByText(/^\d+ años$/)).toBeVisible()
  await page.getByLabel("Ocupación", { exact: true }).fill("Diseñadora gráfica")
  await page.getByLabel("Parentesco", { exact: true }).fill("Tía")

  // Declaración de veracidad: aceptada exige nombre, C.I. y fecha; muestra el registro profesional.
  await tab(page, "Consentimiento y declaración").click()
  await page.getByRole("checkbox", { name: "El paciente acepta la declaración" }).click()
  await saveBar(page).getByRole("button", { name: "Guardar cambios" }).click()
  await expect(page.getByText("Indica el nombre del paciente o representante")).toBeVisible()
  await page.getByLabel("Paciente / representante", { exact: true }).fill("Sofía Ramírez")
  await page.getByLabel("C.I.", { exact: true }).fill("0304050607")
  await page.getByLabel("Fecha de la declaración", { exact: true }).fill("2026-09-20")
  await chooseOption(page, page, "Profesional tratante", "Dra. Paula Nieto")
  await expect(page.getByLabel("Registro profesional")).toHaveText("MSP-09-01157")

  // Plan por fases: agrupado, con total por fase y general.
  await tab(page, "Plan de tratamiento").click()
  const planForm = page.getByRole("form", { name: "Agregar tratamiento propuesto" })
  await chooseOption(planForm, page, "Tratamiento del catálogo", /^Limpieza dental/)
  await chooseOption(planForm, page, "Fase", "Higiénica / periodontal básica")
  await planForm.getByRole("button", { name: "Agregar", exact: true }).click()
  await chooseOption(planForm, page, "Tratamiento del catálogo", /^Endodoncia/)
  await planForm.getByLabel("Pieza / zona", { exact: true }).fill("36")
  await planForm.getByRole("button", { name: "Agregar", exact: true }).click()
  const plan = page.getByRole("table", { name: "Tratamientos propuestos" })
  await expect(plan.getByRole("rowgroup", { name: "Fase: Higiénica / periodontal básica" })).toContainText("Limpieza dental")
  await expect(plan.getByRole("rowgroup", { name: "Fase: Sin fase" })).toContainText("Endodoncia")
  await expect(plan.getByRole("row", { name: /Total estimado/ })).toContainText("$155,00")
  // Asignar una fase después mueve el propuesto a su grupo.
  await chooseOption(plan, page, "Fase de Endodoncia", "Restauradora / endodóntica")
  await expect(plan.getByRole("rowgroup", { name: "Fase: Restauradora / endodóntica" })).toContainText("Endodoncia")
  await expect(plan.getByRole("rowgroup", { name: "Fase: Sin fase" })).toHaveCount(0)

  await saveChanges(page, [
    "Datos del paciente",
    "Antecedentes médicos",
    "Alergias, medicamentos y alertas",
    "Hábitos y factores de riesgo",
    "Plan de tratamiento",
    "Declaración de veracidad",
  ])
  const alerts = page.getByRole("region", { name: "Alertas médicas" })
  await expect(alerts).toContainText("Anticoagulantes / antiagregantes")
  await expect(alerts).toContainText("Alergia: Ibuprofeno (Urticaria)")
  await expect(page.getByText("Declaración de veracidad pendiente")).toHaveCount(0)
  await expect(page.getByRole("heading", { name: "Historia clínica odontológica" })).toBeVisible()

  // Navegando dentro de la app (los pacientes de demostración están en memoria): la ficha muestra lo mismo.
  await page.getByRole("button", { name: "Volver al paciente" }).click()
  await expect(page).toHaveURL(/\/pacientes\/pat_3$/)
  await expect(page.getByText("Diseñadora gráfica", { exact: true })).toBeVisible()
  await expect(page.getByText("Marta Ramírez (Tía)")).toBeVisible()
  await expect(page.getByText("Antecedentes médicos", { exact: true })).toHaveCount(0)
  await page.getByRole("tab", { name: "Historial clínico" }).click()
  await expect(page.getByRole("region", { name: "Alertas médicas" })).toContainText("Anticoagulantes")

  // Editar el paciente en Pacientes se ve en la historia, y no borra los datos que se editan en la historia.
  await page.getByRole("button", { name: "Editar", exact: true }).click()
  await expect(page.getByLabel("Antecedentes médicos")).toHaveCount(0)
  await page.getByLabel("Teléfono", { exact: true }).fill("0999111222")
  await page.getByRole("button", { name: "Guardar cambios" }).click()
  await expect(page).toHaveURL(/\/pacientes\/pat_3$/)
  await expect(page.getByText("Diseñadora gráfica", { exact: true })).toBeVisible()
  await page.getByRole("button", { name: "Abrir historia clínica" }).first().click()
  await waitForChart(page)
  await tab(page, "Datos del paciente").click()
  await expect(page.getByLabel("Teléfono", { exact: true })).toHaveValue("0999111222")
  await expect(page.getByLabel("Ocupación", { exact: true })).toHaveValue("Diseñadora gráfica")

  // La historia (IndexedDB) sobrevive a una recarga.
  await page.reload()
  await waitForChart(page)
  await tab(page, "Antecedentes").click()
  await expect(page.getByLabel("Detalle de Cirugías previas", { exact: true })).toHaveValue("Apendicectomía en 2015")
  const history = await downloadJson(page)
  expect(history.record.medicalBackground.conditions.cirugias).toMatchObject({ personal: true, family: false })
  expect(history.record.medicalBackground.conditions.hipertension).toMatchObject({ personal: false, family: true })
  expect(history.record.allergiesAndMedication.medications[0].name).toBe("Losartán")
  expect(history.record.habits.tobacco.answer).toBe("si")
  expect(history.record.truthDeclaration).toMatchObject({ accepted: true, professionalId: "prof_3" })
  expect(history.record.plan.map((item: { phase: string }) => item.phase)).toEqual(["higienica", "restauradora"])
  expect(errors).toEqual([])
})

test("registrar atención: página por pasos, evaluación, tratamientos, exámenes solicitados, copia de alertas y PDF", async ({ page }) => {
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  await login(page)

  await page.goto("/historial-clinico/paciente/pat_1")
  await waitForChart(page)
  // La alergia del texto libre anterior de la ficha quedó en la historia y se ve destacada.
  await expect(page.getByRole("region", { name: "Alertas médicas" })).toContainText("Alergia: Penicilina, mariscos.")

  // Con cambios sin guardar, «Registrar atención» pide guardarlos: la atención copia el odontograma guardado.
  await frameOf(page).getByRole("option", { name: "16", exact: true }).click()
  await frameOf(page).locator("#calculusRow label").click()
  await expect(saveBar(page)).toBeVisible()
  await page.getByRole("button", { name: "Registrar atención", exact: true }).click()
  const pending = page.getByRole("alertdialog")
  await expect(pending).toContainText("La historia tiene cambios sin guardar")
  await pending.getByRole("button", { name: "Guardar cambios y continuar" }).click()
  await expect(page).toHaveURL(/\/historial-clinico\/paciente\/pat_1\/atencion\/nueva$/)
  await expect(page.getByRole("heading", { name: "Registrar atención" })).toBeVisible()
  await expect(page.getByRole("region", { name: "Alertas médicas" })).toContainText("Penicilina")

  // Paso 1: «Siguiente» valida solo el paso.
  await expect(currentStep(page)).toContainText("Motivo")
  await nextStep(page).click()
  await expect(page.getByText("Describe el motivo de consulta")).toBeVisible()
  await expect(currentStep(page)).toContainText("Motivo")
  // La administradora no es profesional: el profesional se elige a mano.
  await chooseOption(page, page, "Profesional", /Dra\. Carla Ríos/)
  await page.getByLabel("Motivo de consulta", { exact: true }).fill("Control y restauración")
  await page.getByLabel("Enfermedad actual", { exact: true }).fill("Sensibilidad al frío desde hace dos semanas.")
  await nextStep(page).click()

  // Paso 2: signos vitales con rangos, IMC calculado, ASA e interconsulta.
  await expect(currentStep(page)).toContainText("Signos vitales y riesgo")
  await page.getByLabel("FC (lpm)", { exact: true }).fill("500")
  await page.getByLabel("PA (mmHg)", { exact: true }).fill("120-80")
  await page.getByLabel("Peso (kg)", { exact: true }).fill("70")
  await page.getByLabel("Talla (cm)", { exact: true }).fill("175")
  await expect(page.getByLabel("IMC calculado")).toHaveText("22.9")
  await radio(page, "Clasificación ASA", "ASA II").click()
  await page.getByRole("checkbox", { name: "Riesgo hemorrágico" }).click()
  await page.getByRole("checkbox", { name: "Interconsulta requerida" }).click()
  await nextStep(page).click()
  await expect(page.getByText("Valor entre 30 y 220")).toBeVisible()
  await expect(page.getByText("Formato 120/80")).toBeVisible()
  await expect(page.getByText("Indica el especialista o el motivo de la interconsulta")).toBeVisible()
  await page.getByLabel("FC (lpm)", { exact: true }).fill("72")
  await page.getByLabel("PA (mmHg)", { exact: true }).fill("120/80")
  await page.getByLabel("Especialista o motivo de la interconsulta", { exact: true }).fill("Cardiología: control de anticoagulación")
  await nextStep(page).click()

  // Paso 3: examen por estructura; Alterado exige el hallazgo; «Marcar todo como normal».
  await expect(currentStep(page)).toContainText("Examen clínico")
  await radio(page, "ATM / ruidos / dolor", "Alterado").click()
  await page.getByRole("button", { name: "Marcar todo como normal: Examen intraoral" }).click()
  await expect(radio(page, "Oclusión", "Normal")).toHaveAttribute("aria-checked", "true")
  await nextStep(page).click()
  await expect(page.getByText("Describe el hallazgo")).toBeVisible()
  await page.getByLabel("Hallazgo de ATM / ruidos / dolor", { exact: true }).fill("Chasquido en ATM derecha")
  await page.getByLabel("Dolor EVA (0 a 10)", { exact: true }).fill("4")
  await radio(page, "Nivel de riesgo de caries", "Alto").click()
  await nextStep(page).click()

  // Paso 4: al menos un diagnóstico; diagnóstico periodontal e intervalo con próximo control sugerido.
  await expect(currentStep(page)).toContainText("Diagnóstico y pronóstico")
  await nextStep(page).click()
  await expect(page.getByText("Registra al menos un diagnóstico")).toBeVisible()
  await addDiagnosis(page, "Caries dentinaria en pieza 46 (K02.1)")
  await page.getByRole("listitem", { name: "Diagnóstico 1" }).getByLabel("Pieza / región", { exact: true }).fill("46")
  await radio(page, "Pronóstico", "Favorable").click()
  await radio(page, "Periodontitis", "Estadio II").click()
  await radio(page, "Intervalo de mantenimiento", "6 meses").click()
  await expect(page.getByText(/^Próximo control: /)).toBeVisible()
  await nextStep(page).click()

  // Paso 5: tratamientos realizados con costo editable y exámenes solicitados.
  await expect(currentStep(page)).toContainText("Tratamientos y evolución")
  await expect(page.getByLabel("Próximo control", { exact: true })).not.toHaveValue("")
  await page.getByLabel("Observaciones", { exact: true }).fill("Nota de prueba <script>window.injected=true</script>")
  await page.getByLabel("Materiales / anestesia / lote", { exact: true }).fill("Lidocaína 2% lote A123")
  await page.getByRole("button", { name: /Resina compuesta \(46\)/ }).click()
  await chooseOption(page, page, "Tratamiento del catálogo", /^Limpieza dental/)
  await page.getByRole("button", { name: "Agregar", exact: true }).click()
  const performed = page.getByRole("table", { name: "Tratamientos realizados" })
  await expect(performed.getByRole("row")).toHaveCount(4)
  await expect(performed).toContainText("$90,00")
  const resinCost = page.getByLabel("Costo de Resina compuesta")
  await expect(resinCost).toHaveValue("55")
  await resinCost.fill("")
  await nextStep(page).click()
  await expect(page.getByText("Indica el costo")).toBeVisible()
  await resinCost.fill("40")
  await expect(page.getByText("Indica el costo")).toHaveCount(0)
  await expect(performed).toContainText("Catálogo: $55,00")
  await expect(performed.getByRole("row", { name: /Total de la atención/ })).toContainText("$75,00")
  await chooseOption(page, page, "Examen", "Panorámica")
  await page.getByRole("button", { name: "Solicitar", exact: true }).click()
  await expect(page.getByLabel("Detalle de Interconsulta médica", { exact: true })).toHaveValue("Cardiología: control de anticoagulación")
  await nextStep(page).click()

  // Paso 6: revisión y confirmación («Volver» conserva lo escrito).
  await expect(currentStep(page)).toContainText("Revisión")
  const review = page.getByRole("form", { name: "Revisión" })
  await expect(review).toContainText("Caries dentinaria en pieza 46 (K02.1)")
  await expect(review).toContainText("IMC 22.9")
  await expect(review).toContainText("ASA II")
  await expect(review).toContainText("ATM / ruidos / dolor: Alterado · Chasquido en ATM derecha")
  await expect(review).toContainText("Interconsulta requerida: Cardiología")
  await saveEncounter(page).click()
  const confirm = page.getByRole("alertdialog")
  await expect(confirm).toContainText("Se registrarán 2 tratamientos realizados por $75,00.")
  await expect(confirm).toContainText("Saldrá 1 de los tratamientos propuestos.")
  await expect(confirm).toContainText("Quedarán 2 exámenes solicitados como pendientes en la historia.")
  await confirm.getByRole("button", { name: "Volver" }).click()
  await goToStep(page, "Diagnóstico y pronóstico")
  await expect(page.getByLabel("Diagnóstico clínico / CIE-10", { exact: true })).toHaveValue("Caries dentinaria en pieza 46 (K02.1)")
  await confirmEncounter(page)

  await expect(tab(page, "Atenciones")).toHaveAttribute("aria-selected", "true")
  await expect(saveBar(page)).toHaveCount(0)

  // La tarjeta muestra el diagnóstico, la copia de alertas y el detalle por pasos.
  const card = page.locator("article").filter({ hasText: "Caries dentinaria en pieza 46" })
  await expect(card.getByRole("region", { name: "Alertas al momento de la atención" })).toContainText("Penicilina")
  await expect(card).toContainText("Lidocaína 2% lote A123")
  await expect(card).toContainText("Periodontitis: Estadio II")

  // El propuesto realizado salió del plan; la pestaña Tratamientos suma todo lo realizado.
  await tab(page, "Plan de tratamiento").click()
  await expect(page.getByText("No hay tratamientos propuestos.")).toBeVisible()
  await tab(page, "Tratamientos").click()
  await expect(page.getByRole("cell", { name: "Resina compuesta", exact: true })).toBeVisible()
  await expect(page.getByRole("row", { name: /Resina compuesta/ })).toContainText("$40,00")
  await expect(page.getByRole("row", { name: /Total/ })).toContainText("$110,00")

  // Exámenes solicitados: pendientes en la historia; al subir el resultado pasan a «Recibido».
  await tab(page, "Fotos y documentos").click()
  const requests = page.getByRole("list", { name: "Exámenes solicitados" })
  await expect(requests.getByRole("listitem", { name: "Panorámica" })).toContainText("Pendiente")
  await expect(requests.getByRole("listitem", { name: "Interconsulta médica" })).toContainText("Cardiología")
  const fileChooser = page.waitForEvent("filechooser")
  await page.getByRole("button", { name: "Subir resultado de Interconsulta médica" }).click()
  await (await fileChooser).setFiles({ name: "informe-cardiologia.png", mimeType: "image/png", buffer: png })
  await expect(requests.getByRole("listitem", { name: "Interconsulta médica" })).toContainText("Recibido")
  await expect(page.getByText("informe-cardiologia.png", { exact: true })).toBeVisible()
  await saveChanges(page, ["Fotos y documentos", "Exámenes solicitados"])

  // Nota aclaratoria sobre la atención nueva.
  await tab(page, "Atenciones").click()
  await card.getByRole("button", { name: "Agregar nota aclaratoria" }).click()
  const noteDialog = page.getByRole("dialog", { name: "Agregar nota aclaratoria" })
  await noteDialog.getByLabel("Nota", { exact: true }).fill("corta")
  await noteDialog.getByRole("button", { name: "Guardar nota" }).click()
  await expect(noteDialog.getByText("Escribe la nota (mínimo 10 caracteres)")).toBeVisible()
  await noteDialog.getByLabel("Nota", { exact: true }).fill("La resina fue en la cara distal de la pieza 46.")
  await noteDialog.getByRole("button", { name: "Guardar nota" }).click()
  await page.getByRole("alertdialog").getByRole("button", { name: "Confirmar y guardar" }).click()
  await expect(card.getByRole("region", { name: "Notas aclaratorias" })).toContainText("cara distal")
  await expect(card.getByRole("button", { name: /Editar|Eliminar/ })).toHaveCount(0)

  // Copia del odontograma de esa atención, de solo lectura.
  await card.getByRole("button", { name: "Ver odontograma" }).click()
  const chartDialog = page.getByRole("dialog")
  await expect(chartDialog.frameLocator("iframe").locator("#toothGrid")).toBeVisible()
  await chartDialog.locator("[data-slot=dialog-close]").click()
  await expect(chartDialog).toHaveCount(0)

  // PDF de la atención: secciones en el orden del papel, datos escapados, alertas, nota e imagen.
  const popupPromise = page.waitForEvent("popup")
  await card.getByRole("button", { name: "Imprimir / Guardar PDF" }).click()
  const popup = await popupPromise
  const popupImage = popup.locator('img[alt="Odontograma de la atención"]')
  await expect(popupImage).toHaveCount(1)
  await expect.poll(() => popupImage.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0)
  const popupHtml = await popup.content()
  expect(popupHtml).toContain("&lt;script&gt;window.injected=true&lt;/script&gt;")
  expect(popupHtml).not.toContain("<script>window.injected")
  expect(popupHtml).toContain("Dra. Carla Ríos")
  expect(popupHtml).toContain("cara distal")
  expect(popupHtml).toContain("Signos vitales y evaluación de riesgo")
  expect(popupHtml).toContain("Alertas al momento de la atención")
  expect(popupHtml.indexOf("Motivo de consulta y enfermedad actual")).toBeLessThan(popupHtml.indexOf("Diagnóstico y pronóstico"))
  await popup.close()

  const history = await downloadJson(page)
  expect(history.record.plan).toEqual([])
  expect(history.record.chart.payload.teeth["16"].calculus).toBe(true)
  const encounter = history.encounters.find((item: { reason: string }) => item.reason === "Control y restauración")
  expect(encounter.professionalId).toBe("prof_1")
  expect(encounter.chartSnapshot.payload.teeth["16"].calculus).toBe(true)
  expect(encounter.diagnoses[0]).toMatchObject({ description: "Caries dentinaria en pieza 46 (K02.1)", tooth: "46", priority: "alta" })
  expect(encounter.vitals).toMatchObject({ heartRate: 72, bloodPressure: "120/80", weight: 70, height: 175 })
  expect(encounter.extraoralExam.atm).toMatchObject({ status: "alterado", finding: "Chasquido en ATM derecha" })
  expect(encounter.intraoralExam.oclusion.status).toBe("normal")
  expect(encounter.maintenanceInterval.option).toBe("6")
  expect(encounter.clinicalSnapshot.allergies[0].reaction).toBe("Penicilina, mariscos.")
  expect(encounter.addenda).toHaveLength(1)
  expect(encounter.performedTreatments).toHaveLength(2)
  for (const item of encounter.performedTreatments) expect(item.assignmentId).toBeTruthy()
  expect(encounter.performedTreatments.find((item: { treatmentId: string }) => item.treatmentId === "trt_4").cost).toBe(40)
  const received = history.record.examRequests.find((item: { kind: string }) => item.kind === "interconsulta")
  expect(received).toMatchObject({ status: "recibido", encounterId: encounter.id })
  expect(history.record.attachments.find((file: { id: string }) => file.id === received.attachmentId).kind).toBe("interconsulta")
  expect(history.record.examRequests.find((item: { kind: string }) => item.kind === "panoramica").status).toBe("pendiente")

  // Las alertas de la atención son una copia: editar los antecedentes después no la cambia.
  await tab(page, "Antecedentes").click()
  await page.getByRole("checkbox", { name: "Alergia a látex" }).click()
  await saveChanges(page, ["Alergias, medicamentos y alertas"])
  await expect(page.getByRole("region", { name: "Alertas médicas" })).toContainText("Alergia a látex")
  await tab(page, "Atenciones").click()
  await expect(card.getByRole("region", { name: "Alertas al momento de la atención" })).not.toContainText("látex")

  // Navegando dentro de la app (sin recargar los mocks): el tratamiento quedó registrado en el catálogo
  // con el costo cobrado, que también usa el resumen financiero.
  await page.getByRole("link", { name: "Tratamientos", exact: true }).click()
  await page.getByRole("row", { name: /^Ver tratamiento: Resina compuesta/ }).click()
  await expect(page).toHaveURL(/\/tratamientos\/trt_4$/)
  const recipient = page.getByRole("row", { name: /María/ })
  await expect(recipient).toContainText("46")
  await expect(recipient).toContainText("$40,00")
  await expect(page.getByText("$40,00", { exact: true }).first()).toBeVisible()
  await expect(page.getByRole("button", { name: /Sesión/ })).toHaveCount(0)
  expect(errors).toEqual([])
})

test("desde la cita: la página de la atención abre con la cita precargada y la cita queda completada", async ({ page }) => {
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  await login(page, "medico")

  await page.goto("/historial-clinico/paciente/pat_2?cita=apt_2")
  await expect(page).toHaveURL(/\/historial-clinico\/paciente\/pat_2\/atencion\/nueva\?cita=apt_2$/)
  // La cita viene preseleccionada y define el profesional (el de la cita, no el del usuario).
  await expect(page.getByLabel("Profesional", { exact: true })).toContainText("Dr. Andrés Vega")
  await expect(page.getByLabel("Cita", { exact: true })).not.toContainText("Sin cita")
  await page.getByLabel("Motivo de consulta", { exact: true }).fill("Consulta agendada")

  // «Guardar atención» valida todo y lleva al primer paso con errores.
  await saveEncounter(page).click()
  await expect(currentStep(page)).toContainText("Diagnóstico y pronóstico")
  await expect(page.getByText("Registra al menos un diagnóstico")).toBeVisible()
  await addDiagnosis(page, "Caries en pieza 26", "Media")
  await confirmEncounter(page, ["La cita vinculada pasará a «Completada»"])
  await expect(page.getByText("La cita vinculada quedó como completada")).toBeVisible()

  // Pestaña Citas: la cita completada enlaza a su atención.
  await tab(page, "Citas").click()
  const row = page.getByRole("table", { name: "Citas del paciente" }).getByRole("row").filter({ hasText: "Completada" })
  await row.getByRole("button", { name: "Ver atención" }).click()
  await expect(tab(page, "Atenciones")).toHaveAttribute("aria-selected", "true")

  // Volver a abrir desde la cita lleva a la atención existente, sin abrir otra.
  await page.goto("/historial-clinico/paciente/pat_2?cita=apt_2")
  await expect(tab(page, "Atenciones")).toHaveAttribute("aria-selected", "true")
  await expect(page.getByText("Caries en pieza 26").first()).toBeVisible()
  await expect(page).toHaveURL(/\/historial-clinico\/paciente\/pat_2\?cita=apt_2$/)
  expect(errors).toEqual([])
})

test("visitas guardadas con la versión anterior se convierten en historia y atenciones", async ({ page }) => {
  await login(page)
  await page.evaluate(async () => {
    const stored = {
      version: 2,
      patientId: "pat_5",
      visits: [
        {
          id: "visita_antigua",
          status: "cerrada",
          date: "2026-08-10",
          professionalId: "prof_1",
          appointmentId: null,
          reason: "Dolor en molar",
          diagnosis: "Pulpitis reversible",
          procedures: "",
          evolution: "",
          notes: "",
          nextVisit: "",
          chart: null,
          plan: [{ id: "item_hecho", treatmentId: "trt_1", description: "Limpieza dental", tooth: "", status: "en-curso", assignmentId: "asg_x" }],
          attachments: [{ id: "file_x", name: "rx-antigua.png", kind: "radiografia", mime: "image/png", size: 10, createdAt: "2026-08-10T15:00:00.000Z" }],
          createdAt: "2026-08-10T15:00:00.000Z",
          updatedAt: "2026-08-10T15:00:00.000Z",
          closedAt: "2026-08-10T15:00:00.000Z",
        },
      ],
      draft: {
        id: "borrador_vacio",
        status: "borrador",
        date: "2026-09-01",
        professionalId: "prof_1",
        appointmentId: null,
        reason: "",
        diagnosis: "",
        procedures: "",
        evolution: "",
        notes: "",
        nextVisit: "",
        chart: null,
        plan: [{ id: "item_propuesto", treatmentId: "trt_4", description: "Resina compuesta", tooth: "46", status: "pendiente", assignmentId: null }],
        attachments: [],
        createdAt: "2026-09-01T15:00:00.000Z",
        updatedAt: "2026-09-01T15:00:00.000Z",
        closedAt: null,
      },
    }
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open("clinicapp-dental-v1", 1)
      request.onupgradeneeded = () => {
        request.result.createObjectStore("records", { keyPath: "patientId" })
        request.result.createObjectStore("files", { keyPath: "id" })
      }
      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const tx = request.result.transaction("records", "readwrite")
        tx.objectStore("records").put(stored)
        tx.oncomplete = () => {
          request.result.close()
          resolve()
        }
        tx.onerror = () => reject(tx.error)
      }
    })
  })

  // Los enlaces anteriores con `?visita=` abren la atención convertida (conserva el id).
  await page.goto("/historial-clinico/paciente/pat_5?visita=visita_antigua")
  await waitForChart(page)
  await expect(tab(page, "Atenciones")).toHaveAttribute("aria-selected", "true")
  await expect(page.locator("article")).toHaveCount(1)
  // El diagnóstico de texto pasa a ser el primer diagnóstico de la lista.
  await expect(page.locator("article")).toContainText("Diagnóstico: Pulpitis reversible")
  // El borrador sin motivo ni diagnóstico no se convierte en atención; su propuesto queda en el plan, sin fase.
  await tab(page, "Plan de tratamiento").click()
  await expect(page.getByRole("rowgroup", { name: "Fase: Sin fase" })).toContainText("Resina compuesta")
  await tab(page, "Tratamientos").click()
  await expect(page.getByRole("cell", { name: "Limpieza dental", exact: true })).toBeVisible()
  // Los tipos de archivo anteriores se convierten a los del formulario.
  await tab(page, "Fotos y documentos").click()
  await expect(page.getByText(/Radiografía periapical · /)).toBeVisible()
  await expect(page.getByText("Consentimiento de datos pendiente")).toBeVisible()
  await expect(page.getByText("Declaración de veracidad pendiente")).toBeVisible()
})

test("funciona sin HTTPS: sin crypto.randomUUID se generan los ids igual", async ({ page }) => {
  // Por HTTP (por ejemplo, la IP del servidor) el navegador no expone `crypto.randomUUID`.
  // Se simula en la página y en el iframe del odontograma, aunque la prueba corra en localhost.
  await page.addInitScript(() => {
    Object.defineProperty(Crypto.prototype, "randomUUID", { value: undefined, configurable: true })
  })
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  await login(page)
  expect(await page.evaluate(() => typeof crypto.randomUUID)).toBe("undefined")

  await page.goto("/historial-clinico/paciente/pat_5")
  await waitForChart(page)

  // Tratamiento propuesto, adjunto y alergia (ids generados en el navegador).
  await tab(page, "Plan de tratamiento").click()
  const planForm = page.getByRole("form", { name: "Agregar tratamiento propuesto" })
  await chooseOption(planForm, page, "Tratamiento del catálogo", /^Limpieza dental/)
  await planForm.getByRole("button", { name: "Agregar", exact: true }).click()
  await tab(page, "Fotos y documentos").click()
  await page.getByLabel("Seleccionar archivos clínicos").setInputFiles({ name: "rx.png", mimeType: "image/png", buffer: png })
  await expect(page.getByText("rx.png", { exact: true })).toBeVisible()
  await tab(page, "Antecedentes").click()
  await page.getByRole("button", { name: "Agregar alergia" }).click()
  await page.getByLabel("Alergia / reacción", { exact: true }).fill("Látex")
  await saveChanges(page, ["Plan de tratamiento", "Fotos y documentos", "Alergias, medicamentos y alertas"])

  // Atención (id generado antes de guardar). Salir con datos escritos pide confirmación.
  await page.getByRole("button", { name: "Registrar atención", exact: true }).click()
  await chooseOption(page, page, "Profesional", /Dra\. Carla Ríos/)
  await page.getByLabel("Motivo de consulta", { exact: true }).fill("Control")
  await page.getByRole("button", { name: "Cancelar", exact: true }).click()
  await expect(page.getByRole("alertdialog")).toContainText("Lo escrito en esta atención se perderá.")
  await page.getByRole("alertdialog").getByRole("button", { name: "Seguir editando" }).click()
  await goToStep(page, "Diagnóstico y pronóstico")
  await addDiagnosis(page, "Sin hallazgos")
  await confirmEncounter(page)

  // Imagen del odontograma para el documento (id de la petición al iframe).
  await waitForChart(page)
  const documentPromise = page.waitForEvent("download")
  await page.getByRole("button", { name: "Documento de la historia", exact: true }).click()
  const html = (await readDownload(await documentPromise)).toString()
  expect(html).toMatch(/<img src="data:image\/png;base64,/)

  // Los ids generados son UUID v4 válidos.
  const history = await downloadJson(page)
  const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
  expect(history.record.plan[0].id).toMatch(uuidV4)
  expect(history.record.attachments[0].id).toMatch(uuidV4)
  expect(history.record.allergiesAndMedication.allergies[0].id).toMatch(uuidV4)
  expect(history.encounters[0].id).toMatch(uuidV4)
  expect(history.encounters[0].diagnoses[0].id).toMatch(uuidV4)
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
  // La lista global muestra atenciones, sin columna de estado; el clic abre la atención.
  await expect(page.getByRole("columnheader", { name: "Estado" })).toHaveCount(0)
  await page.getByRole("cell", { name: "Sin hallazgos relevantes." }).click()
  await expect(page).toHaveURL(/\/historial-clinico\/paciente\/pat_1\?atencion=hist_\d+$/)
  await expect(tab(page, "Atenciones")).toHaveAttribute("aria-selected", "true")
})

test("recepción no puede acceder al módulo clínico ni ve las alertas en la ficha", async ({ page }) => {
  await login(page, "recepcion")
  await page.goto("/historial-clinico/paciente/pat_1")
  await expect(page).toHaveURL(/\/403$/)
  await expect(page.locator("iframe")).toHaveCount(0)
  await page.goto("/historial-clinico/paciente/pat_1/atencion/nueva")
  await expect(page).toHaveURL(/\/403$/)

  // La ficha muestra los datos del cliente, sin los datos clínicos ni el enlace a la historia.
  await page.goto("/pacientes/pat_1")
  await expect(page.getByText("HC-000001").first()).toBeVisible()
  await expect(page.getByText("Contadora", { exact: true })).toBeVisible()
  await expect(page.getByRole("tab", { name: "Historial clínico" })).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Abrir historia clínica" })).toHaveCount(0)
  await expect(page.getByRole("region", { name: "Alertas médicas" })).toHaveCount(0)
})
