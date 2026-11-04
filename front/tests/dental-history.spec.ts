import { test, expect, type Download, type Locator, type Page } from "@playwright/test"

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

async function saveChanges(page: Page, sections: string[]) {
  await saveBar(page).getByRole("button", { name: "Guardar cambios" }).click()
  const confirm = page.getByRole("alertdialog")
  for (const section of sections) await expect(confirm).toContainText(section)
  await confirm.getByRole("button", { name: "Guardar cambios" }).click()
  await expect(page.getByText("Cambios guardados en la historia clínica", { exact: true })).toBeVisible()
  await expect(saveBar(page)).toHaveCount(0)
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

  // Plan: tratamiento propuesto del catálogo.
  await page.getByRole("tab", { name: "Plan de tratamiento", exact: true }).click()
  const planForm = page.getByRole("form", { name: "Agregar tratamiento propuesto" })
  await chooseOption(planForm, page, "Tratamiento del catálogo", /^Limpieza dental/)
  await planForm.getByLabel("Pieza / zona", { exact: true }).fill("16")
  await planForm.getByRole("button", { name: "Agregar", exact: true }).click()
  await expect(page.getByRole("cell", { name: "Limpieza dental", exact: true })).toBeVisible()

  // Consentimiento de datos: aceptado exige firmante, cédula y fecha.
  await page.getByRole("tab", { name: "Consentimiento de datos", exact: true }).click()
  await chooseOption(page, page, "Estado", "Aceptado")
  await saveBar(page).getByRole("button", { name: "Guardar cambios" }).click()
  await expect(page.getByText("Indica el nombre de quien firma")).toBeVisible()
  await expect(page.getByRole("tab", { name: "Consentimiento de datos Con errores", exact: true })).toHaveAttribute(
    "aria-selected",
    "true"
  )
  await page.getByLabel("Nombre de quien firma", { exact: true }).fill("Paciente de prueba")
  await page.getByLabel("Cédula de quien firma", { exact: true }).fill("0102030405")
  await page.getByLabel("Fecha de la decisión", { exact: true }).fill("2026-09-20")

  await page.getByRole("tab", { name: "Fotos y documentos", exact: true }).click()
  await page
    .getByLabel("Seleccionar archivos clínicos")
    .setInputFiles({ name: "radiografia-prueba.png", mimeType: "image/png", buffer: png })
  await expect(page.getByText("radiografia-prueba.png", { exact: true })).toBeVisible()

  await saveChanges(page, ["Odontograma y periodontograma", "Plan de tratamiento", "Consentimiento de datos", "Fotos y documentos"])
  await expect(page.getByText("Consentimiento de datos pendiente")).toHaveCount(0)

  // Lo guardado sobrevive a una recarga.
  await page.reload()
  await waitForChart(page)
  await expect(saveBar(page)).toHaveCount(0)
  await page.getByRole("tab", { name: "Consentimiento de datos", exact: true }).click()
  await expect(page.getByLabel("Nombre de quien firma", { exact: true })).toHaveValue("Paciente de prueba")

  // Descartar vuelve al último estado guardado.
  await page.getByRole("tab", { name: "Plan de tratamiento", exact: true }).click()
  await page.getByRole("button", { name: "Quitar Limpieza dental de los propuestos" }).click()
  await expect(page.getByText("No hay tratamientos propuestos.")).toBeVisible()
  await saveBar(page).getByRole("button", { name: "Descartar cambios" }).click()
  await page.getByRole("alertdialog").getByRole("button", { name: "Descartar" }).click()
  await expect(page.getByRole("cell", { name: "Limpieza dental", exact: true })).toBeVisible()
  await expect(saveBar(page)).toHaveCount(0)
  await waitForChart(page)

  const history = await downloadJson(page)
  expect(history.encounters).toEqual([])
  expect(history.record.plan[0]).toMatchObject({ treatmentId: "trt_1", tooth: "16" })
  expect(history.record.dataConsent).toMatchObject({ status: "aceptado", signerName: "Paciente de prueba" })
  expect(history.record.attachments).toHaveLength(1)
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
  const embedded = html.match(/<img src="data:image\/png;base64,([A-Za-z0-9+/]+=*)" alt="Odontograma actual">/)
  expect(embedded).not.toBeNull()
  expect(Buffer.from(embedded![1], "base64").subarray(1, 4).toString()).toBe("PNG")
  expect(await inkedSamples(page, `data:image/png;base64,${embedded![1]}`)).toBeGreaterThan(200)

  // El menú «Exportar» del editor sigue descargando su propia imagen después de la captura.
  await page.getByRole("tab", { name: "Odontograma y periodontograma", exact: true }).click()
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

  await page.getByRole("tab", { name: "Fotos y documentos", exact: true }).click()
  const attachmentPromise = page.waitForEvent("download")
  await page.getByRole("button", { name: "Descargar", exact: true }).click()
  expect(await readDownload(await attachmentPromise)).toEqual(png)

  // Indicadores calculados desde el periodontograma.
  await page.getByRole("tab", { name: "Evolución periodontal", exact: true }).click()
  await expect(page.getByText("Sitios con bolsa ≥ 4 mm", { exact: true })).toBeVisible()

  // Aislamiento por paciente.
  await page.goto("/historial-clinico/paciente/pat_1")
  await waitForChart(page)
  await page.getByRole("tab", { name: "Fotos y documentos", exact: true }).click()
  await expect(page.getByText("radiografia-prueba.png", { exact: true })).toHaveCount(0)
  expect(errors).toEqual([])
})

