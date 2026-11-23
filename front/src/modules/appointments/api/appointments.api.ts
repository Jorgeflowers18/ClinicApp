import type { AgendaCatalogsApi, AppointmentsApi } from "./appointments.contract"
import { httpAgendaCatalogsApi, httpAppointmentsApi } from "./appointments.http"

/** Catálogos de la agenda: profesionales y consultorios. */
export const agendaCatalogsApi: AgendaCatalogsApi = httpAgendaCatalogsApi

/** Citas y bloqueos, más los catálogos (`listProfessionals`, `listRooms`) que ya usan otros módulos. */
export const appointmentsApi: AppointmentsApi & AgendaCatalogsApi = { ...httpAppointmentsApi, ...httpAgendaCatalogsApi }
