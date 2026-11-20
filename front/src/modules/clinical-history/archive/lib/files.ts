import { ApiError } from "@/shared/types/common"
import { maxAttachmentSize } from "../../types/clinical-history.types"

export const maxArchiveBatch = 20
export const maxArchiveBatchBytes = 100 * 1024 * 1024

/** Inspect content, not just the name or the browser's declared MIME. */
export async function inspectClinicalFile(file: File) {
  if (!file.size) throw new ApiError(`${file.name}: el archivo está vacío.`, 400)
  if (file.size > maxAttachmentSize) throw new ApiError(`${file.name}: el máximo es 20 MB por archivo.`, 400)
  const bytes = new Uint8Array(await file.arrayBuffer())
  const starts = (...values: number[]) => values.every((value, index) => bytes[index] === value)
  let mime = ""
  if (starts(0xff, 0xd8, 0xff)) mime = "image/jpeg"
  else if (starts(137, 80, 78, 71, 13, 10, 26, 10)) mime = "image/png"
  else if (starts(82, 73, 70, 70) && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") mime = "image/webp"
  else if (starts(37, 80, 68, 70, 45) && new TextDecoder().decode(bytes.slice(-2048)).includes("%%EOF")) mime = "application/pdf"
  if (!mime || file.type && file.type !== mime) throw new ApiError(`${file.name}: el contenido no corresponde a un JPG, PNG, WebP o PDF válido.`, 400)
  let thumbnail: Blob | undefined
  if (mime.startsWith("image/")) {
    try { thumbnail = await createClinicalThumbnail(new Blob([bytes], { type: mime })) }
    catch { throw new ApiError(`${file.name}: la imagen está dañada o no se puede leer.`, 400) }
  }
  const digest = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))).map((value) => value.toString(16).padStart(2, "0")).join("")
  return { file: new File([file], file.name, { type: mime, lastModified: file.lastModified }), mime, digest, thumbnail }
}

/** A small derivative for browsing only. The original is never replaced or re-encoded. */
export async function createClinicalThumbnail(blob: Blob): Promise<Blob> {
  const image = await createImageBitmap(blob)
  try {
    const scale = Math.min(1, 512 / Math.max(image.width, image.height))
    const canvas = document.createElement("canvas")
    canvas.width = Math.max(1, Math.round(image.width * scale)); canvas.height = Math.max(1, Math.round(image.height * scale))
    const context = canvas.getContext("2d")
    if (!context) throw new Error("Canvas no disponible")
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    return await new Promise((resolve, reject) => canvas.toBlob((result) => result ? resolve(result) : reject(new Error("No se pudo crear la miniatura")), "image/webp", .8))
  } finally { image.close() }
}
