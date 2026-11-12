import { useEffect, useLayoutEffect, useState, type RefObject } from "react"

export interface NavigationSection<T extends string> {
  value: T
  label: string
}

export interface SectionNavigation<T extends string> {
  items: readonly NavigationSection<T>[]
  additionalItems: readonly NavigationSection<T>[]
  active: NavigationSection<T> | undefined
  index: number
  total: number
  isAdditional: boolean
  previous: NavigationSection<T> | undefined
  next: NavigationSection<T> | undefined
  select: (value: T) => void
}

/** La lista recibida ya debe incluir únicamente las secciones disponibles para el usuario. */
export function useSectionNavigation<T extends string>(
  items: readonly NavigationSection<T>[],
  value: T,
  onValueChange: (value: T) => void,
  additionalItems: readonly NavigationSection<T>[] = [],
): SectionNavigation<T> {
  const selectedIndex = items.findIndex((item) => item.value === value)
  const selectedAdditional = additionalItems.find((item) => item.value === value)
  const index = selectedIndex >= 0 ? selectedIndex : selectedAdditional ? -1 : items.length > 0 ? 0 : -1
  const active = selectedAdditional ?? items[index] ?? additionalItems[0]
  const isAdditional = Boolean(active && !items.some((item) => item.value === active.value))

  useEffect(() => {
    if (!active) return
    // Si desaparece el destino activo, selecciona el primero disponible sin reiniciar el formulario.
    if (active.value !== value) onValueChange(active.value)
  }, [active, value, onValueChange])

  return {
    items,
    additionalItems,
    active,
    index,
    total: items.length,
    isAdditional,
    previous: !isAdditional && index > 0 ? items[index - 1] : undefined,
    next: !isAdditional && index >= 0 && index < items.length - 1 ? items[index + 1] : undefined,
    select: (target) => {
      if (target !== value && [...items, ...additionalItems].some((item) => item.value === target)) onValueChange(target)
    },
  }
}

/** Solo controla la ubicación de los botones; el identificador activo sigue siendo el del formulario. */
export function useNavigationPlacement(container: RefObject<HTMLElement | null>) {
  const [inHeader, setInHeader] = useState(false)

  useLayoutEffect(() => {
    const element = container.current
    if (!element) return
    const measure = () => setInHeader(element.clientWidth >= 896)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [container])

  return inHeader
}
