import { useId, useState } from "react"
import { addMonths, format, isValid } from "date-fns"
import { es } from "date-fns/locale"
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"

import styles from "./calendar-date-navigator.module.css"

const months = Array.from({ length: 12 }, (_, index) => ({
  value: String(index),
  label: format(new Date(2000, index, 1), "LLLL", { locale: es }),
}))
const monthLabels = Object.fromEntries(months.map(({ value, label }) => [value, label]))

function monthInYear(cursor: Date, text: string) {
  if (!/^\d+$/.test(text)) return null
  const year = Number(text)
  if (!Number.isSafeInteger(year) || year < 1) return null
  const result = new Date(cursor)
  result.setDate(1)
  result.setFullYear(year)
  return isValid(result) ? result : null
}

export function CalendarDateNavigator({ date, label, onSelect, className }: {
  date: Date
  label: string
  onSelect: (date: Date) => void
  className?: string
}) {
  const id = useId()
  const [open, setOpen] = useState(false)
  // This cursor only browses the popup. The page's date remains the source of truth.
  const [cursor, setCursor] = useState(date)
  const [yearText, setYearText] = useState(String(date.getFullYear()))
  const invalidYear = !monthInYear(cursor, yearText)

  function browseMonth(month: Date) {
    if (!isValid(month)) return
    setCursor(month)
    setYearText(String(month.getFullYear()))
  }

  return (
    <Popover open={open} onOpenChange={(nextOpen) => {
      if (nextOpen) browseMonth(new Date(date))
      setOpen(nextOpen)
    }}>
      <PopoverTrigger render={
        <Button
          type="button"
          variant="outline"
          data-calendar-date-trigger
          aria-label={`Elegir fecha: ${label}`}
          className={cn(styles.trigger, className)}
        >
          <CalendarDays aria-hidden="true" />
          <span>{label}</span>
          <ChevronDown aria-hidden="true" className="size-3.5 text-muted-foreground" />
        </Button>
      } />
      <PopoverContent className={styles.popup}>
        <div className={styles.popupHeader}>
          <PopoverTitle>Ir a una fecha</PopoverTitle>
          <div className={styles.monthNavigation} role="group" aria-label="Cambiar mes del selector">
            <Button type="button" variant="ghost" size="icon" aria-label="Mes anterior" onClick={() => browseMonth(addMonths(cursor, -1))}>
              <ChevronLeft aria-hidden="true" />
            </Button>
            <Button type="button" variant="ghost" size="icon" aria-label="Mes siguiente" onClick={() => browseMonth(addMonths(cursor, 1))}>
              <ChevronRight aria-hidden="true" />
            </Button>
          </div>
        </div>
        <div className={styles.fields}>
          <div className="min-w-0 space-y-1">
            <Label htmlFor={`${id}-month`}>Mes</Label>
            <Select items={monthLabels} value={String(cursor.getMonth())} onValueChange={(value) => {
              if (value === null) return
              const next = new Date(cursor)
              next.setDate(1)
              next.setMonth(Number(value))
              browseMonth(next)
            }}>
              <SelectTrigger id={`${id}-month`} className="w-full capitalize"><SelectValue /></SelectTrigger>
              <SelectContent>
                {months.map((month) => <SelectItem key={month.value} value={month.value} className="capitalize">{month.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-0 space-y-1">
            <Label htmlFor={`${id}-year`}>Año</Label>
            <Input
              id={`${id}-year`}
              inputMode="numeric"
              autoComplete="off"
              value={yearText}
              aria-invalid={invalidYear || undefined}
              aria-describedby={invalidYear ? `${id}-year-error` : undefined}
              onChange={(event) => {
                setYearText(event.target.value)
                const next = monthInYear(cursor, event.target.value)
                if (next) setCursor(next)
              }}
            />
          </div>
        </div>
        {invalidYear && <p id={`${id}-year-error`} role="alert" className="text-xs text-destructive">Introduce un año válido.</p>}
        <Calendar
          mode="single"
          locale={es}
          month={cursor}
          onMonthChange={browseMonth}
          selected={date}
          disabled={invalidYear}
          hideNavigation
          className={styles.days}
          classNames={{ month_caption: "sr-only", month: "flex w-full flex-col gap-2" }}
          onSelect={(selectedDate) => {
            if (!selectedDate) return
            onSelect(selectedDate)
            setOpen(false)
          }}
        />
        <p className="text-xs text-muted-foreground">Selecciona un día para ir a esa fecha.</p>
      </PopoverContent>
    </Popover>
  )
}
