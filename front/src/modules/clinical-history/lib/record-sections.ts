/** Nombres y orden existentes de las secciones autorizadas de la historia clínica. */
export const recordSections = [
  { value: "datos", label: "Datos del paciente" },
  { value: "antecedentes", label: "Antecedentes" },
  { value: "odontograma", label: "Odontograma y periodontograma" },
  { value: "plan", label: "Plan de tratamiento" },
  { value: "consentimiento", label: "Consentimiento y declaración" },
  { value: "archivos", label: "Fotos y documentos" },
  { value: "atenciones", label: "Atenciones" },
  { value: "tratamientos", label: "Tratamientos" },
  { value: "citas", label: "Citas" },
] as const

export const additionalRecordSections = [
  { value: "evolucion", label: "Evolución periodontal" },
] as const

export type RecordTab = (typeof recordSections)[number]["value"] | (typeof additionalRecordSections)[number]["value"]
