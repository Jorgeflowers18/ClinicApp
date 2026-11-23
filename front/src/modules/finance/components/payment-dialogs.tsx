import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm } from "react-hook-form"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { getErrorMessage } from "@/shared/lib/error-message"
import { applyServerFieldErrors } from "@/shared/lib/field-issues"
import { formatCurrency } from "@/shared/lib/number"
import { today } from "@/modules/clinical-history/lib/today"

import { useRegisterPayment, useVoidPayment } from "../api/finance.queries"
import {
  paymentMethodLabels,
  paymentMethods,
  paymentSchema,
  voidPaymentSchema,
  type FinancialPayment,
  type PaymentFormValues,
  type VoidPaymentFormValues,
} from "../types/finance.types"

/** Pago de un tratamiento de un paciente: de 0,01 hasta el saldo pendiente, con fecha no futura. */
export function RegisterPaymentDialog({ open, onClose, patientId, treatmentId, treatmentName, pendingBalance }: {
  open: boolean; onClose: () => void; patientId: string; treatmentId: string; treatmentName: string; pendingBalance: number
}) {
  const register = useRegisterPayment()
  const form = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentSchema),
    defaultValues: { patientId, treatmentId, date: today(), amount: pendingBalance, method: "efectivo", reference: "", observations: "" },
  })
  const { errors } = form.formState

  async function save(values: PaymentFormValues) {
    if (values.amount > pendingBalance) {
      form.setError("amount", { message: `No puede superar el saldo pendiente (${formatCurrency(pendingBalance)})` })
      return
    }
    try {
      await register.mutateAsync(values)
      toast.success("Pago registrado")
      onClose()
    } catch (error) {
      // 409 "supera el saldo" en `amount`; 400 en `treatmentId` si el paciente no tiene ese tratamiento.
      applyServerFieldErrors(form, error)
      toast.error(getErrorMessage(error))
    }
  }

  return <Dialog open={open} onOpenChange={(next) => !next && !register.isPending && onClose()}>
    <DialogContent variant="small">
      <DialogHeader>
        <DialogTitle>Registrar pago</DialogTitle>
        <DialogDescription>{treatmentName} · Saldo pendiente: {formatCurrency(pendingBalance)}</DialogDescription>
      </DialogHeader>
      <form id="register-payment-form" data-slot="dialog-body" noValidate onSubmit={form.handleSubmit(save)}>
        <FieldGroup>
          <Field data-invalid={!!errors.date}>
            <FieldLabel htmlFor="payment-date">Fecha</FieldLabel>
            <Input id="payment-date" type="date" max={today()} aria-invalid={!!errors.date} {...form.register("date")} />
            <FieldError errors={errors.date ? [errors.date] : undefined} />
          </Field>
          <Field data-invalid={!!errors.amount}>
            <FieldLabel htmlFor="payment-amount">Monto (USD)</FieldLabel>
            <Input id="payment-amount" type="number" min={0.01} step="0.01" max={pendingBalance} aria-invalid={!!errors.amount} {...form.register("amount")} />
            <FieldError errors={errors.amount ? [errors.amount] : undefined} />
          </Field>
          <Field data-invalid={!!errors.method}>
            <FieldLabel htmlFor="payment-method">Método</FieldLabel>
            <Controller control={form.control} name="method" render={({ field }) => (
              <Select items={paymentMethodLabels} value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="payment-method"><SelectValue /></SelectTrigger>
                <SelectContent>{paymentMethods.map((method) => <SelectItem key={method} value={method}>{paymentMethodLabels[method]}</SelectItem>)}</SelectContent>
              </Select>
            )} />
            <FieldError errors={errors.method ? [errors.method] : undefined} />
          </Field>
          <Field data-invalid={!!errors.reference}>
            <FieldLabel htmlFor="payment-reference">Comprobante (opcional)</FieldLabel>
            <Input id="payment-reference" maxLength={100} aria-invalid={!!errors.reference} {...form.register("reference")} />
            <FieldError errors={errors.reference ? [errors.reference] : undefined} />
          </Field>
          <Field data-invalid={!!errors.observations}>
            <FieldLabel htmlFor="payment-observations">Observaciones (opcional)</FieldLabel>
            <Textarea id="payment-observations" rows={2} maxLength={500} {...form.register("observations")} />
            <FieldError errors={errors.observations ? [errors.observations] : undefined} />
          </Field>
          {errors.treatmentId && <p role="alert" className="text-sm text-destructive">{errors.treatmentId.message}</p>}
        </FieldGroup>
      </form>
      <DialogFooter>
        <Button type="button" variant="outline" disabled={register.isPending} onClick={onClose}>Cancelar</Button>
        <Button type="submit" form="register-payment-form" disabled={register.isPending}>{register.isPending ? "Guardando…" : "Registrar pago"}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
}

/** Anular un pago pide el motivo (3 a 300 caracteres). Un pago anulado no se vuelve a anular. */
export function VoidPaymentDialog({ payment, onClose }: { payment: FinancialPayment | null; onClose: () => void }) {
  const voidPayment = useVoidPayment()
  const form = useForm<VoidPaymentFormValues>({ resolver: zodResolver(voidPaymentSchema), defaultValues: { reason: "" } })
  const { errors } = form.formState

  function close() {
    form.reset({ reason: "" })
    onClose()
  }

  async function save({ reason }: VoidPaymentFormValues) {
    if (!payment) return
    try {
      await voidPayment.mutateAsync({ paymentId: payment.id, reason })
      toast.success("Pago anulado")
      close()
    } catch (error) {
      applyServerFieldErrors(form, error)
      toast.error(getErrorMessage(error))
    }
  }

  return <Dialog open={Boolean(payment)} onOpenChange={(next) => !next && !voidPayment.isPending && close()}>
    <DialogContent variant="small">
      <DialogHeader>
        <DialogTitle>Anular pago</DialogTitle>
        <DialogDescription>{payment && `${formatCurrency(payment.amount)} del ${payment.date}. `}El pago queda registrado como anulado, con su motivo, y deja de contar en el saldo.</DialogDescription>
      </DialogHeader>
      <form id="void-payment-form" data-slot="dialog-body" noValidate onSubmit={form.handleSubmit(save)}>
        <Field data-invalid={!!errors.reason}>
          <FieldLabel htmlFor="void-payment-reason">Motivo</FieldLabel>
          <Textarea id="void-payment-reason" rows={3} maxLength={300} aria-invalid={!!errors.reason} {...form.register("reason")} />
          <FieldError errors={errors.reason ? [errors.reason] : undefined} />
        </Field>
      </form>
      <DialogFooter>
        <Button type="button" variant="outline" disabled={voidPayment.isPending} onClick={close}>Cancelar</Button>
        <Button type="submit" form="void-payment-form" variant="destructive" disabled={voidPayment.isPending}>{voidPayment.isPending ? "Anulando…" : "Anular pago"}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
}
