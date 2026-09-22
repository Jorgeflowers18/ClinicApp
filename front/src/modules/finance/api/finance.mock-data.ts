import { mockPatients } from "@/modules/patients/api/patients.mock-data"
import { mockTreatments, mockTreatmentAssignments } from "@/modules/treatments/api/treatments.mock-data"

import type {
  FinancialPayment,
  FinancialPortfolioRow,
  FinancialSummary,
  Installment,
  InsuranceCoverage,
  Invoice,
  PatientFinancialSummary,
} from "../types/finance.types"

export const mockFinancialPayments: FinancialPayment[] = [
  {
    id: "pay_1",
    patientId: "pat_5",
    treatmentId: "trt_4",
    date: "2026-09-02",
    amount: 20,
    method: "transferencia",
    reference: "TR-2026-001",
    registeredBy: "admin",
    observations: "Primer abono del tratamiento.",
    status: "registrado",
  },
  {
    id: "pay_2",
    patientId: "pat_4",
    treatmentId: "trt_3",
    date: "2026-09-04",
    amount: 50,
    method: "tarjeta_credito",
    reference: "TC-8791",
    registeredBy: "recepcion",
    observations: "Pago parcial autorizado.",
    status: "registrado",
  },
  {
    id: "pay_3",
    patientId: "pat_3",
    treatmentId: "trt_2",
    date: "2026-09-06",
    amount: 15,
    method: "efectivo",
    reference: "EFE-15",
    registeredBy: "medico",
    observations: "Cuota inicial de ortodoncia.",
    status: "registrado",
  },
  {
    id: "pay_4",
    patientId: "pat_1",
    treatmentId: "trt_1",
    date: "2026-09-09",
    amount: 35,
    method: "deposito",
    reference: "DEP-20260909",
    registeredBy: "admin",
    observations: "Pago total por limpieza dental.",
    status: "registrado",
  },
]

export const mockInstallments: Installment[] = [
  {
    id: "ins_1",
    patientId: "pat_4",
    treatmentId: "trt_3",
    number: 1,
    dueDate: "2026-10-05",
    amount: 40,
    paid: 20,
    balance: 20,
    paymentDate: "2026-09-04",
    status: "parcial",
    daysLate: 0,
  },
  {
    id: "ins_2",
    patientId: "pat_4",
    treatmentId: "trt_3",
    number: 2,
    dueDate: "2026-10-19",
    amount: 40,
    paid: 0,
    balance: 40,
    status: "pendiente",
    daysLate: 0,
  },
  {
    id: "ins_3",
    patientId: "pat_5",
    treatmentId: "trt_4",
    number: 1,
    dueDate: "2026-09-15",
    amount: 25,
    paid: 0,
    balance: 25,
    status: "vencida",
    daysLate: 6,
  },
]

export const mockInsuranceCoverage: InsuranceCoverage[] = [
  {
    id: "ins_cov_1",
    patientId: "pat_5",
    treatmentId: "trt_4",
    insurer: "Claro Salud",
    policyNumber: "CS-4400",
    authorizationNumber: "AUT-1088",
    coveragePercent: 60,
    coveredValue: 33,
    copay: 22,
    deductible: 0,
    outstandingInsurance: 13,
    outstandingPatient: 22,
  },
  {
    id: "ins_cov_2",
    patientId: "pat_3",
    treatmentId: "trt_2",
    insurer: "Mutualista",
    policyNumber: "MUT-5521",
    authorizationNumber: "AUT-7741",
    coveragePercent: 25,
    coveredValue: 10,
    copay: 30,
    deductible: 0,
    outstandingInsurance: 0,
    outstandingPatient: 30,
  },
]

export const mockInvoices: Invoice[] = [
  {
    id: "inv_doc_1",
    patientId: "pat_4",
    treatmentId: "trt_3",
    number: "001-001-000123",
    establishment: "001",
    emissionPoint: "001",
    sequence: "000123",
    issueDate: "2026-09-06",
    accessKey: "1209202609000000000000000000000000000000000000",
    subtotal: 120,
    tax: 12,
    discount: 0,
    total: 132,
    status: "autorizada",
    authorizationNumber: "1234567890",
    authorizedAt: "2026-09-06T12:00:00.000Z",
    xml: "<xml>factura</xml>",
    authorizedXml: "<xml>autorizado</xml>",
    ride: "ride-123.png",
  },
]

