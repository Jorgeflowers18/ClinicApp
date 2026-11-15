import { useRef } from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { Switch } from "@/components/ui/switch"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import styles from "./header-theme-switch.module.css"

export function HeaderThemeSwitch() {
  const { resolvedTheme, setTheme } = useTheme()
  const controlRef = useRef<HTMLButtonElement>(null)
  const checked = resolvedTheme === "dark"

  const changeTheme = (dark: boolean) => {
    const thumb = controlRef.current?.querySelector<HTMLElement>('[data-slot="switch-thumb"]')
    const from = thumb ? getComputedStyle(thumb).transform : "none"
    thumb?.getAnimations().forEach((animation) => animation.cancel())
    setTheme(dark ? "dark" : "light")

    if (!thumb || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    // next-themes intentionally disables CSS transitions throughout the app.
    // Animate only this thumb, from its current visual position, without theme state.
    thumb.animate([{ transform: from }, { transform: `translateX(${dark ? 28 : 0}px)` }], {
      duration: 220,
      easing: "cubic-bezier(0.22, 1, 0.36, 1)",
    })
  }

  return <div className={styles.row} data-dark={checked}>
    <Tooltip>
      <TooltipTrigger render={<Switch ref={controlRef} checked={checked} onCheckedChange={changeTheme} aria-label="Modo oscuro" className={styles.control} />} />
      <TooltipContent side="bottom">{checked ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}</TooltipContent>
    </Tooltip>
    <Sun aria-hidden="true" className={styles.sun} /><Moon aria-hidden="true" className={styles.moon} />
  </div>
}
