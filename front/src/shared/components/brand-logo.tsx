import { cn } from "@/lib/utils"

import styles from "./brand-logo.module.css"

/** ClinicApp's mark inherits the same theme tokens as primary actions. */
export function BrandLogo({ className }: { className?: string }) {
  return (
    <span data-slot="brand-logo" className={cn("clinic-brand-mark size-9 text-sm", styles.mark, className)} aria-hidden="true">
      CA
    </span>
  )
}

/** Uploaded images and custom initials keep the clinic's own identity. */
export function InstitutionLogo({ image, text, className, imageClassName }: {
  image: string | null
  text: string
  className?: string
  imageClassName?: string
}) {
  if (image) {
    return <img src={image} alt="Logo de la clínica" className={imageClassName ?? className} />
  }
  if (!text || text === "CA") return <BrandLogo className={className} />
  return <span className={cn("clinic-institution-mark", styles.institutionMark, className)} aria-hidden="true">{text}</span>
}
