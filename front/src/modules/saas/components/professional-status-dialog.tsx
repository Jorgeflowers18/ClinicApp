import { useRef, useState } from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useValidatedForm } from "@/shared/hooks/use-validated-form";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter } from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { getErrorMessage } from "@/shared/lib/error-message";
import { demoFutureAppointments } from "../adapters/operational-demo";
import { useStaffInstitution } from "../lib/institution-scope";
import { demoId } from "../adapters/demo-repository";
import { nameOf } from "../lib/identity";
import { clinicDay, effectiveProfessionalState } from "../lib/professional-policy";
import { demoStaffAdapter } from "../services";
import { professionalStates, type StaffUser, type ProfessionalState } from "../types";
import { SaasSelect } from "./controls";
const schema = z.object({ state: z.enum(["ACTIVE", "INACTIVE", "VACATION", "LEAVE", "RETIRED"]), from: z.string(), to: z.string(), note: z.string().max(500, "Hasta 500 caracteres."), confirmed: z.boolean() }).superRefine((value, context) => {
    if (["VACATION", "LEAVE"].includes(value.state)) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(value.from))
            context.addIssue({ code: "custom", path: ["from"], message: "Indica la fecha de inicio." });
        if (!value.to || value.to < value.from)
            context.addIssue({ code: "custom", path: ["to"], message: "La finalización debe ser igual o posterior al inicio." });
    }
    if (value.state === "RETIRED" && !value.confirmed)
        context.addIssue({ code: "custom", path: ["confirmed"], message: "Confirma el retiro. Los históricos se conservarán." });
});
export function ProfessionalStatusDialog({ user, onClose }: {
    user: StaffUser;
    onClose: () => void;
}) {
    const root = useRef<HTMLDivElement>(null), [error, setError] = useState(""), { organizationId } = useStaffInstitution();
    const future = user.professionalId ? demoFutureAppointments(user.professionalId, organizationId) : [];
    const form = useValidatedForm({ resolver: zodResolver(schema), defaultValues: { state: effectiveProfessionalState(user), from: clinicDay(), to: "", note: "", confirmed: false } }, root), values = form.watch(), errors = form.formState.errors;
    async function save(next: z.infer<typeof schema>) { setError(""); try {
        const absence = ["VACATION", "LEAVE"].includes(next.state);
        await demoStaffAdapter.saveUser({ ...user, professionalState: absence ? "ACTIVE" : next.state, absences: absence ? [...user.absences, { id: demoId(), type: next.state as "VACATION" | "LEAVE", from: next.from, to: next.to, note: next.note }] : next.state === "ACTIVE" ? user.absences.filter(item => item.to < clinicDay()) : user.absences });
        onClose();
    }
    catch (cause) {
        setError(getErrorMessage(cause));
    } }
    return <Dialog open onOpenChange={open => !open && !form.formState.isSubmitting && onClose()}><DialogContent className="saas-scope"><DialogHeader><DialogTitle>Cambiar estado profesional</DialogTitle><DialogDescription>{nameOf(user)} · Actual: {professionalStates[effectiveProfessionalState(user)]}</DialogDescription></DialogHeader><DialogBody ref={root}><form id="professional-state" noValidate onSubmit={form.handleSubmit(save)} className="saas-stack"><SaasSelect label="Nuevo estado" value={values.state} items={professionalStates} onChange={value => form.setValue("state", value as ProfessionalState)}/>{["VACATION", "LEAVE"].includes(values.state) && <div className="saas-grid">{(["from", "to"] as const).map(key => <Field key={key} data-invalid={Boolean(errors[key])}><FieldLabel htmlFor={key}>{key === "from" ? "Fecha de inicio" : "Fecha de finalización"} *</FieldLabel><Input id={key} type="date" {...form.register(key)} aria-invalid={Boolean(errors[key])}/><FieldError>{errors[key]?.message}</FieldError></Field>)}</div>}<Field><FieldLabel htmlFor="absence-note">Observación privada (no se muestra en el directorio)</FieldLabel><Textarea id="absence-note" {...form.register("note")} maxLength={500}/></Field>{values.state === "RETIRED" && <Field data-invalid={Boolean(errors.confirmed)}><label className="saas-check"><input type="checkbox" {...form.register("confirmed")}/>Confirmo el retiro conservando la identidad y sus históricos.</label><FieldError>{errors.confirmed?.message}</FieldError></Field>}<p className="saas-notice">{future.length ? `${future.length} cita(s) futura(s) activa(s) en esta organización. ` : "No hay citas futuras activas registradas en esta organización de demostración. "}Revisa las citas futuras antes de confirmar. No se cancelará ni reasignará ninguna cita automáticamente. La cuenta de acceso mantiene su estado.</p><div className="saas-stack">{user.absences.map(item => <div key={item.id} className="saas-inline"><span>{professionalStates[item.type]}: {item.from} — {item.to}</span><Button type="button" variant="ghost" size="sm" onClick={async () => { try {
        await demoStaffAdapter.saveUser({ ...user, absences: user.absences.filter(value => value.id !== item.id) });
    }
    catch (cause) {
        setError(getErrorMessage(cause));
    } }}>Retirar período</Button></div>)}</div>{error && <p role="alert" className="text-destructive">{error}</p>}</form></DialogBody><DialogFooter><Button variant="outline" onClick={onClose}>Cancelar</Button><Button type="submit" form="professional-state" disabled={form.formState.isSubmitting}>Guardar estado</Button></DialogFooter></DialogContent></Dialog>;
}
