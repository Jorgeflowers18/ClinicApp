/** Lo que acepta `PUT /auth/me/profile` (`UserProfileRequest`): estos formatos y hasta 400 000 caracteres. */
const accepted = /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+={0,2}$/
export const MAX_AVATAR_LENGTH = 400_000

function encode(image: HTMLImageElement, side: number): string {
  const scale = Math.min(1, side / Math.max(image.naturalWidth || side, image.naturalHeight || side))
  const canvas = document.createElement("canvas")
  canvas.width = Math.max(1, Math.round((image.naturalWidth || side) * scale))
  canvas.height = Math.max(1, Math.round((image.naturalHeight || side) * scale))
  const context = canvas.getContext("2d")
  if (!context) throw new Error("No se pudo preparar la fotografía en este navegador.")
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  const webp = canvas.toDataURL("image/webp", 0.85)
  // Safari antiguo no codifica WebP y devuelve PNG: entonces JPEG, que pesa menos.
  return webp.startsWith("data:image/webp") ? webp : canvas.toDataURL("image/jpeg", 0.85)
}

/**
 * Deja la foto en un formato y un tamaño que la API acepte. Si ya cumple, la devuelve igual; si no (SVG, BMP
 * o una foto grande del teléfono), la reduce a 512 px por lado (o 256 px) y la vuelve a codificar.
 */
export async function fitAvatarImage(dataUrl: string | null): Promise<string | null> {
  if (dataUrl === null || (accepted.test(dataUrl) && dataUrl.length <= MAX_AVATAR_LENGTH)) return dataUrl
  const image = new Image()
  image.src = dataUrl
  await image.decode()
  for (const side of [512, 256]) {
    const encoded = encode(image, side)
    if (encoded.length <= MAX_AVATAR_LENGTH) return encoded
  }
  throw new Error("La foto es demasiado grande. Elige una imagen más liviana.")
}
