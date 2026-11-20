import { useEffect, useRef, useState } from "react"
import { ArrowLeftRight, Download, Info, Maximize, RotateCcw, RotateCw, Scan, ZoomIn, ZoomOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody } from "@/components/ui/dialog"
import { formatDateOnly } from "@/shared/lib/date"
import type { DentalAttachment } from "../../types/clinical-history.types"
import { fileName } from "../lib/classification"
import { initialTransform, downloadOriginal, toggleFullscreen, type ImageTransform } from "../lib/viewer"
import { IconAction } from "./controls"
import { ImageSurface } from "./image-surface"
import { FileInformation } from "./file-viewer"
import type { MetadataOptions } from "./metadata-fields"
import styles from "../archive.module.css"

export function CompareViewer({ patientId, patientName, files, options, onClose }: { patientId: string; patientName: string; files: [DentalAttachment, DentalAttachment]; options: MetadataOptions; onClose: () => void }) {
  const [ordered, setOrdered] = useState(() => [...files].sort((a, b) => (a.archive?.studyDate || a.createdAt).localeCompare(b.archive?.studyDate || b.createdAt)) as [DentalAttachment, DentalAttachment])
  const [transforms, setTransforms] = useState<[ImageTransform, ImageTransform]>([initialTransform(), initialTransform()]), [synchronized, setSynchronized] = useState(false), [mode, setMode] = useState("parallel"), [split, setSplit] = useState(50), [info, setInfo] = useState(false), [error, setError] = useState("")
  const [sizes, setSizes] = useState<Record<string, { width: number; height: number }>>({}), root = useRef<HTMLDivElement>(null)
  const left = sizes[ordered[0].id], right = sizes[ordered[1].id]
  const sliderAllowed = Boolean(left && right && Math.abs(left.width / left.height - right.width / right.height) / (left.width / left.height) < .12)
  useEffect(() => { const element = root.current; return () => { if (element && document.fullscreenElement === element) void document.exitFullscreen().catch(() => undefined) } }, [])
  function change(index: number, value: ImageTransform) { setTransforms(current => current.map((item, i) => i === index ? value : synchronized ? { ...item, zoom: value.zoom } : item) as [ImageTransform, ImageTransform]) }
  const label = (file: DentalAttachment, index: number) => {
    const explicit = options.catalog.tags.filter(tag => file.archive?.tagIds.includes(tag.id)).find(tag => ["antes", "después", "despues"].includes(tag.name.toLocaleLowerCase("es")))
    return explicit?.name ?? (index === 0 ? "Anterior" : "Posterior")
  }
  async function run(operation: () => Promise<unknown>) { setError(""); try { await operation() } catch (error) { setError(error instanceof Error ? error.message : "No se pudo completar") } }
  return <Dialog open onOpenChange={open => !open && onClose()}>
    <DialogContent
      ref={root}
      variant="complex"
      className={styles.comparator}
    >
      <DialogHeader>
        <DialogTitle>Comparación visual de imágenes</DialogTitle>
        <DialogDescription>{patientName}. Comparación visual orientativa; sin alineación ni medición clínica validada.</DialogDescription>
      </DialogHeader>
      <div className={styles.viewerToolbar}>
        <div className={styles.segmented}>
          <Button
            size="sm"
            variant={mode === "parallel" ? "secondary" : "ghost"}
            onClick={() => setMode("parallel")}
          >Lado a lado</Button>
          <Button
            size="sm"
            disabled={!sliderAllowed}
            title={sliderAllowed ? "Comparar con deslizador" : "Necesita dos imágenes con proporciones similares"}
            variant={mode === "slider" ? "secondary" : "ghost"}
            onClick={() => { setTransforms([initialTransform(), initialTransform()]); setMode("slider") }}
          >Deslizador</Button>
        </div>
        <label className={styles.check}><input
          type="checkbox"
          checked={synchronized}
          onChange={event => setSynchronized(event.target.checked)}
        />Sincronizar zoom</label>
        <IconAction
          label="Intercambiar imágenes"
          icon={ArrowLeftRight}
          onClick={() => { setOrdered([ordered[1], ordered[0]]); setTransforms([transforms[1], transforms[0]]); setSplit(100 - split) }}
        />
        <IconAction
          label="Ajustar ambas imágenes"
          icon={Scan}
          onClick={() => setTransforms(current => current.map(item => ({ ...item, zoom: 1, x: 0, y: 0 })) as [ImageTransform, ImageTransform])}
        />
        <Button
          size="sm"
          variant="ghost"
          onClick={() => { setTransforms([initialTransform(), initialTransform()]); setSplit(50) }}
        >Restablecer</Button>
        <IconAction
          label="Pantalla completa"
          icon={Maximize}
          onClick={() => void run(() => toggleFullscreen(root.current))}
        />
        <IconAction
          label="Mostrar información de las imágenes"
          icon={Info}
          pressed={info}
          onClick={() => setInfo(!info)}
        />
      </div>
      <DialogBody className={styles.viewerBody}>
        <p className={styles.hint}>Comprueba encuadre, perspectiva y escala. Las proporciones originales se conservan; no se igualan estructuras anatómicas. Sin fecha de estudio, el orden inicial usa la fecha de carga.</p>
        {error && <p role="alert" className={styles.error}>
          {error}
        </p>}

        {mode === "parallel" ? <div className={styles.compareGrid}>
          {ordered.map((file, index) => <section key={file.id}>
            <header>
              <strong>
                {label(file, index)}
              </strong>
              <span>
                {file.archive?.studyDate ? formatDateOnly(file.archive.studyDate) : "Sin fecha de estudio"}
              </span>
            </header>
            <p className={styles.compareName}>
              {fileName(file)}
            </p>
            <div className={styles.viewerToolbar}>
              <IconAction
                label={`Acercar imagen ${index + 1}`}
                icon={ZoomIn}
                onClick={() => change(index, { ...transforms[index], zoom: Math.min(8, transforms[index].zoom + .25) })}
              />
              <IconAction
                label={`Alejar imagen ${index + 1}`}
                icon={ZoomOut}
                onClick={() => change(index, { ...transforms[index], zoom: Math.max(.25, transforms[index].zoom - .25) })}
              />
              <IconAction
                label={`Girar imagen ${index + 1} a la izquierda`}
                icon={RotateCcw}
                onClick={() => change(index, { ...transforms[index], rotation: transforms[index].rotation - 90 })}
              />
              <IconAction
                label={`Girar imagen ${index + 1} a la derecha`}
                icon={RotateCw}
                onClick={() => change(index, { ...transforms[index], rotation: transforms[index].rotation + 90 })}
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void run(() => downloadOriginal(patientId, file))}
              ><Download />Original</Button>
            </div>
            <ImageSurface
              patientId={patientId}
              file={file}
              transform={transforms[index]}
              onChange={value => change(index, value)}
              onDimensions={size => setSizes(current => ({ ...current, [file.id]: size }))}
            />
            {info && <FileInformation file={file} options={options} />}
          </section>)}
        </div> : <>
          <div className={styles.sliderImages}>
            <ImageSurface
              patientId={patientId}
              file={ordered[0]}
              transform={initialTransform()}
              onChange={() => undefined}
              passive
            />
            <div className={styles.sliderOverlay} style={{ clipPath: `inset(0 0 0 ${split}%)` }}>
              <ImageSurface
                patientId={patientId}
                file={ordered[1]}
                transform={initialTransform()}
                onChange={() => undefined}
                passive
              />
            </div>
            <div className={styles.sliderLine} style={{ left: `${split}%` }} />
            <span className={styles.sliderLeft}>
              {label(ordered[0], 0)}
            </span>
            <span className={styles.sliderRight}>
              {label(ordered[1], 1)}
            </span>
          </div>
          <label className={styles.sliderControl}>Comparar imágenes<input
            type="range"
            min={0}
            max={100}
            value={split}
            aria-label="Posición del comparador"
            onChange={event => setSplit(Number(event.target.value))}
          /></label>
          <div className={styles.actions}>
            {ordered.map(file => <Button
              variant="outline"
              size="sm"
              key={file.id}
              onClick={() => void run(() => downloadOriginal(patientId, file))}
            >
              <Download />
              {fileName(file)}
            </Button>)}
          </div>
          {info && ordered.map(file => <FileInformation
            key={file.id}
            file={file}
            options={options}
          />)}
        </>}

        {!sliderAllowed && <p className={styles.hint}>El deslizador se habilita al cargar dos imágenes con proporciones similares. La comparación lado a lado sigue disponible.</p>}

      </DialogBody>
    </DialogContent>
  </Dialog>
}
