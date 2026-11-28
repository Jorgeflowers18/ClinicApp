import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

interface PageHeaderProps {
  title: string
  description?: string
  actions?: ReactNode
  className?: string
  headingLevel?: 1 | 2
}

export function PageHeader({ title, description, actions, className, headingLevel = 1 }: PageHeaderProps) {
  const Heading = headingLevel === 1 ? "h1" : "h2"
  return (
    <div data-slot="page-header" className={cn("flex min-w-0 flex-col gap-4 border-b pb-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between", className)}>
      <div className="min-w-0 space-y-1">
        <Heading className={cn("font-[590] tracking-tight text-foreground", headingLevel === 1 ? "text-2xl" : "text-base")}>{title}</Heading>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex min-w-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
