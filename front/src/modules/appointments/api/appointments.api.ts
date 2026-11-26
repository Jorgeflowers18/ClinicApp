import type { AgendaCatalogsApi, AppointmentsApi } from "./appointments.contract"
import { httpAgendaCatalogsApi, httpAppointmentsApi } from "./appointments.http"
import { demoAppointmentsApi,withDemoAdapter } from "@/modules/saas/adapters/operational-demo"

/** Catálogos de la agenda: profesionales y consultorios. */
export const agendaCatalogsApi: AgendaCatalogsApi = withDemoAdapter(httpAgendaCatalogsApi,demoAppointmentsApi)

/** Citas y bloqueos, más los catálogos (`listProfessionals`, `listRooms`) que ya usan otros módulos. */
export const appointmentsApi: AppointmentsApi & AgendaCatalogsApi = withDemoAdapter({ ...httpAppointmentsApi, ...httpAgendaCatalogsApi },demoAppointmentsApi)
