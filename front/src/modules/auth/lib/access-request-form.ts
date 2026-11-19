import { z } from "zod"
import { accessRequestSchema, type AccessRequestFormValues } from "../types/access-form.types"

const fieldsSchema = accessRequestSchema.omit({ fullName: true }).extend({
  firstName: z.string().trim().min(1, "Los nombres son obligatorios"),
  lastName: z.string().trim().min(1, "Los apellidos son obligatorios"),
})

export type AccessRequestFields = z.input<typeof fieldsSchema>

/** Presentation adapter: retain the existing fullName contract without splitting records. */
export function prepareAccessRequest({ firstName, lastName, ...values }: AccessRequestFields): AccessRequestFormValues {
  return { ...values, fullName: `${firstName.trim()} ${lastName.trim()}` }
}

export const accessRequestDetailsSchema = fieldsSchema.transform(prepareAccessRequest)
