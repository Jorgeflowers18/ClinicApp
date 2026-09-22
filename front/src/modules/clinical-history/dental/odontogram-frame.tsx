import { useCallback, useEffect, useImperativeHandle, useRef, useState } from "react"
import { useTheme } from "next-themes"
import type { ChartSnapshot, DentalVisit } from "./types"

export interface ChartHandle { snapshot: () => ChartSnapshot | null }

export function OdontogramFrame({ visit, patientName, birthDate, readOnly, onChange, onReady, handle }: {
  visit: DentalVisit; patientName: string; birthDate: string; readOnly: boolean
  onChange: (chart: ChartSnapshot) => void; onReady: (ready: boolean) => void
  handle: React.RefObject<ChartHandle | null>
}) {
  const frame = useRef<HTMLIFrameElement>(null)
  const initial = useRef({ visit, patientName, birthDate, readOnly })
  const callbacks = useRef({ onChange, onReady })
  const { setTheme } = useTheme()
  const setThemeRef = useRef(setTheme)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState("")
  const send = useCallback((type: string, payload: unknown) => frame.current?.contentWindow?.postMessage({ channel: "clinicapp:odontogram", type, payload }, location.origin), [])
  const syncTheme = useCallback(() => {
    const lightPalette = {
      background: "#f5f1eb",
      panel: "#f9f6f2",
      card: "#f9f6f2",
      text: "#1f2937",
      muted: "#6b7280",
      line: "#e8dcc8",
      accent: "#7c3aed",
      accent2: "#f59e0b",
    }
    send("theme", { dark: false, colors: lightPalette })
  }, [send])
  const themeRef = useRef(syncTheme)
  useEffect(() => { callbacks.current = { onChange, onReady }; themeRef.current = syncTheme; setThemeRef.current = setTheme })
  useEffect(() => {
    // next-themes applies the root class in its own effect. Read tokens after
    // that mutation, rather than pairing the new mode with the previous palette.
    const observer = new MutationObserver(syncTheme)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "style"] })
    const paint = requestAnimationFrame(syncTheme)
    return () => { observer.disconnect(); cancelAnimationFrame(paint) }
  }, [syncTheme, ready])
  useImperativeHandle(handle, () => ({ snapshot: () => frame.current?.contentWindow?.clinicChart?.snapshot() ?? null }), [])

  useEffect(() => {
    callbacks.current.onReady(false)
    const listener = (event: MessageEvent) => {
      if (event.origin !== location.origin || event.source !== frame.current?.contentWindow || event.data?.channel !== "clinicapp:odontogram") return
      const { type, payload } = event.data
      if (type === "ready") {
        const data = initial.current
        themeRef.current()
        send("init", { chart: data.visit.chart, readOnly: data.readOnly, patientName: data.patientName, birthDate: data.birthDate, date: data.visit.date })
      }
      if (type === "initialized") { setReady(true); callbacks.current.onReady(true) }
      if (type === "change" && !initial.current.readOnly) callbacks.current.onChange(payload)
      if (type === "theme-change") setThemeRef.current(payload ? "dark" : "light")
      if (type === "error") setError(String(payload))
    }
    window.addEventListener("message", listener)
    const timer = window.setTimeout(() => setError("El odontograma tarda en cargar. Si no aparece, recarga esta página."), 30000)
    return () => { window.removeEventListener("message", listener); clearTimeout(timer) }
  }, [send])

  return <div className="overflow-hidden rounded-xl border bg-card">
    {!ready && <p role="status" className="p-4 text-sm text-muted-foreground">{error || "Cargando odontograma y periodontograma…"}</p>}
    <iframe ref={frame} src="/odontogram.html" title="Odontograma y periodontograma del paciente"
      className="h-[850px] w-full border-0 bg-background" />
  </div>
}
