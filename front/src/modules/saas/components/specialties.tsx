import { useRef, useState } from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import { useValidatedForm } from "@/shared/hooks/use-validated-form";
import { applyServerFieldErrors } from "@/shared/lib/field-issues";
import { getErrorMessage } from "@/shared/lib/error-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DataTable } from "@/shared/components/data-table";
import { useDemoContext, useSaasData } from "../state";
import { demoId } from "../adapters/demo-repository";
import { demoStaffAdapter } from "../services";
import type { Specialty } from "../types";
const schema = z.object({ name: z.string().trim().min(2, "Indica al menos 2 caracteres.").max(80, "Hasta 80 caracteres."), description: z.string().max(300, "Hasta 300 caracteres.") });
export function SpecialtyManagement({onEdit}:{onEdit:(specialty:Specialty)=>void}) { const data = useSaasData(), org = useDemoContext(state => state.organizationId), [failure, setFailure] = useState(""); return <div className="saas-stack">{failure && <p role="alert" className="text-destructive">{failure}</p>}<DataTable data={data.specialties.filter(item => item.organizationId === org)} getRowId={item => item.id} columns={[{ key: "name", header: "Especialidad", cell: item => item.name }, { key: "description", header: "Descripción", cell: item => item.description || "—" }, { key: "professionals", header: "Profesionales", cell: item => data.users.filter(user => user.organizationIds.includes(org) && user.specialtyIds.includes(item.id)).length }, { key: "active", header: "Estado", cell: item => item.active ? "Activa" : "Inactiva" }, { key: "actions", header: "", cell: item => <div className="saas-inline"><Button size="sm" variant="ghost" onClick={() => onEdit(item)}>Editar</Button><Button size="sm" variant="ghost" onClick={async () => { try {
            await demoStaffAdapter.saveSpecialty({ ...item, active: !item.active });
        }
        catch (error) {
            setFailure(getErrorMessage(error));
        } }}>{item.active ? "Desactivar" : "Activar"}</Button></div> }]}/></div>; }
export function SpecialtyEditor({ specialty, organizationId, onClose }: {
    specialty: Specialty | null;
    organizationId: string;
    onClose: () => void;
}) { const root = useRef<HTMLDivElement>(null), [failure, setFailure] = useState(""); const form = useValidatedForm({ resolver: zodResolver(schema), defaultValues: { name: specialty?.name ?? "", description: specialty?.description ?? "" } }, root), errors = form.formState.errors; return <Dialog open onOpenChange={open => !open && onClose()}><DialogContent className="saas-scope"><DialogHeader><DialogTitle>{specialty ? "Editar especialidad" : "Nueva especialidad"}</DialogTitle><DialogDescription>Catálogo de esta organización de demostración.</DialogDescription></DialogHeader><DialogBody ref={root}><form id="specialty-form" className="saas-stack" noValidate onSubmit={form.handleSubmit(async (value) => { setFailure(""); try {
    await demoStaffAdapter.saveSpecialty({ ...value, id: specialty?.id ?? demoId(), organizationId, active: specialty?.active ?? true });
    onClose();
}
catch (error) {
    if (!applyServerFieldErrors(form, error).length)
        setFailure(getErrorMessage(error));
} })}><Field data-invalid={Boolean(errors.name)}><FieldLabel htmlFor="specialty-name">Nombre *</FieldLabel><Input id="specialty-name" {...form.register("name")} aria-invalid={Boolean(errors.name)}/><FieldError>{errors.name?.message}</FieldError></Field><Field data-invalid={Boolean(errors.description)}><FieldLabel htmlFor="specialty-description">Descripción</FieldLabel><Textarea id="specialty-description" {...form.register("description")} aria-invalid={Boolean(errors.description)}/><FieldError>{errors.description?.message}</FieldError></Field>{failure && <p role="alert" className="text-destructive">{failure}</p>}</form></DialogBody><DialogFooter><Button variant="outline" onClick={onClose}>Cancelar</Button><Button type="submit" form="specialty-form" disabled={form.formState.isSubmitting}>Guardar especialidad</Button></DialogFooter></DialogContent></Dialog>; }
