import type { PatientsApi } from "@/modules/patients/api/patients.contract";
import { patientSchema, type Patient } from "@/modules/patients/types/patient.types";
import type { AppointmentsApi, AgendaCatalogsApi } from "@/modules/appointments/api/appointments.contract";
import { appointmentSchema, type Appointment, type ScheduleBlock } from "@/modules/appointments/types/appointment.types";
import type { NotificationsApi } from "@/modules/notifications/api/notifications.contract";
import { ApiError } from "@/shared/types/common";
import { queryClient } from "@/shared/lib/query-client";
import { useDemoContext } from "../state";
import { clinicDay, professionalAvailability } from "../lib/professional-policy";
import { demoInstitutionProfile } from "@/modules/institution/api/institution.demo";
import { nameOf } from "../lib/identity";
import type { SaasData } from "../types";
import { demoCan } from "../lib/permissions";
import { demoId, readDemoData, updateDemoData } from "./demo-repository";
interface Operations {
    patients: Patient[];
    appointments: (Appointment & {
        siteId?: string;
    })[];
    blocks: (ScheduleBlock & {
        siteId?: string;
    })[];
    template: string;
}
type Data = SaasData & {
    operations?: Record<string, Operations>;
};
function scope() { const context = useDemoContext.getState(), data = readDemoData(), user = data.users.find(item => item.id === context.userId), record = data.organizations.find(item => item.id === context.organizationId), organization = record ? { ...record, name: demoInstitutionProfile().name, branches: demoInstitutionProfile().branches } : undefined; if (!user || !organization || !user.organizationIds.includes(organization.id) || user.state !== "active")
    throw new ApiError("Selecciona una organización de demostración autorizada.", 403); if (context.siteId && !organization.branches.some(item => item.id === context.siteId))
    throw new ApiError("La sede ya no está disponible.", 403); if (context.siteId && !user.roles.includes("admin") && !user.assignments.some(item => item.active && item.organizationId === organization.id && item.siteId === context.siteId))
    throw new ApiError("La sede no está asignada a tu identidad.", 403); return { ...context, user, organization }; }
function initial(org: string): Operations { const patient: Patient = { ...patientSchema.parse({ firstName: "Paciente", lastName: "de demostración", documentId: "DEMO-1001", documentType: "otro", birthDate: "1990-01-01", gender: "otro", phone: "+593990000001", notificationsEnabled: true }), id: org + "-patient", clinicalRecordNumber: "HC-DEMO-0001", createdAt: new Date().toISOString(), deletedAt: null }; const member = ["demo-centro", "demo-norte"].includes(org) ? readDemoData().users.find(user => user.professionalId && user.organizationIds.includes(org)) : undefined; return { patients: ["demo-centro", "demo-norte"].includes(org) ? [patient] : [], appointments: member && readDemoData().organizations.find(item => item.id === org)?.profile?.branches.some(site => site.id === org + "-main") ? [{ id: org + "-appointment", patientId: patient.id, patientName: nameOf(patient), professionalId: member.professionalId!, start: clinicDay() + "T10:00:00-05:00", end: clinicDay() + "T10:30:00-05:00", status: "programada", createdAt: new Date().toISOString(), roomId: org + "-room", siteId: org + "-main" }] : [], blocks: [], template: "Hola {nombre_paciente}, te recordamos tu cita del {fecha_cita} a las {hora_cita} con {profesional} en {nombre_institucion}." }; }
const initialCache = new Map<string, Operations>();
function read() { const { organizationId } = scope(); const saved = (readDemoData() as Data).operations?.[organizationId]; if (saved)
    return saved; if (!initialCache.has(organizationId))
    initialCache.set(organizationId, initial(organizationId)); return initialCache.get(organizationId)!; }