test("registrar atención: tratamientos realizados, confirmación, notas aclaratorias y PDF", async ({ page }) => {
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  await login(page)

  await page.goto("/historial-clinico/paciente/pat_1")
  await waitForChart(page)
  // Cambio sin guardar en la historia: se guarda junto con la atención.
  await frameOf(page).getByRole("option", { name: "16", exact: true }).click()
  await frameOf(page).locator("#calculusRow label").click()
  await expect(saveBar(page)).toBeVisible()

  await page.getByRole("button", { name: "Registrar atención", exact: true }).click()
  const dialog = page.getByRole("dialog", { name: "Registrar atención" })
  await expect(dialog.getByText("La historia tiene cambios sin guardar")).toBeVisible()

  // Validación en línea.
  await dialog.getByRole("button", { name: "Guardar atención" }).click()
  await expect(dialog.getByText("Describe el motivo de consulta")).toBeVisible()
  await expect(dialog.getByText("Registra el diagnóstico")).toBeVisible()

  // La administradora no es profesional: el profesional se elige a mano.
  await chooseOption(dialog, page, "Profesional", /Dra\. Carla Ríos/)
  await dialog.getByLabel("Motivo de consulta", { exact: true }).fill("Control y restauración")
  await dialog.getByLabel("Diagnóstico", { exact: true }).fill("Caries en pieza 46")
  await dialog.getByLabel("Observaciones", { exact: true }).fill("Nota de prueba <script>window.injected=true</script>")

  // Tratamiento propuesto como atajo y otro del catálogo, con el precio del catálogo.
  await dialog.getByRole("button", { name: /Resina compuesta \(46\)/ }).click()
  await chooseOption(dialog, page, "Tratamiento del catálogo", /^Limpieza dental/)
  await dialog.getByRole("button", { name: "Agregar", exact: true }).click()
  const performed = dialog.getByRole("table", { name: "Tratamientos realizados" })
  await expect(performed.getByRole("row")).toHaveCount(4)
  await expect(performed).toContainText("$90,00")

  // Confirmación: «Volver» conserva lo escrito.
  await dialog.getByRole("button", { name: "Guardar atención" }).click()
  const confirm = page.getByRole("alertdialog")
  await expect(confirm).toContainText("Se registrarán 2 tratamientos realizados por $90,00.")
  await expect(confirm).toContainText("Saldrá 1 de los tratamientos propuestos.")
  await expect(confirm).toContainText("También se guardarán los cambios pendientes de la historia")
  await confirm.getByRole("button", { name: "Volver" }).click()
  await expect(dialog.getByLabel("Diagnóstico", { exact: true })).toHaveValue("Caries en pieza 46")
  await dialog.getByRole("button", { name: "Guardar atención" }).click()
  await confirm.getByRole("button", { name: "Confirmar y guardar" }).click()

  await expect(page.getByText("Atención registrada", { exact: true })).toBeVisible()
  await expect(page).toHaveURL(/atencion=/)
  await expect(page.getByRole("tab", { name: "Atenciones", exact: true })).toHaveAttribute("aria-selected", "true")
  await expect(saveBar(page)).toHaveCount(0)

  // El propuesto realizado salió del plan; la pestaña Tratamientos suma todo lo realizado.
  await page.getByRole("tab", { name: "Plan de tratamiento", exact: true }).click()
  await expect(page.getByText("No hay tratamientos propuestos.")).toBeVisible()
  await page.getByRole("tab", { name: "Tratamientos", exact: true }).click()
  await expect(page.getByRole("cell", { name: "Resina compuesta", exact: true })).toBeVisible()
  await expect(page.getByRole("row", { name: /Total/ })).toContainText("$125,00")

  // Nota aclaratoria sobre la atención nueva (la más reciente, primera de la lista).
  await page.getByRole("tab", { name: "Atenciones", exact: true }).click()
  const card = page.locator("article").filter({ hasText: "Caries en pieza 46" })
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

  // PDF de la atención: datos escapados, tratamientos, nota e imagen de la copia.
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
  await popup.close()

  const history = await downloadJson(page)
  expect(history.record.plan).toEqual([])
  expect(history.record.chart.payload.teeth["16"].calculus).toBe(true)
  const encounter = history.encounters.find((item: { diagnosis: string }) => item.diagnosis === "Caries en pieza 46")
  expect(encounter.professionalId).toBe("prof_1")
  expect(encounter.chartSnapshot.payload.teeth["16"].calculus).toBe(true)
  expect(encounter.addenda).toHaveLength(1)
  expect(encounter.performedTreatments).toHaveLength(2)
  for (const item of encounter.performedTreatments) expect(item.assignmentId).toBeTruthy()

  // Navegando dentro de la app (sin recargar los mocks): el tratamiento quedó registrado en el catálogo.
  await page.getByRole("link", { name: "Tratamientos", exact: true }).click()
  await page.getByText("Resina compuesta", { exact: true }).click()
  await expect(page).toHaveURL(/\/tratamientos\/trt_4$/)
  const recipients = page.getByRole("table").filter({ hasText: "María" })
  await expect(recipients).toContainText("46")
  await expect(page.getByRole("button", { name: /Sesión/ })).toHaveCount(0)
  expect(errors).toEqual([])
})

