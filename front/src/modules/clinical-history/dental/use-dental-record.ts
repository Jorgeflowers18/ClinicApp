import { useCallback, useEffect, useRef, useState } from "react"
import { readRecord, writeRecord } from "./repository"
import { newVisit, type DentalRecord, type DentalVisit } from "./types"

export function useDentalRecord(patientId: string, professional: string) {
  const [record, setRecord] = useState<DentalRecord | null>(null)
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)
  const current = useRef<DentalRecord | null>(null)
  const revision = useRef(0)
  const queue = useRef<Promise<unknown>>(Promise.resolve())
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const mounted = useRef(false)
  const pending = useRef(false)

  const persist = useCallback((snapshot: DentalRecord) => {
    clearTimeout(timer.current)
    pending.current = true
    if (mounted.current) setSaving(true)
    const operation = queue.current.then(async () => {
      const saved = await writeRecord({ ...snapshot, revision: revision.current })
      revision.current = saved.revision
      return saved
    })
    queue.current = operation.catch(() => undefined)
    let failed = false
    operation.then(() => {
      if (mounted.current) setError("")
    }, (cause) => {
      failed = true
      if (mounted.current) setError(cause instanceof Error ? cause.message : "No se pudo guardar la historia.")
    }).finally(() => {
      if (queue.current === settled) {
        pending.current = failed || Boolean(timer.current)
        if (mounted.current) setSaving(Boolean(timer.current))
      }
    })
    const settled = queue.current
    return operation
  }, [])

  useEffect(() => {
    mounted.current = true
    let cancelled = false
    readRecord(patientId).then((data) => {
      if (cancelled) return
      revision.current = data.revision
      if (!data.draft && data.visits.length === 0) data.draft = newVisit(professional)
      current.current = data
      setRecord(data)
    }).catch((cause) => { if (!cancelled) setError(String(cause.message ?? cause)) })
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (pending.current) { event.preventDefault(); event.returnValue = "" }
    }
    window.addEventListener("beforeunload", beforeUnload)
    return () => {
      cancelled = true
      mounted.current = false
      window.removeEventListener("beforeunload", beforeUnload)
      if (timer.current && current.current) {
        clearTimeout(timer.current)
        void persist(structuredClone(current.current)).catch(() => undefined)
      }
    }
  }, [patientId, professional, persist])

  const updateDraft = useCallback((update: Partial<DentalVisit> | ((draft: DentalVisit) => DentalVisit)) => {
    if (!current.current?.draft) return
    const nextDraft = typeof update === "function" ? update(current.current.draft) : { ...current.current.draft, ...update }
    const next = { ...current.current, draft: nextDraft }
    current.current = next
    setRecord(next)
    pending.current = true
    setSaving(true)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      timer.current = undefined
      void persist(structuredClone(next)).catch(() => undefined)
    }, 350)
  }, [persist])

  const commit = useCallback(async (next: DentalRecord) => {
    clearTimeout(timer.current)
    timer.current = undefined
    await persist(structuredClone(next))
    current.current = next
    setRecord(next)
  }, [persist])

  return { record, error, saving, updateDraft, commit }
}
