import type { CommercialPlan, ProfessionalState, StaffUser } from "../types";
export function clinicDay(date = new Date()) { return date.toLocaleDateString("sv-SE", { timeZone: "America/Guayaquil" }); }
export function effectiveProfessionalState(user: StaffUser, day = clinicDay()): ProfessionalState {
    if (["INACTIVE", "RETIRED"].includes(user.professionalState))
        return user.professionalState;
    const absence = user.absences.find(item => item.from <= day && item.to >= day);
    if (absence)
        return absence.type;
    return user.professionalState === "VACATION" || user.professionalState === "LEAVE" ? "ACTIVE" : user.professionalState;
}
export function professionalAvailability(user: StaffUser, siteId: string, day: string, start = "09:00", end = "09:30") {
    if (user.state !== "active")
        return "La cuenta del profesional no está activa para nuevas citas.";
    const state = effectiveProfessionalState(user, day);
    if (state !== "ACTIVE")
        return state === "VACATION" ? "El profesional estará de vacaciones en la fecha seleccionada." : state === "LEAVE" ? "El profesional tendrá un permiso en la fecha seleccionada." : "El profesional no está disponible para nuevas citas.";
    const assignment = user.assignments.find(item => item.siteId === siteId && item.active);
    if (!assignment)
        return "El profesional no está asignado a esta sede.";
    if (!assignment.days.includes(new Date(day + "T12:00:00Z").getUTCDay()) || start < assignment.start || end > assignment.end)
        return "El horario está fuera de la atención asignada en esta sede.";
    return null;
}
export function estimateLicense(plan: CommercialPlan, usage: {
    sites: number;
    professionals: number;
    users: number;
    storage: number;
    addons: number;
}) {
    const extras = { sites: Math.max(0, usage.sites - plan.includedSites) * plan.extraSite, professionals: Math.max(0, usage.professionals - plan.includedProfessionals) * plan.extraProfessional, users: Math.max(0, usage.users - plan.includedUsers) * plan.extraUser };
    return { base: plan.base, ...extras, storage: usage.storage, addons: usage.addons, total: plan.base + extras.sites + extras.professionals + extras.users + usage.storage + usage.addons };
}
