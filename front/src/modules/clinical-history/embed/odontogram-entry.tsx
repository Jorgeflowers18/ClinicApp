import { useEffect, useState } from "react"
import { createRoot } from "react-dom/client"
import { OdontogramShell, exportImage, getStatusChart, getOdontogramSummary, importStatus, onStateChange, setReadOnly } from "react-advanced-odontogram"
import type { OdontogramThemeConfig } from "react-advanced-odontogram"
import type { ChartSnapshot } from "../types/clinical-history.types"
import "react-advanced-odontogram/style.css"
import "@fontsource-variable/geist"
import "./odontogram-theme.css"

declare global {
  interface Window { clinicChart?: { snapshot: () => ChartSnapshot } }
}

const channel = "clinicapp:odontogram"
function send(type: string, payload?: unknown) {
  window.parent.postMessage({ channel, type, payload }, window.location.origin)
}

/**
 * Obtiene el PNG del odontograma con el exportador de la propia librería (`exportImage`), que dibuja
 * un SVG independiente del tema y lo entrega a un enlace de descarga `odontogram-*.png`. Solo durante
 * esta llamada se intercepta ese clic para quedarse con la imagen en vez de descargarla; el menú
 * "Exportar" del editor sigue descargando normalmente.
 *
 * Si la librería está terminando otra exportación, `exportImage` vuelve sin hacer nada: se reintenta
 * unas veces antes de devolver `null`.
 */
async function captureOdontogramImage(attempts = 6): Promise<string | null> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const image = await captureOnce()
    if (image) return image
    await new Promise((resolve) => window.setTimeout(resolve, 400))
  }
  return null
}

async function captureOnce(): Promise<string | null> {
  let captured: string | null = null
  const originalClick = HTMLAnchorElement.prototype.click
  HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
    if (this.download.startsWith("odontogram-") && this.href.startsWith("data:image/png")) {
      captured = this.href
      return
    }
    originalClick.call(this)
  }
  document.documentElement.classList.add("clinic-capturing")
  try {
    await exportImage("png")
  } finally {
    HTMLAnchorElement.prototype.click = originalClick
    document.documentElement.classList.remove("clinic-capturing")
  }
  return captured
}

export function EmbeddedOdontogram() {
  const [dark, setDark] = useState(false)
  const [readOnly, setReadonly] = useState(false)
  const [language, setLanguage] = useState<"es" | Parameters<NonNullable<React.ComponentProps<typeof OdontogramShell>["onLanguageChange"]>>[0]>("es")
  const [colors, setColors] = useState<OdontogramThemeConfig["colors"]>({})

  useEffect(() => {
    let initialized = false
    let lastPayload = ""
    const snapshot = (): ChartSnapshot => ({ payload: getStatusChart(), summary: getOdontogramSummary() })
    const emit = () => {
      if (!initialized) return
      const next = snapshot()
      const serialized = JSON.stringify(next.payload)
      if (serialized === lastPayload) return
      lastPayload = serialized
      send("change", next)
    }
    const unsubscribe = onStateChange(emit)
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== location.origin || event.source !== parent || event.data?.channel !== channel) return
      const { type, payload } = event.data
      if (type === "theme") {
        setDark(payload.dark)
        setColors(payload.colors)
        document.documentElement.classList.toggle("dark", payload.dark)
        for (const [key, value] of Object.entries(payload.colors)) {
          document.documentElement.style.setProperty(`--clinic-${key}`, String(value))
        }
      }
      if (type === "capture-image") {
        const requestId = payload?.requestId
        captureOdontogramImage().then(
          (image) => send("image", { requestId, image }),
          (error) => send("image", { requestId, image: null, error: error instanceof Error ? error.message : "No se pudo generar la imagen" })
        )
      }
      if (type === "init" && !initialized) {
        try {
          const chart = payload.chart?.payload ?? getStatusChart()
          // The snapshot owns the entire case, including the upstream treatment plan.
          importStatus({ ...chart, case: { ...chart.case, patientName: payload.patientName, patientDob: payload.birthDate, examDate: payload.date } })
          setReadonly(payload.readOnly)
          setReadOnly(payload.readOnly)
          initialized = true
          window.clinicChart = { snapshot }
          emit()
          send("initialized")
        } catch (error) { send("error", error instanceof Error ? error.message : "No se pudo cargar el odontograma") }
      }
    }
    window.addEventListener("message", onMessage)
    // Spanish is loaded asynchronously by the original component. Hydrate only
    // after its engine has mounted the actual tooth grid, never a timeout guess.
    const readyTimer = window.setInterval(() => {
      if (document.querySelector("#toothGrid")?.children.length) {
        clearInterval(readyTimer)
        send("ready")
      }
    }, 50)
    return () => {
      clearInterval(readyTimer)
      unsubscribe()
      window.removeEventListener("message", onMessage)
      delete window.clinicChart
    }
  }, [])

  return <OdontogramShell language={language} onLanguageChange={setLanguage} darkMode={dark}
    onDarkModeChange={(value) => send("theme-change", value)} readOnly={readOnly}
    themeConfig={{ colors }} enableNotes enableIcdas />
}

// The upstream singleton and global CSS live in this document only.
createRoot(document.getElementById("root")!).render(<EmbeddedOdontogram />)
