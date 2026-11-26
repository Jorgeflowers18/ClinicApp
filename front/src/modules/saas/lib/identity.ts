import { z } from "zod";
export const normalizeUsername = (value: string) => value.trim().toLocaleLowerCase("en-US");
const reserved = new Set(["root", "system", "support", "api", "null", "undefined", "clinicapp"]);
export const usernameSchema = z.string().trim().min(3, "Utiliza al menos 3 caracteres.").max(30, "Utiliza hasta 30 caracteres.")
    .regex(/^[a-zA-Z][a-zA-Z0-9._-]*$/, "Empieza con una letra; utiliza letras, números, punto, guion o guion bajo.")
    .refine(value => !reserved.has(normalizeUsername(value)), "Este nombre está reservado.");
export const identifierSchema = z.string().trim().min(1, "Ingresa tu usuario o correo electrónico.").refine(value => value.includes("@") ? z.string().email().safeParse(value).success : usernameSchema.safeParse(value).success, "El identificador ingresado no tiene un formato válido.");
export function suggestUsername(firstName: string, lastName: string) {
    return `${firstName.trim().slice(0, 1)}${lastName.trim().split(/\s+/)[0] ?? ""}`.normalize("NFD").replace(/\p{M}/gu, "").replace(/[^a-zA-Z0-9]/g, "").toLowerCase().slice(0, 30);
}
export const nameOf = (user: {
    firstName: string;
    lastName: string;
}) => `${user.firstName} ${user.lastName}`.trim();
export const accountIdentitySchema = z.object({
    firstName: z.string().trim().min(1, "Ingresa los nombres."),
    lastName: z.string().trim().min(1, "Ingresa los apellidos."),
    username: usernameSchema,
    email: z.string().trim().email("Ingresa un correo válido."),
    phone: z.string().trim().refine(value => !value || /^\+?[\d ()-]{7,20}$/.test(value), "Ingresa un teléfono válido."),
});
export const existingAccountIdentitySchema = accountIdentitySchema.extend({ username: z.union([z.literal(""), usernameSchema]) });
