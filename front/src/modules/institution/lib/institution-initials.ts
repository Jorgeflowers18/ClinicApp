/** Two initials from the first two words, preserving the ClinicApp brand convention. */
export function institutionInitials(name: string) {
  const words = name.normalize("NFC").match(/[\p{L}\p{N}]+/gu) ?? []
  if (!words.length || words[0]!.toLocaleLowerCase("es") === "clinicapp") return "CA"
  const letters = words.length > 1 ? [Array.from(words[0]!)[0], Array.from(words[1]!)[0]] : Array.from(words[0]!).slice(0, 2)
  const initials = Array.from(letters.join("").toLocaleUpperCase("es")).slice(0, 2).join("")
  return initials.padEnd(2, initials[0] ?? "A")
}
