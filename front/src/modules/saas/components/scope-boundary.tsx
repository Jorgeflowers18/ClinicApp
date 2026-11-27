import { Outlet, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useDemoContext, useSaasData } from "../state";
import { DemoNotice } from "./controls";
/** Do not mount API-backed clinical modules under an unrelated demonstration organization. */
export function SaasScopeBoundary() { const context = useDemoContext(), data = useSaasData(), location = useLocation(); if (!context.userId)
    return <Outlet />; const user = data.users.find(item => item.id === context.userId), org = data.organizations.find(item => item.id === context.organizationId); if (!user || !org || !user.organizationIds.includes(org.id))
    return <p role="alert">No tienes una asignación válida en esta organización de demostración.</p>; if (/^\/(accesos|administracion|personal-accesos|perfil-institucion|perfil-usuario|activar-cuenta|cambio-inicial-contrasena|cambiar-contrasena|pacientes|citas|notificaciones)/.test(location.pathname))
    return <div key={context.organizationId + context.siteId} className="saas-stack">{!/^\/personal-accesos/.test(location.pathname) && <DemoNotice />}<Outlet /></div>; return <div className="saas-scope saas-stack"><DemoNotice /><h1 className="text-xl font-semibold">{org.name}</h1><p>Los módulos clínicos de esta ruta utilizan la API real. Su información no se mostrará dentro de una organización de demostración.</p><p className="saas-hint">Puedes administrar las identidades, sedes y especialidades del recorrido de demostración. Sal del entorno de demostración para continuar con la operación clínica real.</p><Button variant="outline" onClick={() => { context.exit(); window.location.assign("/login"); }}>Salir de demostración</Button></div>; }
