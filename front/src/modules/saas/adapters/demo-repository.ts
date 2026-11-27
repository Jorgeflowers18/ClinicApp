import { createId } from "@/shared/lib/id";
import { ApiError } from "@/shared/types/common";
import { queryClient } from "@/shared/lib/query-client";
import { isDemonstrationActive } from "@/shared/lib/demonstration-boundary";
import { normalizeUsername, usernameSchema } from "../lib/identity";
import type { SaasData, StaffUser } from "../types";
const key = "clinicapp.saas-demonstration.v1";
const event = "clinicapp:saas-data";
const now = () => new Date().toISOString();
function seed(): SaasData {
    const person = (id: string, firstName: string, lastName: string, username: string, role: StaffUser["roles"][number], orgs: string[], professionalId: string | null): StaffUser => ({
        id, firstName, lastName, username, email: `${username}@demo.example`, phone: "+593990000001", documentType: "otro", documentNumber: "DEMO-" + id,
        roles: [role], state: "active", organizationIds: orgs, assignments: [],
        professionalId, profession: professionalId ? "Odontología" : "", registration: "", specialtyIds: professionalId ? ["general"] : [], professionalState: "ACTIVE", absences: [], activation: "active", mustChangePassword: false,
        profile: { fullName: `${firstName} ${lastName}`, title: role === "admin" ? "Administrador" : role === "medico" ? "Odontólogo" : "Recepción", specialty: "", bio: "", avatarImage: null, avatarColor: "#5350CC" }, createdAt: now(),
    });
    return { version: 1, users: [person("demo-admin", "Ana", "Morales", "amorales", "admin", ["demo-centro", "demo-norte"], null), person("demo-doctor", "Andrés", "Vega", "avega", "medico", ["demo-centro"], "demo-professional"), person("demo-reception", "Laura", "Torres", "ltorres", "recepcion", ["demo-centro"], null)],
        organizations: ["centro", "norte"].map(part => ({ id: "demo-" + part, businessAccountId: "demo-business", name: "", logo: null, branches: [] })),
        specialties: [{ id: "general", organizationId: "demo-centro", name: "Odontología general", description: "Atención general", active: true }, { id: "orthodontics", organizationId: "demo-norte", name: "Ortodoncia", description: "", active: true }], requests: [], identities: [], audit: [],
        plans: [{ id: "initial", name: "Inicial", base: 39, includedSites: 1, includedProfessionals: 1, includedUsers: 2, extraSite: 15, extraProfessional: 12, extraUser: 4, countStates: ["ACTIVE", "VACATION", "LEAVE"] }, { id: "professional", name: "Profesional", base: 79, includedSites: 2, includedProfessionals: 4, includedUsers: 6, extraSite: 12, extraProfessional: 10, extraUser: 3, countStates: ["ACTIVE", "VACATION", "LEAVE"] }, { id: "enterprise", name: "Empresarial", base: 149, includedSites: 4, includedProfessionals: 10, includedUsers: 15, extraSite: 10, extraProfessional: 8, extraUser: 2, countStates: ["ACTIVE", "VACATION", "LEAVE"] }],
    };
}
let raw: string | null | undefined, snapshot: SaasData | undefined;
let fallback: SaasData | undefined, readError = "";
export function safeDemoSnapshot() { try {
    const value = readDemoData();
    readError = "";
    return value;
}
catch {
    readError = "No se pudo leer la demostración guardada. Los datos originales no se sobrescribirán.";
    return fallback ??= seed();
} }
export const demoReadError = () => readError;
export function readDemoData(): SaasData {
    const current = localStorage.getItem(key);
    if (snapshot && current === raw)
        return snapshot;
    if (!current) {
        raw = current;
        return snapshot = seed();
    }
    let parsed: SaasData;
    try {
        parsed = JSON.parse(current);
    }
    catch {
        throw new Error("No se pudo leer la demostración guardada. No se sobrescribieron tus datos.");
    }
    if (parsed.version !== 1 || !Array.isArray(parsed.users) || !Array.isArray(parsed.organizations) || !Array.isArray(parsed.specialties) || !Array.isArray(parsed.plans) || !Array.isArray(parsed.identities))
        throw new Error("No se pudo leer la demostración guardada. No se sobrescribieron tus datos.");
    raw = current;
    return snapshot = parsed;
}
export function updateDemoData(mutate: (data: SaasData) => void) {
    const next = structuredClone(readDemoData());
    mutate(next);
    const serialized = JSON.stringify(next);
    try {
        localStorage.setItem(key, serialized);
    }
    catch {
        throw new Error("No se pudo guardar la demostración en este navegador. Conserva el formulario y revisa el almacenamiento.");
    }
    raw = serialized;
    snapshot = next;
    window.dispatchEvent(new Event(event));
    if (isDemonstrationActive())
        void queryClient.invalidateQueries();
}
export function subscribeDemoData(listener: () => void) {
    const storage = (event: StorageEvent) => { if (event.key === key || event.key === null) {
        listener();
        if (isDemonstrationActive()) void queryClient.invalidateQueries();
    } };
    window.addEventListener(event, listener);
    window.addEventListener("storage", storage);
    return () => { window.removeEventListener(event, listener); window.removeEventListener("storage", storage); };
}
export function assertUsernameAvailable(username: string, id?: string) {
    const parsed = usernameSchema.safeParse(username);
    if (!parsed.success)
        throw new ApiError("Revisa el nombre de usuario.", 422, [{ field: "username", message: parsed.error.issues[0].message }]);
    const data = readDemoData(), normalized = normalizeUsername(username);
    const serverNames = Object.values(data.serverStaffSettings ?? {}).flatMap(scope => Object.entries(scope).map(([id, value]) => ({ id, username: value.username ?? "" })));
    if ([...data.users, ...data.identities, ...serverNames].some(user => user.id !== id && normalizeUsername(user.username) === normalized))
        throw new ApiError("El nombre de usuario ya está registrado en esta demostración.", 409, [{ field: "username", message: "Este nombre de usuario ya está registrado localmente." }]);
}
export function recordAudit(data: SaasData, actorId: string, recordId: string, action: string) {
    data.audit.push({ actorId, recordId, action, at: now() });
}
export const demoId = createId;