test("desde la cita: registrar atención con la cita precargada y la cita queda completada", async ({ page }) => {
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  await login(page, "medico")

  await page.goto("/historial-clinico/paciente/pat_2?cita=apt_2")
  const dialog = page.getByRole("dialog", { name: "Registrar atención" })
  // La cita viene preseleccionada y define el profesional (el de la cita, no el del usuario).
  await expect(dialog.getByLabel("Profesional", { exact: true })).toContainText("Dr. Andrés Vega")
  await expect(dialog.getByLabel("Cita", { exact: true })).not.toContainText("Sin cita")
  await dialog.getByLabel("Motivo de consulta", { exact: true }).fill("Consulta agendada")
  await dialog.getByLabel("Diagnóstico", { exact: true }).fill("Caries en pieza 26")
  await dialog.getByRole("button", { name: "Guardar atención" }).click()
  const confirm = page.getByRole("alertdialog")
  await expect(confirm).toContainText("La cita vinculada pasará a «Completada»")
  await confirm.getByRole("button", { name: "Confirmar y guardar" }).click()
  await expect(page.getByText("La cita vinculada quedó como completada")).toBeVisible()

  // Pestaña Citas: la cita completada enlaza a su atención.
  await page.getByRole("tab", { name: "Citas", exact: true }).click()
  const row = page.getByRole("table", { name: "Citas del paciente" }).getByRole("row").filter({ hasText: "Completada" })
  await row.getByRole("button", { name: "Ver atención" }).click()
  await expect(page.getByRole("tab", { name: "Atenciones", exact: true })).toHaveAttribute("aria-selected", "true")

  // Volver a abrir desde la cita lleva a la atención existente, sin abrir otra.
  await page.goto("/historial-clinico/paciente/pat_2?cita=apt_2")
  await expect(page.getByRole("tab", { name: "Atenciones", exact: true })).toHaveAttribute("aria-selected", "true")
  await expect(page.getByText("Caries en pieza 26")).toBeVisible()
  await expect(dialog).toHaveCount(0)
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
          attachments: [],
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
  await expect(page.getByRole("tab", { name: "Atenciones", exact: true })).toHaveAttribute("aria-selected", "true")
  await expect(page.locator("article")).toHaveCount(1)
  await expect(page.locator("article")).toContainText("Pulpitis reversible")
  // El borrador sin motivo ni diagnóstico no se convierte en atención; su propuesto queda en el plan.
  await page.getByRole("tab", { name: "Plan de tratamiento", exact: true }).click()
  await expect(page.getByRole("cell", { name: "Resina compuesta", exact: true })).toBeVisible()
  await page.getByRole("tab", { name: "Tratamientos", exact: true }).click()
  await expect(page.getByRole("cell", { name: "Limpieza dental", exact: true })).toBeVisible()
  await expect(page.getByText("Consentimiento de datos pendiente")).toBeVisible()
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

  // Tratamiento propuesto y adjunto (ids generados en el navegador).
  await page.getByRole("tab", { name: "Plan de tratamiento", exact: true }).click()
  const planForm = page.getByRole("form", { name: "Agregar tratamiento propuesto" })
  await chooseOption(planForm, page, "Tratamiento del catálogo", /^Limpieza dental/)
  await planForm.getByRole("button", { name: "Agregar", exact: true }).click()
  await page.getByRole("tab", { name: "Fotos y documentos", exact: true }).click()
  await page.getByLabel("Seleccionar archivos clínicos").setInputFiles({ name: "rx.png", mimeType: "image/png", buffer: png })
  await expect(page.getByText("rx.png", { exact: true })).toBeVisible()
  await saveChanges(page, ["Plan de tratamiento", "Fotos y documentos"])

  // Atención (id generado antes de guardar).
  await page.getByRole("button", { name: "Registrar atención", exact: true }).click()
  const dialog = page.getByRole("dialog", { name: "Registrar atención" })
  await chooseOption(dialog, page, "Profesional", /Dra\. Carla Ríos/)
  await dialog.getByLabel("Motivo de consulta", { exact: true }).fill("Control")
  await dialog.getByLabel("Diagnóstico", { exact: true }).fill("Sin hallazgos")
  await dialog.getByRole("button", { name: "Guardar atención" }).click()
  await page.getByRole("alertdialog").getByRole("button", { name: "Confirmar y guardar" }).click()
  await expect(page.getByText("Atención registrada", { exact: true })).toBeVisible()

  // Imagen del odontograma para el documento (id de la petición al iframe).
  const documentPromise = page.waitForEvent("download")
  await page.getByRole("button", { name: "Documento de la historia", exact: true }).click()
  const html = (await readDownload(await documentPromise)).toString()
  expect(html).toMatch(/<img src="data:image\/png;base64,/)

  // Los ids generados son UUID v4 válidos.
  const history = await downloadJson(page)
  const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
  expect(history.record.plan[0].id).toMatch(uuidV4)
  expect(history.record.attachments[0].id).toMatch(uuidV4)
  expect(history.encounters[0].id).toMatch(uuidV4)
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
  await expect(page.getByRole("tab", { name: "Atenciones", exact: true })).toHaveAttribute("aria-selected", "true")
})

test("recepción no puede acceder al módulo clínico", async ({ page }) => {
  await login(page, "recepcion")
  await page.goto("/historial-clinico/paciente/pat_1")
  await expect(page).toHaveURL(/\/403$/)
  await expect(page.locator("iframe")).toHaveCount(0)
})
