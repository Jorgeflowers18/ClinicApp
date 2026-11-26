import { create } from "zustand";
import { useMemo, useSyncExternalStore } from "react";
import { useAuthStore } from "@/modules/auth/store/auth-store";
import { queryClient } from "@/shared/lib/query-client";
import { setDemonstrationActive } from "@/shared/lib/demonstration-boundary";
import type { AuthUser } from "@/modules/auth/types/auth.types";
import { nameOf } from "./lib/identity";
import { readDemoData, safeDemoSnapshot, subscribeDemoData } from "./adapters/demo-repository";
interface DemoContext {
    userId: string | null;
    organizationId: string;
    siteId: string;
    enter: (id: string) => void;
    exit: () => void;
    select: (organizationId: string, siteId: string) => void;
}
const sessionKey = "clinicapp.saas-demo-context.v1";
const emptyContext = { userId: null as string | null, organizationId: "demo-centro", siteId: "demo-centro-main" };
function restoreContext() { try {
    const value = JSON.parse(sessionStorage.getItem(sessionKey) ?? "null");
    if (!value)
        return emptyContext;
    const data = readDemoData(), user = data.users.find(item => item.id === value.userId), org = data.organizations.find(item => item.id === value.organizationId);
    if (value.userId && (!user || ["blocked", "inactive"].includes(user.state) || !user.organizationIds.includes(value.organizationId)))
        return emptyContext;
    const branches = org?.profile?.branches ?? [];
    return org ? { userId: user?.id ?? null, organizationId: org.id, siteId: branches.some(item => item.id === value.siteId) ? value.siteId : branches[0]?.id ?? "" } : emptyContext;
}
catch {
    return emptyContext;
} }
const restored = restoreContext();
setDemonstrationActive(Boolean(restored.userId));
function cacheContext(value: typeof emptyContext) { try {
    sessionStorage.setItem(sessionKey, JSON.stringify(value));
}
catch { /* Optional public demonstration state; no token or password is cached. */ } }
export const useDemoContext = create<DemoContext>((set) => ({
    ...restored,
    enter: userId => {
        const user = readDemoData().users.find(item => item.id === userId);
        if (!user || ["blocked", "inactive"].includes(user.state))
            throw new Error("Esta cuenta de demostración no está activa.");
        const branches = readDemoData().organizations.find(org => org.id === user.organizationIds[0])?.profile?.branches ?? [];
        const assignment = user.assignments.find(item => item.active && branches.some(branch => branch.id === item.siteId));
        const next = { userId, organizationId: user.organizationIds[0], siteId: assignment?.siteId ?? "" };
        setDemonstrationActive(true);
        queryClient.clear();
        cacheContext(next);
        set(next);
    },
    exit: () => { setDemonstrationActive(false); queryClient.clear(); cacheContext(emptyContext); set(emptyContext); },
    select: (organizationId, siteId) => { const userId = useDemoContext.getState().userId; const user = readDemoData().users.find(item => item.id === userId); if (userId && !user?.organizationIds.includes(organizationId))
        throw new Error("Esta organización no está asignada a tu identidad."); const org = readDemoData().organizations.find(item => item.id === organizationId); if (!org || siteId && !(org.profile?.branches ?? []).some(item => item.id === siteId))
        throw new Error("La sede no pertenece a la organización."); if (user && !user.roles.includes("admin") && siteId && !user.assignments.some(item => item.active && item.organizationId === organizationId && item.siteId === siteId))
        throw new Error("Esta sede no está asignada a tu identidad."); queryClient.clear(); cacheContext({ userId, organizationId, siteId }); set({ organizationId, siteId }); },
}));
export function useSaasData() {
    const data = useSyncExternalStore(subscribeDemoData, safeDemoSnapshot, safeDemoSnapshot);
    // Compatibility view: existing consumers read the confirmed profile, never legacy seed catalogs.
    return useMemo(() => ({ ...data, organizations: data.organizations.map(org => ({ ...org,
        name: org.profile?.name ?? "", logo: org.profile?.logoImage ?? null, branches: org.profile?.branches ?? [],
    })) }), [data]);
}
export function useSessionUser(): AuthUser | null {
    const real = useAuthStore(state => state.user), demoId = useDemoContext(state => state.userId), data = useSaasData();
    const demo = data.users.find(item => item.id === demoId);
    return demoId ? demo && !["blocked", "inactive"].includes(demo.state) ? { id: demo.id, name: nameOf(demo), email: demo.email, role: demo.roles.includes("admin") ? "admin" : demo.roles[0], professionalId: demo.professionalId, profile: demo.profile } : null : real;
}
export function currentActor() {
    const id = useDemoContext.getState().userId;
    if (id) {
        const user = readDemoData().users.find(item => item.id === id);
        return user && !["blocked", "inactive"].includes(user.state) ? { id, role: user.roles.includes("admin") ? "admin" : user.roles[0] } : null;
    }
    return useAuthStore.getState().user;
}
