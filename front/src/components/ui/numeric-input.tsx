import type { ComponentProps, ReactNode } from "react"
import { Input } from "./input"
import styles from "./numeric-input.module.css"

/** Adornments never become part of the native numeric value or form payload. */
export function NumericInput({ prefix, suffix, ...props }: Omit<ComponentProps<typeof Input>, "type" | "prefix"> & { prefix?: ReactNode; suffix?: ReactNode }) {
  return <span className={styles.group} data-numeric-field data-prefix={!!prefix} data-suffix={!!suffix}>
    {prefix && <span className={styles.prefix} aria-hidden="true">{prefix}</span>}
    <Input type="number" {...props} />
    {suffix && <span className={styles.suffix} aria-hidden="true">{suffix}</span>}
  </span>
}
