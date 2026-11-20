import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { useBlobUrl, useOriginal } from "../hooks"
import type { ImageTransform } from "../lib/viewer"
import type { DentalAttachment } from "../../types/clinical-history.types"
import { fileName } from "../lib/classification"
import styles from "../archive.module.css"

export function ImageSurface({ patientId, file, transform, onChange, onDimensions, passive = false }: { patientId: string; file: DentalAttachment; transform: ImageTransform; onChange: (value: ImageTransform) => void; onDimensions?: (size: { width: number; height: number }) => void; passive?: boolean }) {
  const query = useOriginal(patientId, file), url = useBlobUrl(query.data), ref = useRef<HTMLDivElement>(null)
  const [bounds, setBounds] = useState({ width: 1, height: 1 }), [size, setSize] = useState({ width: 1, height: 1 }), [broken, setBroken] = useState(false)
  const drag = useRef<{ pointer: number; x: number; y: number; originX: number; originY: number } | null>(null)
  useEffect(() => {
    if (!ref.current) return
    const observer = new ResizeObserver(([entry]) => setBounds({ width: entry.contentRect.width, height: entry.contentRect.height }))
    observer.observe(ref.current); return () => observer.disconnect()
  }, [])
  const vertical = Math.abs(transform.rotation % 180) === 90
  const scale = Math.max(.001, Math.min((bounds.width - 16) / (vertical ? size.height : size.width), (bounds.height - 16) / (vertical ? size.width : size.height))) * transform.zoom
  return <div
    ref={ref}
    className={styles.imageSurface}
    data-zoom={transform.zoom}
    data-rotation={transform.rotation}
    onPointerDown={event => {
      if (passive || event.button !== 0 || !url || broken) return
      event.currentTarget.setPointerCapture(event.pointerId); drag.current = { pointer: event.pointerId, x: event.clientX, y: event.clientY, originX: transform.x, originY: transform.y }
    }}
    onPointerMove={event => {
      const start = drag.current
      if (start && start.pointer === event.pointerId) onChange({ ...transform, x: start.originX + event.clientX - start.x, y: start.originY + event.clientY - start.y })
    }}
    onPointerUp={() => { drag.current = null }}
    onPointerCancel={() => { drag.current = null }}
  >

    {query.isPending ? <p role="status">Cargando original…</p> : query.isError || broken ? <div role="alert">
      <p>No se pudo leer esta imagen original.</p>
      <Button variant="outline" onClick={() => { setBroken(false); void query.refetch() }}>Reintentar</Button>
    </div> : url && <img
      draggable={false}
      src={url}
      alt={fileName(file)}
      style={{ width: size.width, height: size.height, transform: `translate(-50%, -50%) translate(${transform.x}px, ${transform.y}px) rotate(${transform.rotation}deg) scale(${scale})` }}
      onLoad={event => { const next = { width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight }; setSize(next); onDimensions?.(next) }}
      onError={() => setBroken(true)}
    />}

  </div>
}
