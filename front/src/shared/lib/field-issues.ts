import type { FieldValues, Path, UseFormReturn } from "react-hook-form"
import { ApiError, type ApiFieldError } from "@/shared/types/common"
import { publicMessage } from "./api-problem"

export type FieldIssues = Partial<Record<string, string>>
function pathParts(path: string) { return path.replace(/^\$\.?/, "").replace(/\[(\d+)\]/g, ".$1").split(".") }
function samePath(left: string, right: string) { return pathParts(left).join(".").toLowerCase() === pathParts(right).join(".").toLowerCase() }
export function serverFieldIssues(error: unknown, known: readonly string[]): FieldIssues {
  if (!(error instanceof ApiError)) return {}
  const issues: FieldIssues = {}
  for (const item of error.fieldErrors ?? []) {
    const paths = known.filter(path => samePath(path, item.field)), message = publicMessage(item.message, "")
    if (paths.length === 1 && message) issues[paths[0]] = [...new Set([issues[paths[0]], message].filter(Boolean))].join(" ")
  }
  return issues
}

/** Map only paths present in this form, including existing dynamic rows. */
export function applyServerFieldErrors<T extends FieldValues>(form: Pick<UseFormReturn<T>, "getValues" | "setError">, error: unknown): ApiFieldError[] {
  if (!(error instanceof ApiError)) return []
  const values = form.getValues()
  const issues: ApiFieldError[] = []
  for (const item of error.fieldErrors ?? []) {
    let value: unknown = values
    const actual: string[] = []
    for (const part of pathParts(item.field)) {
      if (!value || typeof value !== "object" || ["__proto__", "constructor", "prototype"].includes(part)) break
      const matches = Object.keys(value).filter(key => key.toLowerCase() === part.toLowerCase())
      if (matches.length !== 1) break
      actual.push(matches[0]); value = (value as Record<string, unknown>)[matches[0]]
    }
    const message = publicMessage(item.message, ""), field = actual.join(".")
    if (actual.length !== pathParts(item.field).length || !message) continue
    const previous = issues.find(issue => issue.field === field)
    if (previous) previous.message = [...new Set([previous.message, message])].join(" ")
    else issues.push({ ...item, field, message })
  }
  const position = (path: string) => {
    let value: unknown = values
    return path.split(".").map(part => {
      const object = value as Record<string, unknown>, index = Object.keys(object).indexOf(part)
      value = object[part]
      return index
    })
  }
  issues.sort((a, b) => {
    const left = position(a.field), right = position(b.field)
    for (let i = 0; i < Math.min(left.length, right.length); i++) if (left[i] !== right[i]) return left[i] - right[i]
    return left.length - right.length
  })
  issues.forEach(({ field, message }) => form.setError(field as Path<T>, { type: "server", message }))
  return issues
}
