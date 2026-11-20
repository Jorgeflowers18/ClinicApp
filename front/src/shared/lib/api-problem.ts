/** Public API error contract. Compatible with ASP.NET ValidationProblemDetails. */
export type ApiErrorKind = "validation" | "business" | "duplicate" | "not-found" | "conflict" | "authentication" | "authorization" | "communication" | "storage" | "internal"
export interface ApiFieldIssue { field: string; message: string; code?: string; recordId?: string }
export interface ProblemDetails {
  type: string; title: string; status: number; detail: string; code: string; kind: ApiErrorKind
  traceId?: string; recordId?: string; errors?: ApiFieldIssue[]
}

export function errorKind(status: number, code = "", fields = false): ApiErrorKind {
  if (status === 401) return "authentication"
  if (status === 403) return "authorization"
  if (!status) return "communication"
  if (status === 404) return "not-found"
  if (code === "STORAGE_ERROR" || status === 507) return "storage"
  if (status >= 500) return "internal"
  if (code === "DUPLICATE_RECORD") return "duplicate"
  if (status === 409 || status === 412) return "conflict"
  if (fields || status === 422) return "validation"
  return "business"
}
export const publicErrorMessages: Record<ApiErrorKind, string> = {
  validation: "Revisa los campos indicados y vuelve a guardar.",
  business: "No se pudo completar la operación. Revisa los datos e inténtalo de nuevo.",
  duplicate: "Este registro ya existe. Revísalo antes de volver a guardar.",
  "not-found": "El registro ya no está disponible. Actualiza la consulta.",
  conflict: "Los datos cambiaron. Revisa la información actual antes de reintentar; tu formulario se conserva.",
  authentication: "Tu sesión no es válida. Inicia sesión para continuar.",
  authorization: "No tienes permiso para realizar esta operación.",
  communication: "No se pudo conectar con el servidor. Comprueba tu conexión antes de reintentar.",
  storage: "No se pudo guardar la información. Revisa el almacenamiento disponible y vuelve a intentar.",
  internal: "El servidor no pudo completar la operación. Conserva tus datos e inténtalo más tarde.",
}

/** Never render stack traces, HTML responses, SQL or credentials as user messages. */
export function publicMessage(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback
  const message = value.trim()
  if (!message || message.length > 700 || /[<>]|\bat\s+\S+\s*\(|\b(select\s+.+\s+from|insert\s+into|update\s+.+\s+set|delete\s+from|SQLSTATE|SqlException|System\.\w+|StackTrace|Exception:|Bearer\s+\S+|password\s*[:=]|connectionstring|[A-Z]:\\|\/var\/|\/home\/)/is.test(message)) return fallback
  return message
}
export function publicIdentifier(value: unknown): string | undefined {
  return typeof value === "string" && /^[a-zA-Z0-9_.:\-]{1,128}$/.test(value) ? value : undefined
}
function object(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}
}
export function normalizeProblem(payload: unknown, status: number, traceId?: unknown): ProblemDetails {
  const data = object(payload), extension = object(data.extensions)
  const code = publicIdentifier(data.code ?? extension.code) ?? (status === 422 ? "VALIDATION_ERROR" : `HTTP_${status || "NETWORK"}`)
  const raw = data.errors ?? data.fieldErrors
  const issues: ApiFieldIssue[] = []
  const append = (field: unknown, message: unknown, issueCode?: unknown, recordId?: unknown) => {
    if (typeof field !== "string" || field.length > 250 || !/^[\w$.[\]-]+$/.test(field)) return
    const safe = publicMessage(message, "")
    if (safe && !issues.some(item => item.field === field && item.message === safe)) issues.push({ field, message: safe, code: publicIdentifier(issueCode), recordId: publicIdentifier(recordId) })
  }
  if (Array.isArray(raw)) raw.slice(0, 200).forEach(value => { const issue = object(value); append(issue.field, issue.message, issue.code, issue.recordId) })
  else Object.entries(object(raw)).slice(0, 200).forEach(([field, messages]) => {
    for (const message of (Array.isArray(messages) ? messages : [messages]).slice(0, 20)) append(field, message)
  })
  const kind = errorKind(status, code, issues.length > 0), fallback = publicErrorMessages[kind]
  // Server failures are always safe fixed text, even when a proxy leaks details.
  const detail = status >= 500 ? fallback : publicMessage(data.detail ?? data.message ?? data.title, fallback)
  return {
    type: `urn:clinicapp:problem:${kind}`, title: fallback, status, detail, code, kind,
    errors: status >= 500 ? [] : issues,
    traceId: publicIdentifier(data.traceId ?? extension.traceId ?? traceId),
    recordId: publicIdentifier(data.recordId ?? extension.recordId),
  }
}