function write(mutate: (value: Operations) => void) { const { organizationId } = scope(); updateDemoData(next => { const data = next as Data; data.operations ??= {}; data.operations[organizationId] ??= structuredClone(read()); mutate(data.operations[organizationId]); }); void queryClient.invalidateQueries(); }
function admin() { if (!scope().user.roles.includes("admin"))
    throw new ApiError("Se requiere administración de demostración.", 403); }
function capability(module: string, action: string) { if (!demoCan(scope().user, readDemoData(), module, action))
    throw new ApiError("Tu rol no permite esta operación en la demostración.", 403); }
const found = <T extends {
    id: string;
}>(items: T[], id: string): T => { const result = items.find(item => item.id === id); if (!result)
    throw new ApiError("El registro no está disponible en esta organización.", 404); return result; };
export const demoPatientsApi: PatientsApi = {
    async list(query) { let rows = read().patients.filter(patient => Boolean(patient.deletedAt) === Boolean(query.deleted)); if (query.deleted)
        admin(); if (query.search) {
        const needle = query.search.trim().toLowerCase();
        rows = rows.filter(patient => [nameOf(patient), patient.documentId, patient.email, patient.phone].join(" ").toLowerCase().includes(needle));
    } if (query.status)
        rows = rows.filter(patient => patient.treatmentStatus === query.status); if (query.gender)
        rows = rows.filter(patient => patient.gender === query.gender); if (query.registeredFrom)
        rows = rows.filter(patient => patient.createdAt.slice(0, 10) >= query.registeredFrom!); if (query.registeredTo)
        rows = rows.filter(patient => patient.createdAt.slice(0, 10) <= query.registeredTo!); const page = query.page ?? 1, pageSize = query.pageSize ?? 20; return { items: rows.slice((page - 1) * pageSize, page * pageSize), page, pageSize, totalItems: rows.length, totalPages: Math.max(1, Math.ceil(rows.length / pageSize)) }; },
    async get(id) { return found(read().patients, id); },
    async create(values) { capability("Pacientes", "create"); const parsed = patientSchema.parse(values); if (read().patients.some(patient => patient.documentType === parsed.documentType && patient.documentId.toLowerCase() === parsed.documentId.toLowerCase()))
        throw new ApiError("Ya existe un paciente con este documento en la organización.", 409, [{ field: "documentId", message: "Consulta la ficha existente antes de crear otra." }]); const patient = { ...parsed, id: demoId(), clinicalRecordNumber: `HC-DEMO-${String(read().patients.length + 1).padStart(4, "0")}`, createdAt: new Date().toISOString(), deletedAt: null }; write(value => value.patients.push(patient)); return patient; },
    async update(id, values) { capability("Pacientes", "edit"); const previous = found(read().patients, id), parsed = patientSchema.parse(values); if (read().patients.some(patient => patient.id !== id && patient.documentType === parsed.documentType && patient.documentId === parsed.documentId))
        throw new ApiError("Documento ya registrado.", 409, [{ field: "documentId", message: "El documento ya pertenece a otro paciente de esta organización." }]); const patient = { ...previous, ...parsed }; write(value => { value.patients = value.patients.map(item => item.id === id ? patient : item); }); return patient; },
    async remove(id) { capability("Pacientes", "deactivate"); found(read().patients, id); write(value => { found(value.patients, id).deletedAt = new Date().toISOString(); }); }, async restore(id) { admin(); const patient = { ...found(read().patients, id), deletedAt: null }; write(value => { value.patients = value.patients.map(item => item.id === id ? patient : item); }); return patient; },
};
export const demoAppointmentsApi: AppointmentsApi & AgendaCatalogsApi = {
    async list(range) { const items = read().appointments.filter(item => (item.siteId ?? scope().organization.branches.find(site => site.isMain)?.id) === scope().siteId); return items.filter(item => !range || clinicDay(new Date(item.start)) >= range.from && clinicDay(new Date(item.start)) <= range.to); },
    async listByPatient(id) { found(read().patients, id); return read().appointments.filter(item => item.patientId === id && (item.siteId ?? scope().organization.branches.find(site => site.isMain)?.id) === scope().siteId); }, async get(id) { return found(read().appointments, id); },
    async create(values) { return saveAppointment(undefined, values); }, async update(id, values) { const previous = found(read().appointments, id); if (!["programada", "confirmada"].includes(previous.status))
        throw new ApiError("Solo puedes editar citas activas.", 409); return saveAppointment(id, values); },
    async updateStatus(id, status) { capability("Citas", "edit"); const previous = found(read().appointments, id); const allowed: Record<string, string[]> = { programada: ["confirmada", "cancelada", "completada", "no_asistio"], confirmada: ["cancelada", "completada", "no_asistio"] }; if (previous.status !== status && !allowed[previous.status]?.includes(status))
        throw new ApiError("Esta transición no está disponible.", 409); const next = { ...previous, status }; write(value => { value.appointments = value.appointments.map(item => item.id === id ? next : item); }); return next; },
    async listScheduleBlocks(range) { return read().blocks.filter(item => (item.siteId ?? scope().organization.branches.find(site => site.isMain)?.id) === scope().siteId).filter(item => !range || item.start.slice(0, 10) >= range.from && item.start.slice(0, 10) <= range.to); }, async createScheduleBlock(values) { capability("Citas", "create"); const block = { ...values, siteId: scope().siteId, id: demoId(), start: `${values.date}T${values.startTime}:00-05:00`, end: `${values.date}T${values.endTime}:00-05:00`, createdAt: new Date().toISOString() }; write(value => value.blocks.push(block)); return block; }, async removeScheduleBlock(id) { capability("Citas", "edit"); found(read().blocks, id); write(value => { value.blocks = value.blocks.filter(item => item.id !== id); }); },
    async listProfessionals() { const { organizationId, siteId } = scope(); const data = readDemoData(); return data.users.filter(user => user.professionalId && user.organizationIds.includes(organizationId)).map(user => ({ id: user.professionalId!, name: nameOf(user), specialty: data.specialties.find(item => item.id === user.specialtyIds[0])?.name ?? user.profession, registrationNumber: user.registration, active: user.roles.includes("medico") && user.state === "active" && !["INACTIVE", "RETIRED"].includes(user.professionalState) && Boolean(siteId) && user.assignments.some(item => item.organizationId === organizationId && item.siteId === siteId && item.active) && (!user.specialtyIds.length || data.specialties.some(item => user.specialtyIds.includes(item.id) && item.organizationId === organizationId && item.active)), userId: user.id })); }, async listRooms() { const { organizationId } = scope(); return [{ id: organizationId + "-room", name: "Consultorio de demostración", active: true }]; },
    async createProfessional() { throw new ApiError("Crea el profesional desde Personal y accesos para conservar su identidad única.", 409); }, async updateProfessional() { throw new ApiError("Edita el profesional desde Personal y accesos.", 409); }, async createRoom() { throw new ApiError("La administración de consultorios utiliza la API real.", 501); }, async updateRoom() { throw new ApiError("La administración de consultorios utiliza la API real.", 501); },
};
async function saveAppointment(id: string | undefined, values: Parameters<AppointmentsApi["create"]>[0]) { capability("Citas", id ? "edit" : "create"); const parsed = appointmentSchema.parse(values), { organizationId, siteId } = scope(), patient = found(read().patients, parsed.patientId), professional = readDemoData().users.find(user => user.professionalId === parsed.professionalId && user.organizationIds.includes(organizationId)); if (!professional)
    throw new ApiError("Profesional no disponible en esta organización.", 422, [{ field: "professionalId", message: "Selecciona un profesional de esta organización." }]); if (!professional.roles.includes("medico") || !siteId || !scope().organization.branches.some(site => site.id === siteId) || professional.specialtyIds.length && !readDemoData().specialties.some(item => item.organizationId === organizationId && item.active && professional.specialtyIds.includes(item.id))) throw new ApiError("El profesional no está disponible para nuevas citas en esta sede.", 422, [{ field: "professionalId", message: "Selecciona un profesional clínico con sede y especialidad activa." }]); const problem = professionalAvailability(professional, siteId, parsed.date, parsed.startTime, parsed.endTime); if (problem)
    throw new ApiError(problem, 422, [{ field: "professionalId", message: problem }]); const start = `${parsed.date}T${parsed.startTime}:00-05:00`, end = `${parsed.date}T${parsed.endTime}:00-05:00`; if (read().appointments.some(item => item.id !== id && ["programada", "confirmada"].includes(item.status) && (item.professionalId === parsed.professionalId || Boolean(parsed.roomId) && item.roomId === parsed.roomId) && item.start < end && item.end > start) || read().blocks.some(item => (item.professionalId === parsed.professionalId || Boolean(parsed.roomId) && item.roomId === parsed.roomId) && item.start < end && item.end > start))
    throw new ApiError("El horario coincide con otra cita o bloqueo.", 409, [{ field: "startTime", message: "Selecciona otro horario disponible." }]); const appointment: Appointment & {
    siteId: string;
} = { ...parsed, siteId, id: id ?? demoId(), patientName: nameOf(patient), start, end, status: id ? found(read().appointments, id).status : "programada", createdAt: id ? found(read().appointments, id).createdAt : new Date().toISOString() }; write(value => { if (id)
    value.appointments = value.appointments.map(item => item.id === id ? appointment : item);
else
    value.appointments.push(appointment); }); return appointment; }
