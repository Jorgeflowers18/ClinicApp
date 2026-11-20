import { useCallback, useEffect, useMemo, useRef, type RefObject } from "react"
import { useForm, type FieldValues, type Path, type UseFormHandleSubmit, type UseFormProps, type UseFormReturn, type UseFormSetError } from "react-hook-form"
import { focusValidationError } from "../lib/validation-focus"

function currentRoot(preferred: RefObject<HTMLElement | null> | undefined, fallback: RefObject<HTMLElement | null>) {
  return preferred?.current ?? fallback.current
}

function fieldsToRevalidate(errors: unknown, changed: string, prefix = ""): string[] {
  if (!errors || typeof errors !== "object") return []
  if ("message" in errors) {
    const related = prefix === changed || prefix.startsWith(`${changed}.`) || changed.startsWith(`${prefix}.`)
    return prefix && (!("type" in errors) || errors.type !== "server" || related) ? [prefix] : []
  }
  return Object.entries(errors).flatMap(([key, value]) => key === "ref" || key === "root" && !prefix ? []
    : fieldsToRevalidate(value, changed, key === "root" ? prefix : prefix ? `${prefix}.${key}` : key))
}

/** Existing RHF schemas remain authoritative. This adds presentation and coordinated focus only. */
export function useValidatedForm<T extends FieldValues = FieldValues, C = unknown, V = T>(options: UseFormProps<T, C, V> = {}, validationRoot?: RefObject<HTMLElement | null>): UseFormReturn<T, C, V> {
  const form = useForm<T, C, V>({ mode: "onSubmit", reValidateMode: "onChange", ...options, shouldFocusError: false })
  const scope = useRef<HTMLElement | null>(null), cancel = useRef<() => void>(() => undefined), frame = useRef(0)
  useEffect(() => () => { cancel.current(); cancelAnimationFrame(frame.current) }, [])
  useEffect(() => {
    // Encounters validate steps with trigger(), without submitting the entire form.
    // Revalidate only already-invalid fields as their values change; untouched fields stay quiet.
    let scheduled = 0
    const changed = new Set<Path<T>>()
    const unsubscribe = form.subscribe({ formState: { values: true }, callback: ({ name, type }) => {
      if (!name || type === "blur") return
      // A dependency can make a previously-invalid sibling valid. Keep server issues
      // until their own value changes; unrelated edits must never erase them.
      const paths = fieldsToRevalidate(form.formState.errors, name)
      if (!paths.length) return
      paths.forEach(path => changed.add(path as Path<T>))
      cancelAnimationFrame(scheduled)
      scheduled = requestAnimationFrame(() => { const paths = [...changed]; changed.clear(); void form.trigger(paths) })
    } })
    return () => { unsubscribe(); cancelAnimationFrame(scheduled) }
  }, [form])
  const submit = useCallback<UseFormHandleSubmit<T, V>>((valid, invalid) => {
    const execute = form.handleSubmit(valid, async (errors, event) => {
      await invalid?.(errors, event)
      cancel.current = focusValidationError(currentRoot(validationRoot, scope))
    })
    return event => {
      const target = event?.target
      if (target instanceof HTMLElement) scope.current = target.closest("form") ?? target.closest('[role="dialog"]') ?? target
      return execute(event)
    }
  }, [form, validationRoot])
  const setError = useCallback<UseFormSetError<T>>((name, error, config) => {
    form.setError(name, error, { ...config, shouldFocus: false })
    if (name.startsWith("root")) return
    cancelAnimationFrame(frame.current)
    frame.current = requestAnimationFrame(() => {
      if (!scope.current?.isConnected) {
        const ref = form.getFieldState(name as Path<T>).error?.ref
        if (ref instanceof HTMLElement) scope.current = ref.closest("form") ?? ref.closest('[role="dialog"]') ?? ref.closest("main")
      }
      cancel.current = focusValidationError(currentRoot(validationRoot, scope))
    })
  }, [form, validationRoot])
  return useMemo(() => ({ ...form, handleSubmit: submit, setError, get formState() { return form.formState } }), [form, submit, setError])
}
