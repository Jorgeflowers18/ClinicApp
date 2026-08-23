import { addDays, setHours, setMinutes, startOfDay } from "date-fns"

import type { Appointment, Professional } from "../types/appointment.types"

export const mockProfessionals: Professional[] = [
  { id: "prof_1", name: "Dra. Carla Ríos", specialty: "Odontología general" },
  { id: "prof_2", name: "Dr. Andrés Vega", specialty: "Ortodoncia" },
  { id: "prof_3", name: "Dra. Paula Nieto", specialty: "Endodoncia" },
]

function at(dayOffset: number, hour: number, minute = 0) {
  const day = startOfDay(addDays(new Date(), dayOffset))
  return setMinutes(setHours(day, hour), minute).toISOString()
}

export const mockAppointments: Appointment[] = [
  {
    id: "apt_1",
    patientId: "pat_1",
    professionalId: "prof_1",
    treatmentId: "trt_1",
    start: at(0, 9, 0),
    end: at(0, 9, 30),
    status: "confirmada",
    notes: "Control de rutina.",
    createdAt: new Date().toISOString(),
  },
  {
    id: "apt_2",
    patientId: "pat_2",
    professionalId: "prof_2",
    treatmentId: "trt_2",
    start: at(0, 11, 0),
    end: at(0, 12, 0),
    status: "programada",
    notes: "",
    createdAt: new Date().toISOString(),
  },
  {
    id: "apt_3",
    patientId: "pat_3",
    professionalId: "prof_2",
    treatmentId: "trt_2",
    start: at(1, 15, 0),
    end: at(1, 16, 0),
    status: "programada",
    notes: "Ajuste de brackets.",
    createdAt: new Date().toISOString(),
  },
  {
    id: "apt_4",
    patientId: "pat_4",
    professionalId: "prof_3",
    treatmentId: "trt_3",
    start: at(2, 10, 0),
    end: at(2, 10, 45),
    status: "programada",
    notes: "",
    createdAt: new Date().toISOString(),
  },
  {
    id: "apt_5",
    patientId: "pat_5",
    professionalId: "prof_1",
    start: at(-1, 16, 0),
    end: at(-1, 16, 30),
    status: "completada",
    notes: "Limpieza dental.",
    createdAt: new Date().toISOString(),
  },
  {
    id: "apt_6",
    patientId: "pat_1",
    professionalId: "prof_3",
    start: at(-2, 9, 30),
    end: at(-2, 10, 0),
    status: "cancelada",
    notes: "Paciente reprogramó.",
    createdAt: new Date().toISOString(),
  },
]
