import { expect, test } from "@playwright/test"
import { loginArchive, openArchive, seedArchive } from "./helpers/clinical-archive"

test.use({ timezoneId: "America/Guayaquil", reducedMotion: "reduce" })

test("v1 database upgrades additively and keeps legacy originals, consent and requested exam links", async ({ page }) => {
  await page.goto("/login")
  await page.evaluate(async () => {
    const path = "/src/modules/clinical-history/api/clinical-history.mock-migration.ts"
    const { emptyRecord, toStoredHistory } = await import(path)
    const record = emptyRecord("pat_5")
    record.attachments = [{ id: "legacy-pdf", name: "consentimiento-original.pdf", mime: "application/pdf", size: 25, kind: "consentimiento", createdAt: "2020-01-01T12:00:00.000Z" }]
    record.dataConsent.attachmentId = "legacy-pdf"
    record.examRequests = [{ id: "legacy-exam", kind: "laboratorio", detail: "Prueba", status: "recibido", encounterId: null, requestedAt: "2020-01-01", attachmentId: "legacy-pdf", receivedAt: "2020-01-02" }]
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open("clinicapp-dental-v1", 1)
      request.onupgradeneeded = () => { request.result.createObjectStore("records", { keyPath: "patientId" }); request.result.createObjectStore("files", { keyPath: "id" }) }
      request.onsuccess = () => {
        const db = request.result, tx = db.transaction(["records", "files"], "readwrite")
        tx.objectStore("records").put(toStoredHistory({ record, encounters: [] }))
        tx.objectStore("files").put({ id: "legacy-pdf", patientId: "pat_5", file: new Blob(["%PDF-1.4\nlegacy-test\n%%EOF"], { type: "application/pdf" }) })
        tx.oncomplete = () => { db.close(); resolve() }; tx.onabort = () => reject(tx.error)
      }; request.onerror = () => reject(request.error)
    })
  })
  await loginArchive(page)
  const result = await page.evaluate(async () => {
    const p = "/src/modules/clinical-history/archive/api.ts", c = "/src/modules/clinical-history/api/clinical-history.api.ts"
    const [{ archiveApi }, { clinicalHistoryApi }] = await Promise.all([import(p), import(c)])
    const before = await clinicalHistoryApi.getRecord("pat_5")
    const archived = await archiveApi.archive("pat_5", "legacy-pdf", 0, true)
    return { before, archived, original: await (await archiveApi.original("pat_5", "legacy-pdf")).text(), catalog: await archiveApi.catalog(), version: await new Promise<number>(resolve => { const request = indexedDB.open("clinicapp-dental-v1"); request.onsuccess = () => { resolve(request.result.version); request.result.close() } }) }
  })
  expect(result.version).toBe(2)
  expect(result.original).toBe("%PDF-1.4\nlegacy-test\n%%EOF")
  expect(result.before.record.attachments[0].archive).toBeUndefined()
  expect(result.archived.record.dataConsent).toEqual(result.before.record.dataConsent)
  expect(result.archived.record.examRequests).toEqual(result.before.record.examRequests)
  expect(result.archived.record.attachments[0].archive.audit).toHaveLength(1)
  expect(result.catalog.categories).toEqual([])
})

test("service rejects corrupt, empty, too large, duplicate and unrelated files and rolls back quota failures", async ({ page }) => {
  await loginArchive(page)
  const [id] = await seedArchive(page, 1)
  const result = await page.evaluate(async id => {
    const a = "/src/modules/clinical-history/archive/api.ts", t = "/src/modules/clinical-history/archive/types.ts", c = "/src/modules/clinical-history/api/clinical-history.api.ts"
    const [{ archiveApi }, { emptyFileDraft }, { clinicalHistoryApi }] = await Promise.all([import(a), import(t), import(c)])
    const draft = { ...emptyFileDraft(), displayName: "Archivo de prueba", clinicalType: "fotografias" }
    const original = await archiveApi.original("pat_5", id)
    const errors: string[] = []
    const reject = async (operation: () => Promise<unknown>) => { try { await operation(); errors.push("UNEXPECTED_SUCCESS") } catch (error) { errors.push((error as Error).message) } }
    await reject(() => archiveApi.attach("pat_5", new File([], "empty.png", { type: "image/png" }), draft))
    await reject(() => archiveApi.attach("pat_5", new File([new Uint8Array(21 * 1024 * 1024)], "large.png", { type: "image/png" }), draft))
    await reject(() => archiveApi.attach("pat_5", new File(["corrupt"], "fake.png", { type: "image/png" }), draft))
    await reject(() => archiveApi.attach("pat_5", new File([original], "mismatch.pdf", { type: "application/pdf" }), draft))
    await reject(() => archiveApi.attach("pat_5", new File([original], "duplicate.png", { type: "image/png" }), draft))
    await reject(() => archiveApi.attach("pat_5", new File([original], "wrong-patient.png", { type: "image/png" }), { ...draft, encounterId: "not-this-patient" }))
    await reject(() => archiveApi.attach("pat_5", new File([original], "wrong-treatment.png", { type: "image/png" }), { ...draft, treatmentId: "not-this-patient" }))
    await reject(() => archiveApi.attach("pat_5", new File([original], "wrong-date.png", { type: "image/png" }), { ...draft, studyDate: "2026-02-31" }))
    const oldAdd = IDBObjectStore.prototype.add
    IDBObjectStore.prototype.add = function(value, key) { if (this.name === "files") throw new DOMException("Simulated full disk", "QuotaExceededError"); return key === undefined ? oldAdd.call(this, value) : oldAdd.call(this, value, key) }
    try { await reject(() => archiveApi.attach("pat_5", new File(["%PDF-1.4\ntest-only\n%%EOF"], "quota.pdf", { type: "application/pdf" }), { ...draft, clinicalType: "documento_clinico" })) }
    finally { IDBObjectStore.prototype.add = oldAdd }
    return { errors, files: (await clinicalHistoryApi.getRecord("pat_5")).record.attachments.length }
  }, id)
  expect(result.errors).toHaveLength(9)
  expect(result.errors.join(" ")).not.toContain("UNEXPECTED_SUCCESS")
  expect(result.errors[0]).toContain("vacío")
  expect(result.errors[1]).toContain("20 MB")
  expect(result.errors[4]).toContain("ya está registrado")
  expect(result.errors[8]).toContain("espacio disponible")
  expect(result.files).toBe(1)
})

