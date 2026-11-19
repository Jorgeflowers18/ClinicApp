/** Two characters from the first/last word, or the first two letters of a single word. */
export function institutionInitials(name: string) {
  const words = name.match(/[\p{L}\p{N}]+/gu) ?? []
  const letters = words.length > 1 ? [Array.from(words[0]!)[0], Array.from(words.at(-1)!)[0]] : Array.from(words[0] ?? "CA").slice(0, 2)
  const initials = Array.from(letters.join("").toLocaleUpperCase("es")).slice(0, 2).join("")
  return initials.padEnd(2, initials[0] ?? "A")
}
