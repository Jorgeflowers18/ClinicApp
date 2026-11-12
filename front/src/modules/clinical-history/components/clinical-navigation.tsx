import { ChevronDown, ChevronLeft, ChevronRight, List } from "lucide-react"
import { Menu as MenuPrimitive } from "@base-ui/react/menu"
import type { ReactNode } from "react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"

import type { SectionNavigation } from "../hooks/use-section-navigation"
import styles from "./clinical-navigation.module.css"

interface NavigationProps<T extends string> {
  navigation: SectionNavigation<T>
  controlsInHeader: boolean
}

/** Variante local: sigue dentro del viewport incluso si el selector sale de la vista al redimensionar. */
function ClinicalMenuContent({ children }: { children: ReactNode }) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Positioner side="bottom" align="start" sideOffset={8} collisionPadding={8} sticky className="isolate z-50 outline-none">
        <MenuPrimitive.Popup
          data-slot="dropdown-menu-content"
          aria-label="Secciones de la historia clínica"
          className={`${styles.menu} overflow-x-hidden overflow-y-auto rounded-lg bg-popover p-1 text-popover-foreground outline-none`}
        >
          {children}
        </MenuPrimitive.Popup>
      </MenuPrimitive.Positioner>
    </MenuPrimitive.Portal>
  )
}

function NavigationButtons<T extends string>({ navigation }: { navigation: SectionNavigation<T> }) {
  const { previous, next, select } = navigation
  if (!previous && !next) return null

  return (
    <div role="group" aria-label="Navegación entre secciones" className={styles.buttons}>
      {previous && (
        <Button type="button" variant="outline" className={`${styles.previous} min-h-11 lg:min-h-9`} onClick={() => select(previous.value)}>
          <ChevronLeft aria-hidden="true" />
          Anterior
        </Button>
      )}
      {next && (
        <Button type="button" variant="outline" className={`${styles.next} min-h-11 lg:min-h-9`} onClick={() => select(next.value)}>
          Siguiente
          <ChevronRight aria-hidden="true" />
        </Button>
      )}
    </div>
  )
}

export function ClinicalNavigation<T extends string>({
  navigation,
  controlsInHeader,
  headingId,
  errorSections,
}: NavigationProps<T> & { headingId: string; errorSections?: ReadonlySet<T | undefined> }) {
  const { items, additionalItems, active, index, total, isAdditional, previous, next, select } = navigation
  if (!active) return null

  return (
    <nav aria-label="Secciones de la historia clínica" className={styles.bar} data-slot="clinical-navigation">
      <div className={styles.identification}>
        <div className={styles.heading} aria-live="polite" aria-atomic="true">
          <p className="text-xs leading-5 text-muted-foreground">{isAdditional ? "Sección adicional" : `Sección ${index + 1} de ${total}`}</p>
          <h2 id={headingId} className={`${styles.title} text-sm leading-6 font-semibold`}>{active.label}</h2>
          {errorSections?.has(active.value) && <p className="text-xs text-destructive">Con errores</p>}
        </div>

        {total + additionalItems.length > 1 && (
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button type="button" variant="outline" className={`${styles.selector} min-h-11 lg:min-h-9`} />}>
              <List aria-hidden="true" className={styles.selectorIcon} />
              Ver secciones
              <ChevronDown aria-hidden="true" />
            </DropdownMenuTrigger>
            <ClinicalMenuContent>
              <DropdownMenuRadioGroup value={active.value} onValueChange={(target) => {
                const item = [...items, ...additionalItems].find((candidate) => candidate.value === target)
                if (item) select(item.value)
              }}>
                <DropdownMenuGroup>
                  {additionalItems.length > 0 && <DropdownMenuLabel className={styles.groupLabel}>Secciones clínicas</DropdownMenuLabel>}
                  {items.map((item, itemIndex) => (
                    <DropdownMenuRadioItem key={item.value} value={item.value} closeOnClick className={styles.menuItem}>
                      <span className={styles.itemNumber}>{itemIndex + 1}.</span>
                      <span className={styles.itemLabel}>
                        {item.label}
                        {errorSections?.has(item.value) && <span className="ml-2 text-xs text-destructive">Con errores</span>}
                      </span>
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuGroup>
                {additionalItems.length > 0 && (
                  <>
                    {items.length > 0 && <DropdownMenuSeparator className={styles.separator} />}
                    <DropdownMenuGroup>
                      <DropdownMenuLabel className={styles.groupLabel}>Adicional</DropdownMenuLabel>
                      {additionalItems.map((item) => (
                        <DropdownMenuRadioItem key={item.value} value={item.value} closeOnClick className={`${styles.menuItem} ${styles.additionalItem}`}>
                          <span className={styles.itemLabel}>{item.label}</span>
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuGroup>
                  </>
                )}
              </DropdownMenuRadioGroup>
            </ClinicalMenuContent>
          </DropdownMenu>
        )}
      </div>

      {controlsInHeader && (previous || next) && <NavigationButtons navigation={navigation} />}
    </nav>
  )
}

/** Única ubicación alternativa de los mismos controles, sin duplicarlos en el DOM. */
export function ClinicalNavigationFooter<T extends string>({ navigation, controlsInHeader }: NavigationProps<T>) {
  if (controlsInHeader || (!navigation.previous && !navigation.next)) return null
  return (
    <div className={styles.footer} data-slot="clinical-navigation-footer">
      <NavigationButtons navigation={navigation} />
    </div>
  )
}