test("date filters use study dates, normalization preserves original audit and draft merges are local", async ({ page }) => {
  await loginArchive(page)
  const result = await page.evaluate(async () => {
    const p = "/src/modules/clinical-history/archive/lib/filter.ts", t = "/src/modules/clinical-history/archive/types.ts"
    const [{ dateBounds, emptyFilters, mergeArchiveRows, selectClinicalFiles }, { emptyArchiveCatalog }] = await Promise.all([import(p), import(t)])
    const filters = emptyFilters(), now = new Date("2026-11-19T12:00:00-05:00")
    const file = (id: string, studyDate: string | null) => ({ id, name: id, kind: "otro", mime: "application/pdf", size: 1, createdAt: "2026-11-19T10:00:00Z", archive: { studyDate, tagIds: [], clinicalType: "documento_clinico", archivedAt: null } })
    const selected = selectClinicalFiles([file("unknown-study", null), file("real-study", "2026-11-19"), file("old-study", "2025-01-01")], { ...filters, date: "today" }, emptyArchiveCatalog(), {}, now)
    const baseline = [{ id: "file-a", value: "original" }, { id: "file-b", value: "old" }]
    const draft = [{ id: "file-a", value: "local draft" }, { id: "file-b", value: "old" }, { id: "local-file", value: "draft upload" }]
    const confirmed = [{ id: "file-a", value: "original" }, { id: "file-b", value: "changed metadata" }, { id: "new-file", value: "saved upload" }]
    return { selected: selected.map((item: { id: string }) => item.id), week: dateBounds({ ...filters, date: "week" }, now), month: dateBounds({ ...filters, date: "month" }, now), merged: mergeArchiveRows(baseline, draft, confirmed) }
  })
  expect(result.selected).toEqual(["real-study"])
  expect(result.week).toEqual(["2026-11-16", "2026-11-22"])
  expect(result.month).toEqual(["2026-11-01", "2026-11-30"])
  expect(result.merged).toEqual([{ id: "file-a", value: "local draft" }, { id: "file-b", value: "changed metadata" }, { id: "new-file", value: "saved upload" }, { id: "local-file", value: "draft upload" }])
})

test("rapid patient navigation clears viewers, selection and files; reception cannot call archive services", async ({ page }) => {
  await loginArchive(page)
  await seedArchive(page, 1)
  await openArchive(page)
  await page.getByRole("checkbox", { name: "Comparar Imagen de prueba 1", exact: true }).check()
  await openArchive(page, "pat_1")
  await expect(page.getByRole("button", { name: "Imagen de prueba 1", exact: true })).toHaveCount(0)
  await expect(page.getByText("1 de 2 imágenes seleccionadas", { exact: true })).toHaveCount(0)
  const denied = await page.evaluate(async () => {
    const a = "/src/modules/clinical-history/archive/api.ts", auth = "/src/modules/auth/store/auth-store.ts"
    const [{ archiveApi }, { useAuthStore }] = await Promise.all([import(a), import(auth)])
    const user = useAuthStore.getState().user
    useAuthStore.setState({ user: { ...user, role: "recepcion" } })
    const errors: number[] = []
    for (const operation of [() => archiveApi.catalog(), () => archiveApi.original("pat_5", "unowned"), () => archiveApi.category({ name: "Unauthorized", description: "", color: "neutral", archivedAt: null })]) {
      try { await operation(); errors.push(200) } catch (error) { errors.push((error as { status: number }).status) }
    }
    return errors
  })
  expect(denied).toEqual([403, 403, 403])
})
