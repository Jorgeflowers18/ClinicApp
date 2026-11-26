import { ApiError } from "@/shared/types/common";
import type { AuthUser } from "@/modules/auth/types/auth.types";
import type { IdentityProfile, StaffAdapter } from "./types";
import { assertUsernameAvailable, demoId, readDemoData, safeDemoSnapshot, recordAudit, updateDemoData } from "./adapters/demo-repository";
import { currentActor, useDemoContext } from "./state";
import { normalizeUsername } from "./lib/identity";
function administrator() {
    const actor = currentActor();
    if (!actor || actor.role !== "admin")
        throw new ApiError("Esta acción de demostración requiere un administrador.", 403);
    return actor;
}
export const demoStaffAdapter: StaffAdapter = {
    read: readDemoData,
    async saveUser(user) {
        const actor = administrator();
        assertUsernameAvailable(user.username, user.id);
        const catalog = readDemoData();
        if (user.assignments.some(assignment => assignment.active && (!user.organizationIds.includes(assignment.organizationId) || !catalog.organizations.find(org => org.id === assignment.organizationId)?.branches.some(site => site.id === assignment.siteId))))
            throw new ApiError("Revisa las sedes de la identidad.", 422, [{ field: "siteIds", message: "Cada sede activa debe pertenecer a una organización asignada." }]);
        if (user.specialtyIds.some(id => !catalog.specialties.some(item => item.id === id && user.organizationIds.includes(item.organizationId))))
            throw new ApiError("Revisa las especialidades.", 422, [{ field: "specialtyIds", message: "Selecciona especialidades de las organizaciones asignadas." }]);
        if (readDemoData().users.some(item => item.id !== user.id && item.email.toLowerCase() === user.email.toLowerCase()))
            throw new ApiError("Este correo ya pertenece a una identidad.", 409, [{ field: "email", message: "El correo ya está registrado en la demostración." }]);
        if (user.id === actor.id && (!user.roles.includes("admin") || user.state !== "active"))
            throw new ApiError("Conserva un administrador activo para gestionar esta demostración.", 409, [{field:!user.roles.includes("admin")?"role":"state",message:"Tu propia cuenta debe conservar el rol Administrador y permanecer activa."}]);
        updateDemoData(data => { const index = data.users.findIndex(item => item.id === user.id); if (index < 0)
            data.users.push(user);
        else
            data.users[index] = user; for (const request of data.requests) {
            if (request.state === "approved" && request.email.toLowerCase() === user.email.toLowerCase()) {
                request.state = "created";
                request.userId = user.id;
            }
        } recordAudit(data, actor.id, user.id, index < 0 ? "Crear usuario" : "Editar usuario"); });
        return user;
    },
    async saveSpecialty(specialty) {
        const actor = administrator();
        updateDemoData(data => { if (data.specialties.some(item => item.id !== specialty.id && item.organizationId === specialty.organizationId && item.name.trim().toLowerCase() === specialty.name.trim().toLowerCase()))
            throw new ApiError("Ya existe esta especialidad.", 409, [{ field: "name", message: "El nombre ya está registrado." }]); const index = data.specialties.findIndex(item => item.id === specialty.id); if (index < 0)
            data.specialties.push(specialty);
        else
            data.specialties[index] = specialty; recordAudit(data, actor.id, specialty.id, "Guardar especialidad"); });
    },
    async saveOrganization(organization) { const actor = administrator(); updateDemoData(data => { if (data.users.some(user => user.assignments.some(item => item.active && item.organizationId === organization.id && !organization.branches.some(site => site.id === item.siteId))))
        throw new ApiError("Retira primero las asignaciones activas antes de eliminar una sede.", 409); const index = data.organizations.findIndex(item => item.id === organization.id); if (index < 0)
        data.organizations.push(organization);
    else
        data.organizations[index] = organization; recordAudit(data, actor.id, organization.id, "Guardar organización"); }); },
};
export const identityService = {
    find(id: string) { return safeDemoSnapshot().identities.find(item => item.id === id) ?? safeDemoSnapshot().users.find(item => item.id === id); },
    async save(profile: IdentityProfile) {
        const actor = currentActor();
        if (!actor || actor.id !== profile.id)
            throw new ApiError("La sesión cambió. Vuelve a abrir tu perfil.", 403);
        if (profile.username)
            assertUsernameAvailable(profile.username, profile.id);
        updateDemoData(data => { const member = data.users.find(item => item.id === profile.id); if (member) {
            Object.assign(member, profile);
        }
        else {
            const index = data.identities.findIndex(item => item.id === profile.id);
            if (index < 0)
                data.identities.push(profile);
            else
                data.identities[index] = profile;
        } recordAudit(data, actor.id, profile.id, "Guardar identificador local"); });
    },
    initial(user: AuthUser): IdentityProfile {
        const saved = this.find(user.id);
        return saved ? { id: saved.id, firstName: saved.firstName, lastName: saved.lastName, username: saved.username, email: saved.email, phone: saved.phone } : { id: user.id, firstName: (user.profile?.fullName || user.name).split(" ")[0], lastName: (user.profile?.fullName || user.name).split(" ").slice(1).join(" "), username: "", email: user.email, phone: "" };
    },
    emailForAlias(identifier: string) {
        if (identifier.includes("@"))
            return identifier.trim();
        return readDemoData().identities.find(item => normalizeUsername(item.username) === normalizeUsername(identifier))?.email ?? null;
    },
    demoLogin(identifier: string) {
        const user = readDemoData().users.find(item => [normalizeUsername(item.username), item.email.toLowerCase()].includes(normalizeUsername(identifier)));
        if (!user || user.state === "blocked" || user.state === "inactive")
            throw new ApiError("No se pudo abrir esta cuenta de demostración.", 401);
        return user;
    },
    request(values: {
        firstName: string;
        lastName: string;
        username: string;
        email: string;
        institution: string;
    }) { updateDemoData(data => data.requests.push({ ...values, id: demoId(), state: "pending" })); },
    async updateDemoProfile(profile: AuthUser["profile"]) { const id = useDemoContext.getState().userId; if (!id || !profile)
        throw new Error("Sesión de demostración no disponible."); updateDemoData(data => { const user = data.users.find(item => item.id === id)!; user.profile = profile; }); },
    async completeDemoActivation(id: string) { const selected = useDemoContext.getState().userId; if (id !== selected)
        throw new ApiError("La activación requiere su propia sesión de demostración.", 403); updateDemoData(data => { const user = data.users.find(item => item.id === id)!; user.activation = "active"; user.state = "active"; user.mustChangePassword = false; }); },
};
