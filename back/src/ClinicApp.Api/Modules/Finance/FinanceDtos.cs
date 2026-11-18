using System.ComponentModel.DataAnnotations;
using ClinicApp.Api.Common;

namespace ClinicApp.Api.Modules.Finance;

/// <summary>Pago: la forma de <c>FinancialPayment</c> del frontend (finance.types.ts).</summary>
public record FinancialPaymentDto(
    Guid Id, Guid PatientId, Guid TreatmentId, string Date, decimal Amount, string Method, string Reference,
    string RegisteredBy, string Observations, string Status, string? VoidReason)
{
    public static FinancialPaymentDto FromEntity(FinancialPayment payment, string registeredBy) => new(
        payment.Id, payment.PatientId, payment.TreatmentId, payment.Date.ToString(IsoDateAttribute.Format), payment.Amount,
        payment.Method, payment.Reference, registeredBy, payment.Observations, payment.Status, payment.VoidReason);
}

/// <summary>Una fila de la cartera (<c>FinancialPortfolioRow</c>): un paciente + un tratamiento.</summary>
public record FinancialPortfolioRowDto(
    Guid PatientId, string PatientName, Guid TreatmentId, string TreatmentName, decimal Total, decimal Paid, decimal Pending,
    decimal Overdue, string? NextDueDate, int DaysLate, string Status);

/// <summary>
/// Resumen de un tratamiento de un paciente (<c>FinancialSummary</c>). Cuotas, seguro y factura llegan con
/// la etapa B (ítem 8): por ahora vacíos.
/// </summary>
public record FinancialSummaryDto(
    Guid TreatmentId, Guid? PatientId, string TreatmentName, decimal TotalValue, decimal TotalPaid, decimal PendingBalance,
    decimal OverdueBalance, decimal InsuranceCovered, decimal PatientResponsibility, string? NextDueDate,
    List<FinancialPaymentDto> Payments, List<object> Installments, object? Insurance, object? Invoice);

/// <summary>Resumen de un paciente (<c>PatientFinancialSummary</c>).</summary>
public record PatientFinancialSummaryDto(
    Guid PatientId, int TotalTreatments, decimal TotalPaid, decimal TotalPending, decimal TotalOverdue, string? NextDueDate, int PaymentCount);

/// <summary>Registrar un pago.</summary>
public class PaymentRequest
{
    [Required(ErrorMessage = "Selecciona el paciente")]
    public Guid? PatientId { get; set; }

    [Required(ErrorMessage = "Selecciona el tratamiento")]
    public Guid? TreatmentId { get; set; }

    [Required(ErrorMessage = "La fecha es obligatoria")]
    [IsoDate]
    public string Date { get; set; } = "";

    [Range(typeof(decimal), "0.01", "99999999.99", ParseLimitsInInvariantCulture = true, ErrorMessage = "El monto debe ser mayor que 0")]
    public decimal Amount { get; set; }

    [Required(ErrorMessage = "Selecciona el método de pago")]
    [AllowedValues("efectivo", "transferencia", "tarjeta_debito", "tarjeta_credito", "deposito", "cheque", "otros", ErrorMessage = "Método de pago inválido")]
    public string Method { get; set; } = "";

    [MaxLength(100, ErrorMessage = "Máximo 100 caracteres")]
    public string? Reference { get; set; }

    [MaxLength(500, ErrorMessage = "Máximo 500 caracteres")]
    public string? Observations { get; set; }
}

public class VoidPaymentRequest
{
    [Required(ErrorMessage = "Indica el motivo de la anulación")]
    [MinLength(3, ErrorMessage = "Indica el motivo de la anulación")]
    [MaxLength(300, ErrorMessage = "Máximo 300 caracteres")]
    public string Reason { get; set; } = "";
}
