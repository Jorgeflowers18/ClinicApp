export type CedulaIssue = "empty" | "length" | "numeric" | "province" | "third-digit" | "sequence" | "checksum"
type CedulaResult = { valid: true; code: null; message: "" } | { valid: false; code: CedulaIssue; message: string }

/** Structural validation only; never proves issuance or identity. Includes consular code 30. */
export function validateEcuadorianCedulaDetailed(input: string): CedulaResult {
  const value = input.trim()
  const invalid = (code: CedulaIssue, message: string): CedulaResult => ({ valid: false, code, message })
  if (!value) return invalid("empty", "Ingresa el número de cédula")
  if (!/^\d+$/.test(value)) return invalid("numeric", "La cédula solo puede contener números")
  if (value.length !== 10) return invalid("length", "La cédula debe tener 10 dígitos")
  if (/^(\d)\1{9}$/.test(value) || ["0123456789", "1234567890", "9876543210"].includes(value)) return invalid("sequence", "El número de cédula no es válido. Verifica los datos ingresados")
  const province = Number(value.slice(0, 2)), third = Number(value[2])
  if (!(province >= 1 && province <= 24 || province === 30)) return invalid("province", "El código de provincia no es válido")
  if (third > 5 || province === 30 && third !== 4 && third !== 5) return invalid("third-digit", "El número de cédula no es válido. Verifica los datos ingresados")
  const sum = [...value.slice(0, 9)].reduce((total, digit, index) => {
    const product = Number(digit) * (index % 2 === 0 ? 2 : 1)
    return total + (product > 9 ? product - 9 : product)
  }, 0)
  if ((10 - sum % 10) % 10 !== Number(value[9])) return invalid("checksum", "El número de cédula no es válido. Verifica los datos ingresados")
  return { valid: true, code: null, message: "" }
}
export const validateEcuadorianCedula = (value: string) => validateEcuadorianCedulaDetailed(value).valid
export function documentValidationMessage(type: string, value: string) {
  return type === "cedula" ? validateEcuadorianCedulaDetailed(value).message : ""
}
