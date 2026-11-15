import { UserRound } from "lucide-react"
import { cn } from "@/lib/utils"
import { getProfileInitials } from "./profile-initials"
import styles from "./user-avatar.module.css"

export function UserAvatar({ name, image, location, className }: {
  name: string
  image: string | null
  location: "profile" | "header" | "sidebar" | "menu"
  className?: string
}) {
  const initials = getProfileInitials(name)
  return (
    <span className={cn(styles.avatar, location === "sidebar" && styles.small, className)} data-user-avatar={location} data-photo-state={image ? "saved" : "absent"} aria-hidden={location === "sidebar" || undefined}>
      {image ? <img src={image} alt={location === "profile" ? "Avatar del usuario" : `Fotografía de ${name || "usuario"}`} />
        : initials ? <span role="img" aria-label={`Iniciales de ${name}: ${initials}`}><span data-profile-initials={location}>{initials}</span></span>
          : <UserRound role="img" aria-label="Usuario sin nombre" />}
    </span>
  )
}
