import type { Role, UserProfile } from "@/modules/auth/types/auth.types";
import type { InstitutionBranch, InstitutionProfile } from "@/modules/institution/types/institution.types";
import type { AccountState, ProfessionalState } from "@/shared/lib/administrative-status";
export { accountStates, professionalStates } from "@/shared/lib/administrative-status";
export type { AccountState, ProfessionalState } from "@/shared/lib/administrative-status";
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
    accessRoleIds?: string[];
    roleAssignments?: Record<string, string[]>;
    professionalTypeId?: string | null;
    hasAccount?: boolean;
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
    /** Canonical profile for this isolated frontend demonstration. Legacy fields are not catalogs. */
    profile?: InstitutionProfile;
    id: string;
    name: string;
    businessAccountId: string;
    branches: InstitutionBranch[];
    logo: string | null;
}
export interface Specialty {
    professionalTypeIds?: string[];
    id: string;
    organizationId: string;
    name: string;
    description: string;
    active: boolean;
}
export type PermissionAction = "view" | "create" | "edit" | "deactivate" | "approve" | "export" | "manage";
export interface AccessRequest {
    createdAt?: string;
    personId?: string;
    /** Only requests with a known scope may be reviewed in that institution. */
    organizationId?: string;
    id: string;
    firstName: string;
    lastName: string;
    username: string;
    email: string;
    institution: string;
    state: "pending" | "reviewed" | "approved" | "created" | "rejected";
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
    accessRoles?: AccessRole[];
    professionalTypes?: ProfessionalType[];
    serverStaffSettings?: Record<string, Record<string, StaffSettings>>;
    branchStates?: Record<string, Record<string, boolean>>;
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
export interface StaffSettings {
    firstName?: string;
    lastName?: string;
    phone?: string;
    professionalState?: ProfessionalState;
    absences?: Absence[];
    state?: AccountState;
    activation?: "invitation" | "temporary" | "active";
    mustChangePassword?: boolean;
    accessConfiguredAt?: string;
    username?: string;
    email?: string;
    accessRoleIds: string[];
    professionalTypeId: string | null;
    specialtyIds?: string[];
    siteIds?: string[];
    documentType?: string;
    documentNumber?: string;
}
export interface AccessRole {
    id: string;
    organizationId: string;
    name: string;
    description: string;
    active: boolean;
    sections: string[];
    builtin?: Role;
}
export interface ProfessionalType {
    id: string;
    organizationId: string;
    name: string;
    description: string;
    active: boolean;
}
export interface StaffAdapter {
    read(): SaasData;
    saveUser(user: StaffUser): Promise<StaffUser>;
    saveSpecialty(specialty: Specialty): Promise<void>;
}
