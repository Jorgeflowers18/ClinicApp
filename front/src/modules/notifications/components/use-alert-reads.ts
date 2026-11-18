import { useEffect, useRef, useState } from "react"

type ReadState = { ids: Set<string>; error: string; loadError: boolean }

function loadReads(key: string): ReadState {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? "[]")
    if (!Array.isArray(value) || value.some((id) => typeof id !== "string")) throw new Error("Invalid read receipts")
    return { ids: new Set(value), error: "", loadError: false }
  } catch {
    return { ids: new Set(), error: "No se pudo recuperar el estado de lectura de este navegador.", loadError: true }
  }
}

export function useAlertReads(userId: string) {
  const key = `clinicapp.global-alert-reads.${encodeURIComponent(userId)}`
  const [state, setState] = useState(() => loadReads(key))
  const current = useRef(state)
  const publish = (next: ReadState) => { current.current = next; setState(next) }
  useEffect(() => {
    const update = (event: StorageEvent) => {
      if (event.storageArea !== localStorage || (event.key !== key && event.key !== null)) return
      const next = loadReads(key)
      current.current = next
      setState(next)
    }
    window.addEventListener("storage", update)
    return () => window.removeEventListener("storage", update)
  }, [key])
  return {
    ...state,
    retry: () => publish(loadReads(key)),
    markRead: (ids: string[]) => {
      if (current.current.loadError) return
      const nextIds = new Set([...current.current.ids, ...ids])
      try {
        localStorage.setItem(key, JSON.stringify([...nextIds]))
        publish({ ids: nextIds, error: "", loadError: false })
      } catch {
        publish({ ...current.current, error: "No se pudo guardar la lectura en este navegador. Las alertas siguen sin leer." })
      }
    },
  }
}
