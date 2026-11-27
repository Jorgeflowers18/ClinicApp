import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter } from "@/components/ui/dialog";
import { focusValidationError } from "@/shared/lib/validation-focus";
import { getErrorMessage } from "@/shared/lib/error-message";
import { useDemoContext, useSaasData, useSessionUser } from "../state";
import { roleSummary } from "../lib/access-catalogs";
import { activeInstitutionScope } from "../lib/institution-scope";
import { roleLabels } from "@/modules/auth/types/user-admin.types";
import { identityService } from "../services";
import { accountStates, professionalStates, type IdentityProfile } from "../types";
import { effectiveProfessionalState } from "../lib/professional-policy";
import { UsernameField } from "./controls";
export function AccountIdentityFields({ value, onChange, errors, initial }: {
    value: IdentityProfile;
    onChange: (value: IdentityProfile) => void;
    errors: Record<string, string>;
    initial: boolean;
}) {
    const data = useSaasData(), demo = useDemoContext(state => state.userId), [setup, setSetup] = useState(false), navigate = useNavigate(), assigned = [...data.identities, ...data.users].find(item => item.id === value.id)?.username ?? data.serverStaffSettings?.["frontend-institution-current"]?.[value.id]?.username;
    const member = data.users.find(item => item.id === value.id), actor = useSessionUser();
    return <div className="saas-scope saas-stack"><div className="saas-grid">{(["firstName", "lastName"] as const).map(key => <Field data-invalid={Boolean(errors[key])} key={key}><FieldLabel htmlFor={`identity-${key}`}>{key === "firstName" ? "Nombres" : "Apellidos"} *</FieldLabel><Input id={`identity-${key}`} name={key} value={value[key]} aria-invalid={Boolean(errors[key])} onChange={event => onChange({ ...value, [key]: event.target.value })}/><FieldError>{errors[key]}</FieldError></Field>)}</div>{initial || assigned ? <UsernameField value={value.username} onChange={username => onChange({ ...value, username })} firstName={value.firstName} lastName={value.lastName} accountId={value.id} required readOnly={Boolean(assigned)} error={errors.username}/> : <div><p>Nombre de usuario: sin crear</p><Button variant="outline" type="button" onClick={() => setSetup(true)}>Crear nombre de usuario</Button></div>}<div className="saas-grid">{(["email", "phone"] as const).map(key => <Field key={key} data-invalid={Boolean(errors[key])}><FieldLabel htmlFor={`identity-${key}`}>{key === "email" ? "Correo electrónico" : "Teléfono"}</FieldLabel><Input id={`identity-${key}`} name={key} type={key === "email" ? "email" : "tel"} value={value[key]} readOnly={key === "email"} onChange={event => onChange({ ...value, [key]: event.target.value })} aria-invalid={Boolean(errors[key])}/><FieldError>{errors[key]}</FieldError></Field>)}</div><p className="saas-hint">Rol de acceso (solo lectura): {member ? roleSummary(member, data, activeInstitutionScope()) : actor ? roleLabels[actor.role] : "Sin sesión"}. {member && `Estado de cuenta: ${accountStates[member.state]}.`}</p><p className="saas-hint">Nombre de usuario y teléfono: datos del adaptador local. La cuenta del servidor conserva su identidad y correo de acceso.</p>{member && <dl className="saas-summary"><div><dt>Organizaciones (solo lectura)</dt><dd>{data.organizations.filter(item => member.organizationIds.includes(item.id)).map(item => item.name || "Institución sin configurar").join(", ")}</dd></div><div><dt>Sedes asignadas (solo lectura)</dt><dd>{data.organizations.flatMap(org => org.branches).filter(site => member.assignments.some(assignment => assignment.active && assignment.siteId === site.id)).map(site => site.name).join(", ") || "Sin asignar"}</dd></div>{member.professionalId && <div><dt>Estado profesional (solo lectura)</dt><dd>{professionalStates[effectiveProfessionalState(member)]}</dd></div>}<div><dt>Especialidades asignadas (solo lectura)</dt><dd>{data.specialties.filter(item => member.specialtyIds.includes(item.id)).map(item => item.name).join(", ") || "—"}</dd></div></dl>}<Button variant="outline" type="button" onClick={() => navigate(demo ? "/cambio-inicial-contrasena" : "/cambiar-contrasena?demo=1")}>Cambiar contraseña · recorrido de demostración</Button>{setup && <UsernameSetupDialog value={value} onSaved={next => { onChange(next); setSetup(false); }} onClose={() => setSetup(false)}/>}</div>;
}
function UsernameSetupDialog({ value, onSaved, onClose }: {
    value: IdentityProfile;
    onSaved: (next: IdentityProfile) => void;
    onClose: () => void;
}) { const [username, setUsername] = useState(value.username), [error, setError] = useState(""), [busy, setBusy] = useState(false), root = useRef<HTMLDivElement>(null); return <Dialog open onOpenChange={open => !open && !busy && onClose()}><DialogContent className="saas-scope"><DialogHeader><DialogTitle>Crear nombre de usuario</DialogTitle><DialogDescription>Conserva el identificador interno de tu cuenta.</DialogDescription></DialogHeader><DialogBody ref={root}><UsernameField value={username} onChange={next => { setUsername(next); setError(""); }} firstName={value.firstName} lastName={value.lastName} accountId={value.id} required error={error}/></DialogBody><DialogFooter><Button variant="outline" onClick={onClose}>Cancelar</Button><Button disabled={busy} onClick={async () => { setBusy(true); try {
    await identityService.save({ ...value, username });
    onSaved({ ...value, username });
}
catch (cause) {
    setError(getErrorMessage(cause));
    focusValidationError(root.current, "username");
}
finally {
    setBusy(false);
} }}>Guardar nombre de usuario</Button></DialogFooter></DialogContent></Dialog>; }
