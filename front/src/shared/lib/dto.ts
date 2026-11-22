/** Los campos que la API devuelve como `null` y el frontend tipa como opcionales (`?: T`). */
export type WithoutNulls<T> = { [K in keyof T]: null extends T[K] ? Exclude<T[K], null> | undefined : T[K] }

/**
 * Convierte los `null` del primer nivel de un DTO en `undefined`, para los modelos que usan campos
 * opcionales. Solo para el mapeo de un `*.http.ts`; los objetos anidados se mapean aparte.
 */
export function withoutNulls<T extends object>(dto: T): WithoutNulls<T> {
  return Object.fromEntries(Object.entries(dto).map(([key, value]) => [key, value ?? undefined])) as WithoutNulls<T>
}