/** Resource-level adapter selection. Real HTTP implementations remain unchanged. */
export function withDemoAdapter<T extends object>(real: T, demo: Partial<T>): T { return new Proxy(real, { get(target, key) { const property = key as keyof T; const method = target[property]; if (typeof method !== "function")
        return method; return (...args: unknown[]) => { if (useDemoContext.getState().userId) {
        const substitute = demo[property];
        if (typeof substitute !== "function")
            return Promise.reject(new ApiError("Esta operación no está conectada a la demostración. El servidor no fue modificado.", 501));
        return substitute(...args);
    } return method(...args); }; } }); }
export const demoNotificationsApi: Partial<NotificationsApi> = { async getAlerts() { const day = clinicDay(), { user } = scope(); const appointments = await demoAppointmentsApi.list({ from: day, to: day }); return { date: day, appointmentsToday: appointments.filter(item => !user.professionalId || item.professionalId === user.professionalId).map(item => { const professional = readDemoData().users.find(user => user.professionalId === item.professionalId); return { ...item, patientName: item.patientName ?? nameOf(found(read().patients, item.patientId)), professionalName: professional ? nameOf(professional) : "Profesional no disponible" }; }), birthdaysToday: read().patients.filter(item => !item.deletedAt && item.birthDate.slice(5) === day.slice(5)).map(item => ({ patientId: item.id, patientName: nameOf(item), birthDate: item.birthDate })), criticalItems: [], failedDeliveries: [] }; }, async list(query) { scope(); return { items: [], page: query.page ?? 1, pageSize: query.pageSize ?? 20, totalItems: 0, totalPages: 1 }; }, async listByAppointment() { scope(); return []; }, async getSummary() { scope(); return { total: 0, sent: 0, failed: 0 }; }, async getTemplate() { const value = read(); return { id: "demo-template", message: value.template, updatedAt: new Date().toISOString() }; }, async updateTemplate(values) { capability("Mensajería", "edit"); write(value => { value.template = values.message; }); return { id: "demo-template", message: values.message, updatedAt: new Date().toISOString() }; } };
export function demoFutureAppointments(professionalId: string, organizationId = scope().organizationId) { return ((readDemoData() as Data).operations?.[organizationId] ?? initialCache.get(organizationId) ?? initial(organizationId)).appointments.filter(item => item.professionalId === professionalId && new Date(item.start) > new Date() && ["programada", "confirmada"].includes(item.status)); }
