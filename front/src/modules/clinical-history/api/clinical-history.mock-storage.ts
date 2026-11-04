// MOCK-ONLY: eliminar al conectar el backend (ver arquitectura-frontend.md § Código solo-mock).
//
// Almacenamiento local de demostración. IndexedDB guarda las historias (una por paciente, con su
// estado actual y sus atenciones) y los archivos binarios fuera de localStorage. El nombre y la
// versión de la base no cambian para conservar lo que ya se guardó con versiones anteriores del
// módulo: la conversión se hace al leer (ver `clinical-history.mock-migration.ts`).
import { ApiError } from "@/shared/types/common"

import type { PatientClinicalHistory } from "../types/clinical-history.types"
import { normalizeStoredHistory, referencedFileIds, toStoredHistory } from "./clinical-history.mock-migration"

const DB_NAME = "clinicapp-dental-v1"
const DB_VERSION = 1
const SEED_FLAG = "clinicapp-clinical-history-seeded-v1"

let database: Promise<IDBDatabase> | undefined
let seeding: Promise<void> | undefined

function openDatabase() {
  return (database ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      request.result.createObjectStore("records", { keyPath: "patientId" })
      request.result.createObjectStore("files", { keyPath: "id" })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => {
      database = undefined
      reject(request.error)
    }
    request.onblocked = () => {
      database = undefined
      reject(new ApiError("Cierra las otras pestañas de la aplicación para abrir la historia clínica.", 409))
    }
  }))
}

export async function readHistory(patientId: string): Promise<PatientClinicalHistory> {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const request = db.transaction("records").objectStore("records").get(patientId)
    request.onsuccess = () => resolve(normalizeStoredHistory(request.result, patientId))
    request.onerror = () => reject(request.error)
  })
}

export async function readAllHistories(): Promise<PatientClinicalHistory[]> {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const request = db.transaction("records").objectStore("records").getAll()
    request.onsuccess = () =>
      resolve((request.result as { patientId: string }[]).map((raw) => normalizeStoredHistory(raw, raw.patientId)))
    request.onerror = () => reject(request.error)
  })
}

/**
 * Lee, modifica y guarda la historia de un paciente en UNA sola transacción. `mutate` debe ser
 * síncrona (IndexedDB confirma la transacción en cuanto no quedan operaciones pendientes) y puede
 * lanzar un `ApiError` para abortar sin escribir nada. Los archivos que dejan de estar referenciados
 * se eliminan en la misma transacción, así un fallo nunca deja la historia apuntando a un archivo borrado.
 */
export async function writeHistory(
  patientId: string,
  mutate: (history: PatientClinicalHistory) => PatientClinicalHistory
): Promise<PatientClinicalHistory> {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(["records", "files"], "readwrite")
    const store = tx.objectStore("records")
    const request = store.get(patientId)
    let failure: unknown
    let result: PatientClinicalHistory | undefined

    request.onsuccess = () => {
      const current = normalizeStoredHistory(request.result, patientId)
      try {
        result = mutate(current)
      } catch (error) {
        failure = error
        tx.abort()
        return
      }
      const retained = referencedFileIds(result)
      for (const id of referencedFileIds(current)) {
        if (!retained.has(id)) tx.objectStore("files").delete(id)
      }
      store.put(toStoredHistory(result))
    }
    tx.oncomplete = () => resolve(result as PatientClinicalHistory)
    tx.onabort = () =>
      reject(failure ?? new ApiError("No se pudo guardar la historia. Revisa el espacio disponible del navegador.", 500))
    tx.onerror = () => reject(failure ?? tx.error)
  })
}

export async function storeFile(patientId: string, id: string, file: File) {
  const db = await openDatabase()
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction("files", "readwrite")
    tx.objectStore("files").put({ id, patientId, file })
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error ?? new ApiError("No se pudo guardar el archivo. Revisa el espacio del navegador.", 500))
  })
}

export async function readFile(patientId: string, id: string): Promise<Blob> {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const request = db.transaction("files").objectStore("files").get(id)
    request.onsuccess = () => {
      if (!request.result || request.result.patientId !== patientId) {
        reject(new ApiError("Archivo no disponible para este paciente", 404))
        return
      }
      resolve(request.result.file)
    }
    request.onerror = () => reject(request.error)
  })
}

function isSeeded() {
  try {
    return localStorage.getItem(SEED_FLAG) === "1"
  } catch {
    return false
  }
}

/**
 * Inserta una sola vez las historias de ejemplo. Si el paciente ya tiene historia (por ejemplo,
 * datos de prueba guardados antes), solo se agregan las atenciones semilla que falten.
 */
export function seedOnce(seeds: Record<string, PatientClinicalHistory>) {
  if (isSeeded()) return Promise.resolve()
  return (seeding ??= openDatabase().then(
    (db) =>
      new Promise<void>((resolve, reject) => {
        const tx = db.transaction("records", "readwrite")
        const store = tx.objectStore("records")
        for (const [patientId, seed] of Object.entries(seeds)) {
          const request = store.get(patientId)
          request.onsuccess = () => {
            if (!request.result) {
              store.put(toStoredHistory(seed))
              return
            }
            const current = normalizeStoredHistory(request.result, patientId)
            const existing = new Set(current.encounters.map((encounter) => encounter.id))
            const encounters = [...current.encounters, ...seed.encounters.filter((encounter) => !existing.has(encounter.id))]
            store.put(toStoredHistory({ ...current, encounters }))
          }
        }
        tx.oncomplete = () => {
          try {
            localStorage.setItem(SEED_FLAG, "1")
          } catch {
            // Sin localStorage las semillas se vuelven a evaluar, pero la deduplicación por id evita repetirlas.
          }
          resolve()
        }
        tx.onerror = () => {
          seeding = undefined
          reject(tx.error)
        }
      })
  ))
}
