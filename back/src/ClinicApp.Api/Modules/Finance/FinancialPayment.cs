using ClinicApp.Api.Modules.Auth;
using ClinicApp.Api.Modules.Patients;
using ClinicApp.Api.Modules.Treatments;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ClinicApp.Api.Modules.Finance;

/// <summary>
/// Pago de un paciente por un tratamiento. Tabla <c>financial_payments</c>.
/// Un pago no se borra: se anula (con motivo) y deja de contar.
///
/// Son los pagos de los <b>pacientes a la clínica</b>; el cobro a las clínicas por usar ClinicApp es otra cosa
/// y no existe todavía.
/// </summary>
public class FinancialPayment
{
    public Guid Id { get; set; }
    public Guid PatientId { get; set; }
    public Guid TreatmentId { get; set; }
    public DateOnly Date { get; set; }
    public decimal Amount { get; set; }
    public string Method { get; set; } = "";
    public string Reference { get; set; } = "";
    public string Observations { get; set; } = "";
    public string Status { get; set; } = PaymentStatuses.Registrado;
    public string? VoidReason { get; set; }
    public Guid? RegisteredByUserId { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? VoidedAt { get; set; }
    public Guid? VoidedByUserId { get; set; }
}

public static class PaymentMethods
{
    public static readonly string[] All = ["efectivo", "transferencia", "tarjeta_debito", "tarjeta_credito", "deposito", "cheque", "otros"];
}

public static class PaymentStatuses
{
    public const string Registrado = "registrado";
    public const string Anulado = "anulado";
    public const string Reversado = "reversado";
}

public class FinancialPaymentConfiguration : IEntityTypeConfiguration<FinancialPayment>
{
    public void Configure(EntityTypeBuilder<FinancialPayment> builder)
    {
        builder.ToTable("financial_payments", table =>
        {
            table.HasCheckConstraint("ck_financial_payments_amount", "amount > 0");
            table.HasCheckConstraint("ck_financial_payments_method",
                "method IN ('efectivo', 'transferencia', 'tarjeta_debito', 'tarjeta_credito', 'deposito', 'cheque', 'otros')");
            table.HasCheckConstraint("ck_financial_payments_status", "status IN ('registrado', 'anulado', 'reversado')");
        });

        builder.Property(payment => payment.Amount).HasPrecision(10, 2);
        builder.Property(payment => payment.Method).HasMaxLength(20);
        builder.Property(payment => payment.Reference).HasMaxLength(100);
        builder.Property(payment => payment.Observations).HasMaxLength(500);
        builder.Property(payment => payment.Status).HasMaxLength(10);
        builder.Property(payment => payment.VoidReason).HasMaxLength(300);

        builder.HasOne<Patient>().WithMany().HasForeignKey(payment => payment.PatientId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<Treatment>().WithMany().HasForeignKey(payment => payment.TreatmentId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<User>().WithMany().HasForeignKey(payment => payment.RegisteredByUserId).OnDelete(DeleteBehavior.SetNull);
        builder.HasOne<User>().WithMany().HasForeignKey(payment => payment.VoidedByUserId).OnDelete(DeleteBehavior.SetNull);

        builder.HasIndex(payment => new { payment.PatientId, payment.TreatmentId });
        builder.HasIndex(payment => payment.Date);
    }
}
