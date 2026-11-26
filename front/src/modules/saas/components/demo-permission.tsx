import type { ReactNode } from "react";
import { useDemoContext, useSaasData } from "../state";
import { demoCan } from "../lib/permissions";
export function DemoPermission({ module, action, children }: {
    module: string;
    action: string;
    children: ReactNode;
}) { const id = useDemoContext(state => state.userId), data = useSaasData(), user = data.users.find(item => item.id === id); return !id || user && demoCan(user, data, module, action) ? children : null; }
