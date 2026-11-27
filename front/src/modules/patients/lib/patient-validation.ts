import { differenceInYears, format, isValid } from "date-fns"
import { z } from "zod"
import { parseLocalDate } from "@/shared/lib/date"
import { patientSchema } from "../types/patient.types"
import { validateEcuadorianCedula, documentValidationMessage } from "@/shared/lib/ecuadorian-cedula"

export const documentTypes = [
  { value: "cedula", label: "Cédula ecuatoriana" },
  { value: "pasaporte", label: "Pasaporte" },
  { value: "otro", label: "Otro documento" },
] as const

/** Checksum local: no comprueba emisión ni titularidad en el Registro Civil. */
export const isEcuadorianId = validateEcuadorianCedula

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
  const message = documentValidationMessage(values.documentType ?? "otro", values.documentId)
  if (message) context.addIssue({ code: "custom", path: ["documentId"], message })
})
