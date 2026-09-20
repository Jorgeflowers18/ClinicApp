import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm } from "react-hook-form"
import { useEffect } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { PageHeader } from "@/shared/components/page-header"
import { getErrorMessage } from "@/shared/lib/error-message"

import { useCreatePatient, usePatient, useUpdatePatient } from "../api/patients.queries"
import {
  genderOptions,
  patientSchema,
  treatmentStatusOptions,
  type PatientFormValues,
} from "../types/patient.types"

export function PatientFormPage() {
  const { id } = useParams<{ id: string }>()
  const isEditMode = Boolean(id)
  const navigate = useNavigate()

  const { data: patient, isLoading: isLoadingPatient } = usePatient(id)
  const createPatient = useCreatePatient()
  const updatePatient = useUpdatePatient(id ?? "")

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(patientSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      documentId: "",
      birthDate: "",
      gender: "femenino",
      phone: "",
      email: "",
      address: "",
      notes: "",
      notificationsEnabled: true,
      medicalHistory: "",
      allergies: "",
      emergencyContactName: "",
      emergencyContactPhone: "",
      insuranceProvider: "",
      insurancePolicy: "",
      consentSigned: false,
      treatmentStatus: "activo",
      lastVisitAt: "",
    },
  })

  useEffect(() => {
    if (!patient) return

    reset({
      firstName: patient.firstName,
      lastName: patient.lastName,
      documentId: patient.documentId,
      birthDate: patient.birthDate,
      gender: patient.gender,
      phone: patient.phone,
      email: patient.email ?? "",
      address: patient.address ?? "",
      notes: patient.notes ?? "",
      notificationsEnabled: patient.notificationsEnabled,
      medicalHistory: patient.medicalHistory ?? "",
      allergies: patient.allergies ?? "",
      emergencyContactName: patient.emergencyContactName ?? "",
      emergencyContactPhone: patient.emergencyContactPhone ?? "",
      insuranceProvider: patient.insuranceProvider ?? "",
      insurancePolicy: patient.insurancePolicy ?? "",
      consentSigned: patient.consentSigned ?? false,
      treatmentStatus: patient.treatmentStatus ?? "activo",
      lastVisitAt: patient.lastVisitAt ?? "",
    })
  }, [patient, reset])

  async function onSubmit(values: PatientFormValues) {
    try {
      if (isEditMode && id) {
        await updatePatient.mutateAsync(values)
        toast.success("Paciente actualizado")
        navigate(`/pacientes/${id}`)
      } else {
        const created = await createPatient.mutateAsync(values)
        toast.success("Paciente creado")
        navigate(`/pacientes/${created.id}`)
      }
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  if (isEditMode && isLoadingPatient) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title={isEditMode ? "Editar paciente" : "Nuevo paciente"}
        description={
          isEditMode
            ? "Actualiza la información del paciente."
            : "Registra un nuevo paciente en el sistema."
        }
      />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 rounded-xl border bg-background p-6">
        <FieldGroup>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field data-invalid={!!errors.firstName}>
              <FieldLabel htmlFor="firstName">Nombres</FieldLabel>
              <Input id="firstName" aria-invalid={!!errors.firstName} {...register("firstName")} />
              <FieldError errors={errors.firstName ? [errors.firstName] : undefined} />
            </Field>

            <Field data-invalid={!!errors.lastName}>
              <FieldLabel htmlFor="lastName">Apellidos</FieldLabel>
              <Input id="lastName" aria-invalid={!!errors.lastName} {...register("lastName")} />
              <FieldError errors={errors.lastName ? [errors.lastName] : undefined} />
            </Field>

            <Field data-invalid={!!errors.documentId}>
              <FieldLabel htmlFor="documentId">Cédula / documento</FieldLabel>
              <Input id="documentId" aria-invalid={!!errors.documentId} {...register("documentId")} />
              <FieldError errors={errors.documentId ? [errors.documentId] : undefined} />
            </Field>

            <Field data-invalid={!!errors.birthDate}>
              <FieldLabel htmlFor="birthDate">Fecha de nacimiento</FieldLabel>
              <Input
                id="birthDate"
                type="date"
                aria-invalid={!!errors.birthDate}
                {...register("birthDate")}
              />
              <FieldError errors={errors.birthDate ? [errors.birthDate] : undefined} />
            </Field>

            <Field data-invalid={!!errors.gender}>
              <FieldLabel htmlFor="gender">Género</FieldLabel>
              <Controller
                control={control}
                name="gender"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="gender" className="w-full" aria-invalid={!!errors.gender}>
                      <SelectValue placeholder="Selecciona..." />
                    </SelectTrigger>
                    <SelectContent>
                      {genderOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <FieldError errors={errors.gender ? [errors.gender] : undefined} />
            </Field>

            <Field data-invalid={!!errors.treatmentStatus}>
              <FieldLabel htmlFor="treatmentStatus">Estado de tratamiento</FieldLabel>
              <Controller
                control={control}
                name="treatmentStatus"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="treatmentStatus" className="w-full" aria-invalid={!!errors.treatmentStatus}>
                      <SelectValue placeholder="Selecciona..." />
                    </SelectTrigger>
                    <SelectContent>
                      {treatmentStatusOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <FieldError errors={errors.treatmentStatus ? [errors.treatmentStatus] : undefined} />
            </Field>

            <Field data-invalid={!!errors.phone}>
              <FieldLabel htmlFor="phone">Teléfono</FieldLabel>
              <Input id="phone" aria-invalid={!!errors.phone} {...register("phone")} />
              <FieldError errors={errors.phone ? [errors.phone] : undefined} />
            </Field>

            <Field data-invalid={!!errors.email}>
              <FieldLabel htmlFor="email">Correo electrónico</FieldLabel>
              <Input id="email" type="email" aria-invalid={!!errors.email} {...register("email")} />
              <FieldError errors={errors.email ? [errors.email] : undefined} />
            </Field>

            <Field data-invalid={!!errors.address}>
              <FieldLabel htmlFor="address">Dirección</FieldLabel>
              <Input id="address" aria-invalid={!!errors.address} {...register("address")} />
              <FieldError errors={errors.address ? [errors.address] : undefined} />
            </Field>

            <Field data-invalid={!!errors.lastVisitAt}>
              <FieldLabel htmlFor="lastVisitAt">Última visita</FieldLabel>
              <Input
                id="lastVisitAt"
                type="date"
                aria-invalid={!!errors.lastVisitAt}
                {...register("lastVisitAt")}
              />
              <FieldError errors={errors.lastVisitAt ? [errors.lastVisitAt] : undefined} />
            </Field>
          </div>

          <Field data-invalid={!!errors.notes}>
            <FieldLabel htmlFor="notes">Notas de atención</FieldLabel>
            <Textarea
              id="notes"
              rows={3}
              placeholder="Observaciones clínicas, preferencias, seguimiento..."
              {...register("notes")}
            />
            <FieldError errors={errors.notes ? [errors.notes] : undefined} />
          </Field>

          <Field data-invalid={!!errors.medicalHistory}>
            <FieldLabel htmlFor="medicalHistory">Antecedentes médicos</FieldLabel>
            <Textarea
              id="medicalHistory"
              rows={3}
              placeholder="Hipertensión, diabetes, cirugías, tratamientos previos..."
              {...register("medicalHistory")}
            />
            <FieldError errors={errors.medicalHistory ? [errors.medicalHistory] : undefined} />
          </Field>

          <Field data-invalid={!!errors.allergies}>
            <FieldLabel htmlFor="allergies">Alergias</FieldLabel>
            <Textarea
              id="allergies"
              rows={2}
              placeholder="Medicamentos, alimentos o materiales a los que es alérgico..."
              {...register("allergies")}
            />
            <FieldError errors={errors.allergies ? [errors.allergies] : undefined} />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field data-invalid={!!errors.emergencyContactName}>
              <FieldLabel htmlFor="emergencyContactName">Contacto de emergencia</FieldLabel>
              <Input
                id="emergencyContactName"
                aria-invalid={!!errors.emergencyContactName}
                {...register("emergencyContactName")}
              />
              <FieldError errors={errors.emergencyContactName ? [errors.emergencyContactName] : undefined} />
            </Field>

            <Field data-invalid={!!errors.emergencyContactPhone}>
              <FieldLabel htmlFor="emergencyContactPhone">Teléfono del contacto</FieldLabel>
              <Input
                id="emergencyContactPhone"
                aria-invalid={!!errors.emergencyContactPhone}
                {...register("emergencyContactPhone")}
              />
              <FieldError errors={errors.emergencyContactPhone ? [errors.emergencyContactPhone] : undefined} />
            </Field>

            <Field data-invalid={!!errors.insuranceProvider}>
              <FieldLabel htmlFor="insuranceProvider">Seguro / convenio</FieldLabel>
              <Input
                id="insuranceProvider"
                aria-invalid={!!errors.insuranceProvider}
                {...register("insuranceProvider")}
              />
              <FieldError errors={errors.insuranceProvider ? [errors.insuranceProvider] : undefined} />
            </Field>

            <Field data-invalid={!!errors.insurancePolicy}>
              <FieldLabel htmlFor="insurancePolicy">Número de póliza</FieldLabel>
              <Input
                id="insurancePolicy"
                aria-invalid={!!errors.insurancePolicy}
                {...register("insurancePolicy")}
              />
              <FieldError errors={errors.insurancePolicy ? [errors.insurancePolicy] : undefined} />
            </Field>
          </div>

          <Field orientation="horizontal">
            <FieldLabel htmlFor="consentSigned" className="flex-1">
              Consentimiento informado firmado
              <FieldDescription>
                Confirma que el paciente ha aceptado los términos del tratamiento y del manejo de su información.
              </FieldDescription>
            </FieldLabel>
            <Controller
              control={control}
              name="consentSigned"
              render={({ field }) => (
                <Switch
                  id="consentSigned"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              )}
            />
          </Field>

          <Field orientation="horizontal">
            <FieldLabel htmlFor="notificationsEnabled" className="flex-1">
              Notificaciones habilitadas
              <FieldDescription>
                El paciente recibirá recordatorios y avisos sobre sus citas. Desactívalo si prefiere no ser
                contactado.
              </FieldDescription>
            </FieldLabel>
            <Controller
              control={control}
              name="notificationsEnabled"
              render={({ field }) => (
                <Switch
                  id="notificationsEnabled"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              )}
            />
          </Field>
        </FieldGroup>

        <div className="flex justify-end gap-2 border-t pt-4">
          <Button type="button" variant="outline" onClick={() => navigate(-1)}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Guardando..." : isEditMode ? "Guardar cambios" : "Crear paciente"}
          </Button>
        </div>
      </form>
    </div>
  )
}
