import { useLayoutEffect, useRef, useState, type ReactNode } from "react"
import { MoreHorizontal } from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

import { Tabs, TabsList, TabsTrigger } from "./tabs"

export interface AdaptiveTabItem {
  value: string
  label: ReactNode
  menuLabel?: ReactNode
  accessibleLabel?: string
}

interface AdaptiveTabsProps {
  items: AdaptiveTabItem[]
  children: ReactNode
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  className?: string
  listClassName?: string
  contentClassName?: string
  variant?: "default" | "line"
}

export function AdaptiveTabs({
  items,
  children,
  value,
  defaultValue,
  onValueChange,
  className,
  listClassName,
  contentClassName,
  variant = "default",
}: AdaptiveTabsProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const itemMeasureRefs = useRef<Array<HTMLSpanElement | null>>([])
  const moreMeasureRef = useRef<HTMLSpanElement>(null)
  const itemsRef = useRef(items)
  const [visibleCount, setVisibleCount] = useState(items.length)
  const [uncontrolledValue, setUncontrolledValue] = useState(
    defaultValue ?? items[0]?.value ?? ""
  )
  const [isMoreOpen, setIsMoreOpen] = useState(false)
  const selectedValue = value ?? uncontrolledValue
  const activeIndex = items.findIndex((item) => item.value === selectedValue)
  const activeItemIsOverflowed = activeIndex >= visibleCount
  const itemSignature = items.map((item) => item.value).join("\u0000")

  useLayoutEffect(() => {
    itemsRef.current = items
  }, [items])

  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) return

    const updateVisibleTabs = () => {
      const availableWidth = Math.max(0, container.clientWidth - 6)
      const widths = itemsRef.current.map(
        (_, index) => itemMeasureRefs.current[index]?.getBoundingClientRect().width ?? 0
      )
      const moreWidth = moreMeasureRef.current?.getBoundingClientRect().width ?? 0
      const gap = 4
      const allTabsWidth = widths.reduce((total, width) => total + width, 0) +
        gap * Math.max(0, widths.length - 1)

      if (allTabsWidth <= availableWidth) {
        setVisibleCount(items.length)
        return
      }

      let count = 0
      let usedWidth = 0
      const tabSpace = availableWidth - moreWidth - gap
      for (const width of widths) {
        const nextWidth = usedWidth + (count > 0 ? gap : 0) + width
        if (nextWidth > tabSpace) break
        usedWidth = nextWidth
        count += 1
      }
      setVisibleCount(count)
    }

    updateVisibleTabs()
    const observer = new ResizeObserver(updateVisibleTabs)
    observer.observe(container)
    itemMeasureRefs.current.forEach((item) => {
      if (item) observer.observe(item)
    })
    if (moreMeasureRef.current) observer.observe(moreMeasureRef.current)
    return () => observer.disconnect()
  }, [itemSignature, items.length])

  const changeValue = (nextValue: string) => {
    if (value === undefined) setUncontrolledValue(nextValue)
    onValueChange?.(nextValue)
  }

  const hiddenItems = items.slice(visibleCount)

  return (
    <Tabs
      value={selectedValue}
      onValueChange={changeValue}
      className={cn("min-w-0", className)}
    >
      <div ref={containerRef} className="relative flex w-full min-w-0 items-center gap-1">
        <TabsList
          variant={variant}
          className={cn(
            "h-10 min-w-0 max-w-full flex-nowrap justify-start gap-1 overflow-hidden",
            listClassName
          )}
        >
          {items.slice(0, visibleCount).map((item) => (
            <TabsTrigger
              key={item.value}
              value={item.value}
              className="h-8 flex-none px-3"
            >
              {item.label}
            </TabsTrigger>
          ))}
          {activeItemIsOverflowed && (
            <TabsTrigger
              value={items[activeIndex].value}
              aria-label={items[activeIndex].accessibleLabel}
              tabIndex={-1}
              className="sr-only"
              style={{
                position: "absolute",
                width: 1,
                height: 1,
                padding: 0,
                margin: -1,
                overflow: "hidden",
                clip: "rect(0, 0, 0, 0)",
                whiteSpace: "nowrap",
                border: 0,
              }}
            >
              {items[activeIndex].accessibleLabel ?? items[activeIndex].label}
            </TabsTrigger>
          )}
        </TabsList>
        {hiddenItems.length > 0 && (
          <DropdownMenu open={isMoreOpen} onOpenChange={setIsMoreOpen}>
            <DropdownMenuTrigger
              aria-label={
                activeItemIsOverflowed
                  ? `Más pestañas, sección activa: ${items[activeIndex]?.accessibleLabel ?? items[activeIndex]?.value}`
                  : "Más pestañas"
              }
              data-active={activeItemIsOverflowed || undefined}
              className={cn(
                "inline-flex h-8 flex-none items-center justify-center gap-1.5 rounded-md border border-transparent px-2.5 text-sm font-medium text-foreground/70 transition-colors hover:bg-background/70 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                activeItemIsOverflowed && "bg-background text-foreground shadow-sm"
              )}
            >
              <MoreHorizontal aria-hidden="true" className="size-4" />
              Más
              {activeItemIsOverflowed && (
                <span aria-hidden="true" className="size-1.5 rounded-full bg-primary" />
              )}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-48 duration-150">
              <DropdownMenuRadioGroup
                value={selectedValue}
                onValueChange={(nextValue) => {
                  changeValue(nextValue)
                  setIsMoreOpen(false)
                }}
              >
                {hiddenItems.map((item) => (
                  <DropdownMenuRadioItem key={item.value} value={item.value} className="min-h-11">
                    {item.menuLabel ?? item.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-[10000px] top-0 flex w-max gap-1 whitespace-nowrap"
          style={{ visibility: "hidden" }}
        >
          {items.map((item, index) => (
            <span
              key={item.value}
              ref={(element) => {
                itemMeasureRefs.current[index] = element
              }}
              className="inline-flex h-8 items-center justify-center gap-1.5 px-3 text-sm font-medium [&_svg:not([class*='size-'])]:size-4"
            >
              {item.label}
            </span>
          ))}
          <span
            ref={moreMeasureRef}
            className="inline-flex h-8 items-center justify-center gap-1.5 px-2.5 text-sm font-medium"
          >
            <MoreHorizontal aria-hidden="true" className="size-4" />
            Más
            <span aria-hidden="true" className="size-1.5" />
          </span>
        </div>
      </div>
      <div className={cn("min-w-0", contentClassName)}>{children}</div>
    </Tabs>
  )
}
