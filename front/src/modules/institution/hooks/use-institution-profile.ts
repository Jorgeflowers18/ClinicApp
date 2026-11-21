import { useSyncExternalStore } from "react"
import { initialInstitutionProfile, INSTITUTION_PROFILE_CHANGED, INSTITUTION_PROFILE_STORAGE_KEY, readInstitutionProfile, readSavedInstitutionName } from "../types/institution.types"

let lastRaw: string | null | undefined
let lastProfile = initialInstitutionProfile

function getSnapshot() {
  let raw: string | null = null
  try { raw = window.localStorage.getItem(INSTITUTION_PROFILE_STORAGE_KEY) } catch { /* Use the existing reader's fallback. */ }
  if (raw !== lastRaw) {
    lastRaw = raw
    lastProfile = readInstitutionProfile()
  }
  return lastProfile
}

function subscribe(onChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.storageArea === window.localStorage && (event.key === INSTITUTION_PROFILE_STORAGE_KEY || event.key === null)) onChange()
  }
  window.addEventListener(INSTITUTION_PROFILE_CHANGED, onChange)
  window.addEventListener("storage", onStorage)
  return () => {
    window.removeEventListener(INSTITUTION_PROFILE_CHANGED, onChange)
    window.removeEventListener("storage", onStorage)
  }
}

/** Subscribe to the existing local record, without creating a second source of truth. */
export function useInstitutionProfile() {
  return useSyncExternalStore(subscribe, getSnapshot, () => initialInstitutionProfile)
}

/**
 * Nombre institucional guardado (o null si no se configuró), con la misma suscripción que la marca:
 * se actualiza al guardar el perfil, también desde otra pestaña. Los cambios sin guardar no lo afectan.
 */
export function useSavedInstitutionName() {
  return useSyncExternalStore(subscribe, readSavedInstitutionName, () => null)
}
