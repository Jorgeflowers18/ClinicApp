/** Formato y tamaño que acepta un campo de imagen de la API (una data URL en base64). */
export interface ImageLimits {
  /** Subtipos de `image/` aceptados, por ejemplo `["png", "jpeg", "webp"]`. */
  formats: readonly string[]
  /** Largo máximo de la data URL. */
  maxLength: number
  /** Lados (px) a los que se reduce, en orden, hasta que quepa. */
  sides?: readonly number[]
  tooLarge: string
}

function encode(image: HTMLImageElement, side: number): string {
  const width = image.naturalWidth || side, height = image.naturalHeight || side
  const scale = Math.min(1, side / Math.max(width, height))
  const canvas = document.createElement("canvas")
  canvas.width = Math.max(1, Math.round(width * scale))
  canvas.height = Math.max(1, Math.round(height * scale))
  const context = canvas.getContext("2d")
  if (!context) throw new Error("No se pudo preparar la imagen en este navegador.")
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  const webp = canvas.toDataURL("image/webp", 0.85)
  // Un navegador que no codifica WebP devuelve PNG: entonces PNG, que conserva la transparencia.
  return webp.startsWith("data:image/webp") ? webp : canvas.toDataURL("image/png")
}

/**
 * Deja una imagen en un formato y un tamaño que la API acepte. Si ya cumple, la devuelve igual; si no (SVG,
 * BMP o una foto grande del teléfono), la reduce y la vuelve a codificar en WebP. Un SVG pasa así a imagen
 * de píxeles, sin el código que podría llevar dentro.
 */
export async function fitImage(dataUrl: string | null, limits: ImageLimits): Promise<string | null> {
  if (dataUrl === null) return null
  const accepted = new RegExp(`^data:image/(${limits.formats.join("|")});base64,[A-Za-z0-9+/]+={0,2}$`)
  if (accepted.test(dataUrl) && dataUrl.length <= limits.maxLength) return dataUrl
  const image = new Image()
  image.src = dataUrl
  await image.decode()
  for (const side of limits.sides ?? [512, 256]) {
    const encoded = encode(image, side)
    if (encoded.length <= limits.maxLength && accepted.test(encoded)) return encoded
  }
  throw new Error(limits.tooLarge)
}

/** `UserProfileRequest.AvatarImage` del back. */
export const avatarLimits: ImageLimits = {
  formats: ["png", "jpeg", "webp", "gif"], maxLength: 400_000, sides: [512, 256],
  tooLarge: "La foto es demasiado grande. Elige una imagen más liviana.",
}

/** `InstitutionProfileRequest.LogoImage` del back (SVG no). */
export const logoLimits: ImageLimits = {
  formats: ["png", "jpeg", "webp"], maxLength: 700_000, sides: [1024, 512, 256],
  tooLarge: "El logo es demasiado grande. Elige una imagen más liviana.",
}
