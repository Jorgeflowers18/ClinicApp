import { env } from "@/shared/lib/env"

import type { AgendaCatalogsApi, AppointmentsApi } from "./appointments.contract"
import { httpAgendaCatalogsApi, httpAppointmentsApi } from "./appointments.http"
import { mockAgendaCatalogsApi, mockAppointmentsApi } from "./appointments.mock"

const usesApi = env.usesApi("agenda")

/** La única elección entre la API y la demostración: citas, bloqueos y catálogos de la agenda. */
export const agendaCatalogsApi: AgendaCatalogsApi = usesApi ? httpAgendaCatalogsApi : mockAgendaCatalogsApi

/** Citas y bloqueos, más los catálogos (`listProfessionals`, `listRooms`) que ya usan otros módulos. */
export const appointmentsApi: AppointmentsApi & AgendaCatalogsApi = {
  ...(usesApi ? httpAppointmentsApi : mockAppointmentsApi),
  listProfessionals: (signal) => agendaCatalogsApi.listProfessionals(signal),
  listRooms: (signal) => agendaCatalogsApi.listRooms(signal),
}