export function getTreatmentFinancialSummary(treatmentId: string, patientId?: string): FinancialSummary {
  const treatment = mockTreatments.find((item) => item.id === treatmentId)
  if (!treatment) {
    throw new Error("Tratamiento no encontrado")
  }

  const resolvedPatientId = patientId ?? mockTreatmentAssignments.find((assignment) => assignment.treatmentId === treatmentId)?.patientId ?? mockPatients[0]?.id ?? ""
  const payments = mockFinancialPayments.filter((payment) => payment.treatmentId === treatmentId && payment.patientId === resolvedPatientId)
  const installments = mockInstallments.filter((item) => item.treatmentId === treatmentId && item.patientId === resolvedPatientId)
  const insurance = mockInsuranceCoverage.find((item) => item.treatmentId === treatmentId && item.patientId === resolvedPatientId) ?? null
  const invoice = mockInvoices.find((item) => item.treatmentId === treatmentId && item.patientId === resolvedPatientId) ?? null
  const totalPaid = payments.reduce((sum, payment) => sum + payment.amount, 0)
  const insuranceCovered = insurance?.coveredValue ?? 0
  const patientResponsibility = Math.max(treatment.price - insuranceCovered, 0)
  const pendingBalance = Math.max(treatment.price - totalPaid, 0)
  const overdueBalance = installments.reduce((sum, installment) => sum + (installment.status === "vencida" ? installment.balance : 0), 0)
  const nextDueDate = installments
    .filter((installment) => installment.status !== "pagada" && installment.status !== "cancelada")
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0]?.dueDate ?? null

  return {
    treatmentId: treatment.id,
    patientId: resolvedPatientId,
    treatmentName: treatment.name,
    totalValue: treatment.price,
    totalPaid,
    pendingBalance,
    overdueBalance,
    insuranceCovered,
    patientResponsibility,
    nextDueDate,
    payments,
    installments,
    insurance,
    invoice,
  }
}

export function getPatientFinancialSummary(patientId: string): PatientFinancialSummary {
  const assignments = mockTreatmentAssignments.filter((assignment) => assignment.patientId === patientId)
  const patientTreatments = assignments.map((assignment) => {
    const summary = getTreatmentFinancialSummary(assignment.treatmentId, patientId)
    return summary
  })

  const totalTreatments = patientTreatments.length
  const totalPaid = patientTreatments.reduce((sum, item) => sum + item.totalPaid, 0)
  const totalPending = patientTreatments.reduce((sum, item) => sum + item.pendingBalance, 0)
  const totalOverdue = patientTreatments.reduce((sum, item) => sum + item.overdueBalance, 0)
  const nextDueDate = patientTreatments
    .map((item) => item.nextDueDate)
    .filter((value): value is string => Boolean(value))
    .sort()[0] ?? null

  return {
    patientId,
    totalTreatments,
    totalPaid,
    totalPending,
    totalOverdue,
    nextDueDate,
    paymentCount: patientTreatments.reduce((sum, item) => sum + item.payments.length, 0),
  }
}

export const mockPortfolioRows: FinancialPortfolioRow[] = mockTreatments.flatMap((treatment) => {
  const assignment = mockTreatmentAssignments.find((item) => item.treatmentId === treatment.id)
  if (!assignment) return []
  const patient = mockPatients.find((item) => item.id === assignment.patientId)
  if (!patient) return []
  const summary = getTreatmentFinancialSummary(treatment.id, assignment.patientId)
  const daysLate = summary.installments.reduce((max, installment) => Math.max(max, installment.daysLate), 0)
  const status = summary.pendingBalance > 0 ? (summary.overdueBalance > 0 ? "vencida" : "parcial") : "al_dia"

  return [{
    patientId: assignment.patientId,
    patientName: `${patient.firstName} ${patient.lastName}`,
    treatmentId: treatment.id,
    treatmentName: treatment.name,
    total: summary.totalValue,
    paid: summary.totalPaid,
    pending: summary.pendingBalance,
    overdue: summary.overdueBalance,
    nextDueDate: summary.nextDueDate,
    daysLate,
    status,
  }]
})
