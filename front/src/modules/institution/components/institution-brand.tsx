import { useState } from "react"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useInstitutionProfile } from "../hooks/use-institution-profile"
import { institutionInitials } from "../lib/institution-initials"
import styles from "./institution-brand.module.css"

export function InstitutionMark({ name, image, className }: { name: string; image: string | null; className?: string }) {
  const [failedImage, setFailedImage] = useState<string | null>(null)
  return image && image !== failedImage
    ? <img src={image} alt="Logo de la clínica" className={cn(styles.image, className)} onError={() => setFailedImage(image)} />
    : <span className={cn(styles.mark, className)} data-institution-initials aria-hidden="true">{institutionInitials(name)}</span>
}

/** Shared presentation for the saved Sidebar identity and the editable preview. */
export function InstitutionIdentity({ name, subtitle = "", image, collapsed = false }: {
  name: string; subtitle: string; image: string | null; collapsed?: boolean
}) {
  return <div className={styles.identity} data-institution-identity>
    <InstitutionMark name={name} image={image} />
    {!collapsed && <div className={styles.label}>
      <span className={styles.name} data-institution-name>{name}</span>
      {subtitle.trim() && <span className={cn("clinic-sidebar-brand-subtitle", styles.subtitle)} data-institution-subtitle>{subtitle}</span>}
    </div>}
  </div>
}

export function InstitutionSidebarBrand({ collapsed }: { collapsed: boolean }) {
  const institution = useInstitutionProfile()
  const subtitle = institution.subtitle ?? ""
  const identity = [institution.name, subtitle].filter((text) => text.trim()).join(" · ")
  const brand = <div className={cn("clinic-sidebar-brand", styles.brand)} data-institution-brand role="group" tabIndex={0} aria-label={identity} title={collapsed ? undefined : identity}>
    <InstitutionIdentity name={institution.name} subtitle={subtitle} image={institution.logoImage} collapsed={collapsed} />
  </div>
  // Keep mobile drawer focus and Escape owned by the existing navigation dialog.
  if (!collapsed) return brand
  return <Tooltip disableHoverablePopup>
    <TooltipTrigger render={brand} />
    <TooltipContent side="right" sideOffset={8} className={styles.tooltip}>
      <div className={styles.tooltipIdentity}><span>{institution.name}</span>{subtitle.trim() && <span>{subtitle}</span>}</div>
    </TooltipContent>
  </Tooltip>
}
