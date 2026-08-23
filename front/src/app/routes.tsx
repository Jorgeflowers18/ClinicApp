import { Route, Routes } from "react-router-dom"

import { ProtectedRoute } from "@/modules/auth/components/protected-route"
import { LoginPage } from "@/modules/auth/pages/login-page"
import { PatientDetailPage } from "@/modules/patients/pages/patient-detail-page"
import { PatientFormPage } from "@/modules/patients/pages/patient-form-page"
import { PatientsListPage } from "@/modules/patients/pages/patients-list-page"
import { AppointmentsCalendarPage } from "@/modules/appointments/pages/appointments-calendar-page"
import { ClinicalHistoryDetailPage } from "@/modules/clinical-history/pages/clinical-history-detail-page"
import { ClinicalHistoryFormPage } from "@/modules/clinical-history/pages/clinical-history-form-page"
import { ClinicalHistoryListPage } from "@/modules/clinical-history/pages/clinical-history-list-page"
import { TreatmentDetailPage } from "@/modules/treatments/pages/treatment-detail-page"
import { TreatmentFormPage } from "@/modules/treatments/pages/treatment-form-page"
import { TreatmentsListPage } from "@/modules/treatments/pages/treatments-list-page"
import { InventoryItemDetailPage } from "@/modules/inventory/pages/inventory-item-detail-page"
import { InventoryItemFormPage } from "@/modules/inventory/pages/inventory-item-form-page"
import { InventoryListPage } from "@/modules/inventory/pages/inventory-list-page"

import { AppLayout } from "./layout/app-layout"
import { DashboardPage } from "./pages/dashboard-page"
import { ForbiddenPage } from "./pages/forbidden-page"
import { NotFoundPage } from "./pages/not-found-page"

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/403" element={<ForbiddenPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<DashboardPage />} />

          <Route path="/pacientes" element={<PatientsListPage />} />
          <Route path="/pacientes/nuevo" element={<PatientFormPage />} />
          <Route path="/pacientes/:id" element={<PatientDetailPage />} />
          <Route path="/pacientes/:id/editar" element={<PatientFormPage />} />

          <Route path="/citas" element={<AppointmentsCalendarPage />} />

          <Route path="/tratamientos" element={<TreatmentsListPage />} />
          <Route path="/tratamientos/nuevo" element={<TreatmentFormPage />} />
          <Route path="/tratamientos/:id" element={<TreatmentDetailPage />} />
          <Route path="/tratamientos/:id/editar" element={<TreatmentFormPage />} />

          <Route element={<ProtectedRoute allowedRoles={["admin", "medico"]} />}>
            <Route path="/historial-clinico" element={<ClinicalHistoryListPage />} />
            <Route path="/historial-clinico/nuevo" element={<ClinicalHistoryFormPage />} />
            <Route path="/historial-clinico/:id" element={<ClinicalHistoryDetailPage />} />
            <Route path="/historial-clinico/:id/editar" element={<ClinicalHistoryFormPage />} />
          </Route>

          <Route element={<ProtectedRoute allowedRoles={["admin", "recepcion"]} />}>
            <Route path="/inventario" element={<InventoryListPage />} />
            <Route path="/inventario/nuevo" element={<InventoryItemFormPage />} />
            <Route path="/inventario/:id" element={<InventoryItemDetailPage />} />
            <Route path="/inventario/:id/editar" element={<InventoryItemFormPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
