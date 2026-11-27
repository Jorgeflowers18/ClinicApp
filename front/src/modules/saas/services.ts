import { ApiError } from "@/shared/types/common";
import type { AuthUser } from "@/modules/auth/types/auth.types";
import type { IdentityProfile, StaffAdapter } from "./types";
import { assertUsernameAvailable, demoId, readDemoData, safeDemoSnapshot, recordAudit, updateDemoData } from "./adapters/demo-repository";
import { currentActor, useDemoContext } from "./state";
import { normalizeUsername } from "./lib/identity";
import { activeInstitutionScope, confirmedStaffInstitution } from "./lib/institution-scope";
import { administrativeActor, protectAdministration } from "./catalog-services";
import { accessRoles, assignedRoles } from "./lib/access-catalogs";
import { documentValidationMessage } from "@/shared/lib/ecuadorian-cedula";
function administrator() {
    return { id: administrativeActor(), role: "admin" as const };
}
export const demoStaffAdapter: StaffAdapter = {
    read: readDemoData,
    async saveUser(user) {
        const actor = administrator();
        if (user.hasAccount !== false) assertUsernameAvailable(user.username, user.id);
        const catalog = readDemoData();
        const scope = activeInstitutionScope(), profile = confirmedStaffInstitution();
        const previous = catalog.users.find(item => item.id === user.id);
        const roles = accessRoles(catalog, scope);
        if (user.hasAccount !== false && user.accessRoleIds?.some(id => !roles.some(role => role.id === id && (role.active || previous && assignedRoles(previous, catalog, scope).some(item => item.id === id))))) throw new ApiError("Revisa los roles.", 422, [{ field: "accessRoleIds", message: "Selecciona roles activos de esta institución." }]);
        if (user.professionalTypeId && user.professionalTypeId !== previous?.professionalTypeId && !catalog.professionalTypes?.some(type => type.id === user.professionalTypeId && type.organizationId === scope && type.active)) throw new ApiError("Revisa el tipo profesional.", 422, [{ field: "professionalTypeId", message: "Selecciona un tipo profesional activo de esta institución." }]);
        const documentError = documentValidationMessage(user.documentType, user.documentNumber);
        if (documentError) throw new ApiError("Revisa el documento.", 422, [{ field: "documentNumber", message: documentError }]);
        if (!user.organizationIds.includes(scope) || previous && !previous.organizationIds.includes(scope)) throw new ApiError("Esta identidad no pertenece a la institución actual.", 403);
        if (JSON.stringify(user.assignments) !== JSON.stringify(previous?.assignments) && user.assignments.some(assignment => assignment.active && assignment.organizationId === scope && !profile?.branches.some(site => site.id === assignment.siteId)))
            throw new ApiError("Revisa las sedes de la identidad.", 422, [{ field: "mainSiteId", message: "La sede seleccionada ya no está disponible." }]);
        if (user.specialtyIds.some(id => !catalog.specialties.some(item => item.id === id && user.organizationIds.includes(item.organizationId))))
            throw new ApiError("Revisa las especialidades.", 422, [{ field: "specialtyIds", message: "Selecciona especialidades de las organizaciones asignadas." }]);
        if (user.specialtyIds.some(id => !previous?.specialtyIds.includes(id) && catalog.specialties.some(item => item.id === id && !item.active))) throw new ApiError("Revisa las especialidades.", 422, [{ field: "specialtyIds", message: "La especialidad seleccionada ya no está activa para nuevas asignaciones." }]);
        if (user.email && readDemoData().users.some(item => item.id !== user.id && item.email.toLowerCase() === user.email.toLowerCase()))
            throw new ApiError("Este correo ya pertenece a una identidad.", 409, [{ field: "email", message: "El correo ya está registrado en la demostración." }]);
        updateDemoData(data => { const index = data.users.findIndex(item => item.id === user.id); if (index < 0)
            data.users.push(user);
        else
            data.users[index] = user; for (const request of data.requests) {
            if (request.organizationId === scope && request.state === "approved" && request.email.toLowerCase() === user.email.toLowerCase()) {
                request.state = "created";
                request.userId = user.id;
            }
        } protectAdministration(catalog, data, scope, actor.id); recordAudit(data, actor.id, user.id, index < 0 ? "Crear usuario" : "Editar usuario"); });
        return user;
    },
    async saveSpecialty(specialty) {
        const actor = administrator();
        if (specialty.organizationId !== activeInstitutionScope()) throw new ApiError("Esta especialidad no pertenece a la institución actual.", 403);
        updateDemoData(data => { if (data.specialties.some(item => item.id !== specialty.id && item.organizationId === specialty.organizationId && item.name.trim().toLowerCase() === specialty.name.trim().toLowerCase()))
            throw new ApiError("Ya existe esta especialidad.", 409, [{ field: "name", message: "El nombre ya está registrado." }]); const index = data.specialties.findIndex(item => item.id === specialty.id); if (index < 0)
            data.specialties.push(specialty);
        else
            data.specialties[index] = specialty; recordAudit(data, actor.id, specialty.id, "Guardar especialidad"); });
    },
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
        }
        const settings = data.serverStaffSettings?.[activeInstitutionScope()]?.[profile.id];
        if (settings) { settings.username = profile.username; settings.email = profile.email; }
        recordAudit(data, actor.id, profile.id, "Guardar identificador local"); });
    },
    initial(user: AuthUser): IdentityProfile {
        const saved = this.find(user.id), configured = safeDemoSnapshot().serverStaffSettings?.["frontend-institution-current"]?.[user.id];
        return saved ? { id: saved.id, firstName: saved.firstName, lastName: saved.lastName, username: saved.username, email: saved.email, phone: saved.phone } : { id: user.id, firstName: (user.profile?.fullName || user.name).split(" ")[0], lastName: (user.profile?.fullName || user.name).split(" ").slice(1).join(" "), username: configured?.username ?? "", email: user.email, phone: "" };
    },
    emailForAlias(identifier: string) {
        if (identifier.includes("@"))
            return identifier.trim();
        const data = readDemoData();
        return data.identities.find(item => normalizeUsername(item.username) === normalizeUsername(identifier))?.email ?? Object.values(data.serverStaffSettings?.["frontend-institution-current"] ?? {}).find(item => item.username && normalizeUsername(item.username) === normalizeUsername(identifier))?.email ?? null;
    },
    demoLogin(identifier: string) {
        const user = readDemoData().users.find(item => [normalizeUsername(item.username), item.email.toLowerCase()].includes(normalizeUsername(identifier)));
        if (!user || user.hasAccount === false || user.state === "blocked" || user.state === "inactive")
            throw new ApiError("No se pudo abrir esta cuenta de demostración.", 401);
        return user;
    },
    request(values: {
        firstName: string;
        lastName: string;
        username: string;
        email: string;
        institution: string;
    }) { updateDemoData(data => data.requests.push({ ...values, organizationId: useDemoContext.getState().userId ? useDemoContext.getState().organizationId : undefined, id: demoId(), state: "pending" })); },
    async updateDemoProfile(profile: AuthUser["profile"]) { const id = useDemoContext.getState().userId; if (!id || !profile)
        throw new Error("Sesión de demostración no disponible."); updateDemoData(data => { const user = data.users.find(item => item.id === id)!; user.profile = profile; }); },
    async completeDemoActivation(id: string) { const selected = useDemoContext.getState().userId; if (id !== selected)
        throw new ApiError("La activación requiere su propia sesión de demostración.", 403); updateDemoData(data => { const user = data.users.find(item => item.id === id)!; user.activation = "active"; user.state = "active"; user.mustChangePassword = false; }); },
};
