import { env } from "@/shared/lib/env"
import type { DentalRecord } from "./types"

// Local demo adapter. IndexedDB keeps binary attachments out of localStorage.
// A revision check prevents another browser tab from silently overwriting a visit.
let database: Promise<IDBDatabase> | undefined
function openDatabase() {
  if (!env.useMockApi) throw new Error("El módulo odontológico requiere configurar su API antes de usar datos del servidor.")
  return database ??= new Promise((resolve, reject) => {
    const request = indexedDB.open("clinicapp-dental-v1", 1)
    request.onupgradeneeded = () => {
      request.result.createObjectStore("records", { keyPath: "patientId" })
      request.result.createObjectStore("files", { keyPath: "id" })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => { database = undefined; reject(request.error) }
    request.onblocked = () => { database = undefined; reject(new Error("Cierra las otras pestañas para actualizar el almacenamiento clínico.")) }
  })
}

export async function readRecord(patientId: string): Promise<DentalRecord> {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const request = db.transaction("records").objectStore("records").get(patientId)
    request.onsuccess = () => resolve(request.result ?? { version: 1, patientId, revision: 0, draft: null, visits: [] })
    request.onerror = () => reject(request.error)
  })
}

export async function writeRecord(record: DentalRecord): Promise<DentalRecord> {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(["records", "files"], "readwrite")
    const store = tx.objectStore("records")
    const request = store.get(record.patientId)
    const next = { ...record, revision: record.revision + 1 }
    let conflict = false
    request.onsuccess = () => {
      if ((request.result?.revision ?? 0) !== record.revision) { conflict = true; tx.abort(); return }
      const fileIds = (value: DentalRecord | undefined) => new Set(
        [...(value?.visits ?? []), ...(value?.draft ? [value.draft] : [])].flatMap((visit) => visit.attachments.map((file) => file.id))
      )
      const retained = fileIds(next)
      // Remove binary data in the same transaction as its references. An aborted
      // record write must never leave the previous visit pointing to a deleted file.
      for (const id of fileIds(request.result)) {
        if (!retained.has(id)) tx.objectStore("files").delete(id)
      }
      store.put(next)
    }
    tx.oncomplete = () => resolve(next)
    tx.onabort = () => reject(new Error(conflict
      ? "Otra pestaña modificó esta historia. Recarga la página antes de continuar."
      : "No se pudo guardar. Revisa el espacio disponible del navegador."))
    tx.onerror = () => reject(tx.error)
  })
}

export async function storeFile(patientId: string, id: string, file: File) {
  const db = await openDatabase()
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction("files", "readwrite")
    tx.objectStore("files").put({ id, patientId, file })
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}

export async function readFile(patientId: string, id: string): Promise<File> {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const request = db.transaction("files").objectStore("files").get(id)
    request.onsuccess = () => {
      if (!request.result || request.result.patientId !== patientId) { reject(new Error("Archivo no disponible para este paciente.")); return }
      resolve(request.result.file)
    }
    request.onerror = () => reject(request.error)
  })
}
