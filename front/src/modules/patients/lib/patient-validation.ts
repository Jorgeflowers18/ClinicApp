import { differenceInYears, format, isValid } from "date-fns"
import { z } from "zod"
import { parseLocalDate } from "@/shared/lib/date"
import { patientSchema } from "../types/patient.types"

export const documentTypes = [
  { value: "cedula", label: "Cédula ecuatoriana" },
  { value: "pasaporte", label: "Pasaporte" },
  { value: "otro", label: "Otro documento" },
] as const

/** Checksum local: no comprueba emisión ni titularidad en el Registro Civil. */
export function isEcuadorianId(value: string) {
  if (!/^\d{10}$/.test(value)) return false
  const province = Number(value.slice(0, 2))
  if (!(province >= 1 && province <= 24 || province === 30) || Number(value[2]) > 5) return false
  const sum = [...value.slice(0, 9)].reduce((total, digit, index) => {
    const weighted = Number(digit) * (index % 2 === 0 ? 2 : 1)
    return total + (weighted > 9 ? weighted - 9 : weighted)
  }, 0)
  return (10 - sum % 10) % 10 === Number(value[9])
}

export const normalizeDocument = (value: string) => value.replace(/\s+/g, "").toLocaleUpperCase("es")

export function patientAge(value: string, now = new Date()) {
  const date = parseLocalDate(value)
  if (!value || !isValid(date) || format(date, "yyyy-MM-dd") !== value || date > now) return null
  return differenceInYears(now, date)
}

export const patientEditorSchema = patientSchema.extend({
  firstName: patientSchema.shape.firstName.trim().min(2, "Ingresa al menos 2 caracteres"),
  lastName: patientSchema.shape.lastName.trim().min(2, "Ingresa al menos 2 caracteres"),
  birthDate: z.string().refine(value => patientAge(value) !== null, "Ingresa una fecha válida, que no sea futura"),
}).superRefine((values, context) => {
  if (values.documentType === "cedula" && !isEcuadorianId(values.documentId.trim())) {
    context.addIssue({ code: "custom", path: ["documentId"], message: "La cédula debe tener 10 dígitos y un dígito verificador válido" })
  }
})
