/**
 * Genera un identificador UUID v4.
 *
 * `crypto.randomUUID` solo existe en contextos seguros (HTTPS o `localhost`): si la app se sirve por
 * HTTP en una IP, es `undefined` y llamarla rompe la pantalla. En ese caso el UUID se arma con
 * `crypto.getRandomValues`, que está disponible también sin HTTPS y usa la misma fuente aleatoria.
 *
 * Usar siempre esta función en lugar de `crypto.randomUUID()` directo.
 */
export function createId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") return globalThis.crypto.randomUUID()

  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40 // versión 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80 // variante RFC 4122
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
