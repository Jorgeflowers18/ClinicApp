import { cn } from "@/lib/utils"
import { institutionInitials } from "@/modules/institution/lib/institution-initials"

import styles from "./brand-logo.module.css"

/** ClinicApp's mark inherits the same theme tokens as primary actions. */
export function BrandLogo({ className }: { className?: string }) {
  return (
    <span data-slot="brand-logo" className={cn("clinic-brand-mark size-9 text-sm", styles.mark, className)} aria-hidden="true">
      CA
    </span>
  )
}

/** All institutional initials share the same generator as the Sidebar and preview. */
export function InstitutionLogo({ image, name, className, imageClassName }: {
  image: string | null
  name: string
  className?: string
  imageClassName?: string
}) {
  if (image) {
    return <img src={image} alt="Logo de la clínica" className={imageClassName ?? className} />
  }
  const text = institutionInitials(name)
  if (text === "CA") return <BrandLogo className={className} />
  return <span className={cn("clinic-institution-mark", styles.institutionMark, className)} aria-hidden="true">{text}</span>
}
