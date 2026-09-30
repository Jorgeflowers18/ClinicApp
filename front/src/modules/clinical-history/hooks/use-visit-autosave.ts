import { useCallback, useEffect, useRef, useState } from "react"

import { queryClient } from "@/shared/lib/query-client"
import { ApiError } from "@/shared/types/common"

import { clinicalHistoryApi } from "../api/clinical-history.api"
import { clinicalHistoryKeys, updateCachedVisit } from "../api/clinical-history.queries"
import type { DentalVisit } from "../types/clinical-history.types"

export type AutosaveStatus = "idle" | "saving" | "saved" | "error"

const DEBOUNCE_MS = 350

/**
 * Autoguardado del borrador de una visita. Guarda con debounce, en serie (cada guardado envía la
 * revisión que devolvió el anterior) y avisa antes de salir si hay cambios sin guardar. La copia
 * de trabajo vive aquí durante toda la visita: la caché solo recibe el resultado, nunca pisa lo que
 * se está escribiendo.
 */
export function useVisitAutosave(initial: DentalVisit, enabled: boolean) {
  const latest = useRef(initial)
  const revision = useRef(initial.revision)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const queue = useRef<Promise<unknown>>(Promise.resolve())
  const dirty = useRef(false)
  const mounted = useRef(true)
  const [status, setStatus] = useState<AutosaveStatus>("idle")
  const [error, setError] = useState<unknown>(null)

  const run = useCallback((): Promise<unknown> => {
    clearTimeout(timer.current)
    timer.current = undefined
    if (!dirty.current) return queue.current
    dirty.current = false

    const operation = queue.current.then(async () => {
      const saved = await clinicalHistoryApi.saveDraft({ ...latest.current, revision: revision.current })
      revision.current = saved.revision
      latest.current = { ...latest.current, revision: saved.revision }
      updateCachedVisit(saved.patientId, saved)
      queryClient.invalidateQueries({ queryKey: clinicalHistoryKeys.visits() })
      return saved
    })
    queue.current = operation.catch(() => undefined)
    if (mounted.current) setStatus("saving")
    operation.then(
      () => {
        if (!mounted.current || dirty.current || timer.current) return
        setStatus("saved")
        setError(null)
      },
      (cause) => {
        dirty.current = true
        if (!mounted.current) return
        setStatus("error")
        setError(cause)
      }
    )
    return operation
  }, [])

  /** Recibe la visita completa tal como está en pantalla y agenda su guardado. */
  const patch = useCallback(
    (next: DentalVisit) => {
      if (!enabled) return
      latest.current = { ...next, revision: revision.current }
      dirty.current = true
      setStatus("saving")
      clearTimeout(timer.current)
      timer.current = setTimeout(() => {
        void run().catch(() => undefined)
      }, DEBOUNCE_MS)
    },
    [enabled, run]
  )

  /** Guarda de inmediato lo pendiente y devuelve la visita con la revisión vigente. */
  const flush = useCallback(async (): Promise<DentalVisit> => {
    await run()
    await queue.current
    return { ...latest.current, revision: revision.current }
  }, [run])

  useEffect(() => {
    mounted.current = true
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirty.current) return
      event.preventDefault()
      event.returnValue = ""
    }
    window.addEventListener("beforeunload", beforeUnload)
    return () => {
      mounted.current = false
      window.removeEventListener("beforeunload", beforeUnload)
      if (timer.current) void run().catch(() => undefined)
    }
  }, [run])

  const isConflict = error instanceof ApiError && error.status === 409
  return { status, error, isConflict, patch, flush }
}
