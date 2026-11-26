import type { Role, UserProfile } from "@/modules/auth/types/auth.types";
import type { InstitutionBranch } from "@/modules/institution/types/institution.types";
export const professionalStates = { ACTIVE: "Activo", INACTIVE: "Inactivo", VACATION: "Vacaciones", LEAVE: "Permiso/Licencia", RETIRED: "Retirado" } as const;
export type ProfessionalState = keyof typeof professionalStates;
export type AccountState = "active" | "inactive" | "blocked" | "pending";
export const accountStates: Record<AccountState, string> = { active: "Activa", inactive: "Inactiva", blocked: "Bloqueada", pending: "Pendiente de activación" };
export interface Absence {
    id: string;
    type: "VACATION" | "LEAVE";
    from: string;
    to: string;
    note: string;
}
export interface SiteAssignment {
    organizationId: string;
    siteId: string;
    main: boolean;
    active: boolean;
    days: number[];
    start: string;
    end: string;
}
export interface StaffUser {
    id: string;
    firstName: string;
    lastName: string;
    username: string;
    email: string;
    phone: string;
    documentType: string;
    documentNumber: string;
    roles: Role[];
    state: AccountState;
    organizationIds: string[];
    assignments: SiteAssignment[];
    professionalId: string | null;
    profession: string;
    registration: string;
    specialtyIds: string[];
    professionalState: ProfessionalState;
    absences: Absence[];
    activation: "invitation" | "temporary" | "active";
    mustChangePassword: boolean;
    profile: UserProfile | null;
    createdAt: string;
}
export interface Organization {
    id: string;
    name: string;
    businessAccountId: string;
    branches: InstitutionBranch[];
    logo: string | null;
}
export interface Specialty {
    id: string;
    organizationId: string;
    name: string;
    description: string;
    active: boolean;
}
export type PermissionAction = "view" | "create" | "edit" | "deactivate" | "approve" | "export" | "manage";
export interface AccessRequest {
    id: string;
    firstName: string;
    lastName: string;
    username: string;
    email: string;
    institution: string;
    state: "pending" | "reviewed" | "approved" | "created";
    userId?: string;
}
export interface IdentityProfile {
    id: string;
    firstName: string;
    lastName: string;
    username: string;
    email: string;
    phone: string;
}
export interface CommercialPlan {
    id: string;
    name: string;
    base: number;
    includedSites: number;
    includedProfessionals: number;
    includedUsers: number;
    extraSite: number;
    extraProfessional: number;
    extraUser: number;
    countStates: ProfessionalState[];
}
export interface SaasData {
    version: 1;
    users: StaffUser[];
    organizations: Organization[];
    specialties: Specialty[];
    requests: AccessRequest[];
    plans: CommercialPlan[];
    identities: IdentityProfile[];
    grants?: Record<string, boolean>;
    audit: {
        at: string;
        actorId: string;
        recordId: string;
        action: string;
    }[];
}
export interface StaffAdapter {
    read(): SaasData;
    saveUser(user: StaffUser): Promise<StaffUser>;
    saveSpecialty(specialty: Specialty): Promise<void>;
    saveOrganization(organization: Organization): Promise<void>;
}
