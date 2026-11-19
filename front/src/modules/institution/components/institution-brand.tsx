import { useState } from "react"
import { cn } from "@/lib/utils"
import { useInstitutionProfile } from "../hooks/use-institution-profile"
import { institutionInitials } from "../lib/institution-initials"
import styles from "./institution-brand.module.css"

export function InstitutionMark({ name, image, className }: { name: string; image: string | null; className?: string }) {
  const [failedImage, setFailedImage] = useState<string | null>(null)
  return image && image !== failedImage
    ? <img src={image} alt="Logo de la clínica" className={cn(styles.image, className)} onError={() => setFailedImage(image)} />
    : <span className={cn(styles.mark, className)} data-institution-initials aria-hidden="true">{institutionInitials(name)}</span>
}

export function InstitutionSidebarBrand({ collapsed }: { collapsed: boolean }) {
  const institution = useInstitutionProfile()
  return <div className={cn("clinic-sidebar-brand", styles.brand)} data-institution-brand title={institution.name}>
    <InstitutionMark name={institution.name} image={institution.logoImage} />
    {!collapsed && <div className={styles.label}><span className={styles.name}>{institution.name}</span><span className="clinic-sidebar-brand-subtitle">Odontología</span></div>}
  </div>
}
