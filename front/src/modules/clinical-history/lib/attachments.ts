import { ApiError } from "@/shared/types/common"

import { allowedAttachmentTypes, maxAttachmentSize } from "../types/clinical-history.types"

/**
 * Rechaza antes de subir lo que el servidor rechazaría (JPG, PNG, WebP o PDF de hasta 20 MB). El servidor
 * vuelve a comprobarlo con los primeros bytes del archivo.
 */
export function assertAttachment(file: File) {
  if (!(allowedAttachmentTypes as readonly string[]).includes(file.type) || file.size > maxAttachmentSize) {
    throw new ApiError(`${file.name}: utiliza JPG, PNG, WebP o PDF de hasta 20 MB`, 400, [
      { field: "file", message: "Formato o tamaño no permitido" },
    ])
  }
}
