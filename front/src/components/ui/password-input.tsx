import { useId, useRef, useState, type ComponentProps } from "react"
import { Eye, EyeOff } from "lucide-react"
import { cn } from "@/lib/utils"
import { Input } from "./input"
import styles from "./password-input.module.css"

/** Shares Input's validation, value and ref; visibility is presentation only. */
export function PasswordInput({ id, ref, className, disabled, ...props }: Omit<ComponentProps<"input">, "type">) {
  const generatedId = useId(), inputId = id ?? generatedId
  const input = useRef<HTMLInputElement | null>(null)
  const [visible, setVisible] = useState(false)

  function toggle() {
    const element = input.current
    const focused = document.activeElement === element
    const start = element?.selectionStart, end = element?.selectionEnd, direction = element?.selectionDirection
    setVisible(value => !value)
    if (focused && element) requestAnimationFrame(() => {
      element.focus({ preventScroll: true })
      if (start != null && end != null) element.setSelectionRange(start, end, direction ?? undefined)
    })
  }

  return <div className={styles.root} data-password-input="">
    <Input {...props} id={inputId} type={visible ? "text" : "password"} disabled={disabled}
      className={cn(styles.input, className)} ref={element => {
        input.current = element
        if (typeof ref === "function") return ref(element)
        if (ref) ref.current = element
      }} />
    <button className={styles.toggle} type="button" disabled={disabled}
      aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"} aria-pressed={visible} aria-controls={inputId}
      onPointerDown={event => { if (event.button === 0) { event.preventDefault(); input.current?.focus({ preventScroll: true }) } }}
      onClick={toggle}>
      <Eye className={styles.icon} data-visible={!visible} size={18} aria-hidden="true" />
      <EyeOff className={styles.icon} data-visible={visible} size={18} aria-hidden="true" />
    </button>
  </div>
}
