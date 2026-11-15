/** Presentation only: the stored name and profile are never changed. */
export function getProfileInitials(name: string): string {
  const words = name.normalize("NFC").trim().toLocaleUpperCase("es").split(/\s+/u).filter(Boolean)
  if (words.length === 0) return ""

  const first = Array.from(words[0])
  const last = Array.from(words[words.length - 1])
  return words.length > 1 ? first[0] + last[0] : first.slice(0, 2).join("")
}
