import { useEffect, useRef, useState, type ChangeEvent } from "react"
import { ImagePlus, LoaderCircle, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { InstitutionMark } from "./institution-brand"
import styles from "./institution-logo-controls.module.css"

export function InstitutionLogoControls({ name, image, savedImage, onChange, onReadingChange }: {
  name: string; image: string | null; savedImage: string | null; onChange: (image: string | null) => void; onReadingChange: (reading: boolean) => void
}) {
  const input = useRef<HTMLInputElement>(null)
  const reader = useRef<FileReader | null>(null)
  const version = useRef(0)
  const [reading, setReading] = useState(false)
  const [error, setError] = useState("")
  const [status, setStatus] = useState("")
  useEffect(() => () => { version.current++; reader.current?.abort() }, [])

  function finish() { setReading(false); onReadingChange(false) }
  function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return
    const token = ++version.current
    reader.current?.abort()
    setError(""); setStatus(""); setReading(true); onReadingChange(true)
    const fail = () => {
      if (token !== version.current) return
      finish()
      setError("No se pudo leer la imagen. El logo anterior se conserva. Selecciona un archivo de imagen válido.")
    }
    if (file.type && !file.type.startsWith("image/")) { fail(); return }
    const fileReader = new FileReader()
    reader.current = fileReader
    fileReader.onerror = fail
    fileReader.onload = async () => {
      try {
        if (typeof fileReader.result !== "string") { fail(); return }
        const src = fileReader.result
        const candidate = new Image()
        candidate.src = src
        await candidate.decode()
        if (token !== version.current) return
        onChange(src)
        finish()
        setStatus("Imagen lista. Pulsa Guardar cambios para aplicarla.")
      } catch { fail() }
    }
    try { fileReader.readAsDataURL(file) } catch { fail() }
  }

  return <div className={styles.controls} aria-busy={reading}>
    <div className={styles.preview}>
      <InstitutionMark name={name} image={image} className={styles.logo} />
      <div><p className={styles.name}>{name || "Nombre de la clínica"}</p><p className={styles.hint}>{image ? "Logo institucional" : "Iniciales automáticas del nombre"}</p></div>
    </div>
    <div className={styles.actions}>
      <Button type="button" variant="outline" onClick={() => input.current?.click()}><ImagePlus aria-hidden="true" />{image ? "Reemplazar imagen" : "Subir imagen"}</Button>
      {image && <Button type="button" variant="ghost" aria-label="Quitar imagen institucional" onClick={() => {
        version.current++; reader.current?.abort(); finish(); setError(""); onChange(null)
        setStatus("Se mostrarán las iniciales al guardar los cambios.")
      }}><Trash2 aria-hidden="true" />Quitar</Button>}
      <input ref={input} type="file" accept="image/*" hidden aria-label="Imagen institucional" onChange={handleFile} />
    </div>
    {reading && <p className={styles.feedback} role="status"><LoaderCircle className="animate-spin" aria-hidden="true" />Leyendo imagen…</p>}
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {!reading && status && <p role="status" className={styles.hint}>{image !== savedImage ? status : image ? "Logo institucional guardado." : "Se utilizan las iniciales del nombre."}</p>}
    <p className={styles.hint}>El logo o las dos iniciales identificarán a la institución en el menú lateral después de guardar.</p>
  </div>
}
