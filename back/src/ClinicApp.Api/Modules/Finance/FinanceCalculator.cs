using ClinicApp.Api.Data;
using ClinicApp.Api.Modules.Treatments;
using Microsoft.EntityFrameworkCore;

namespace ClinicApp.Api.Modules.Finance;

/// <summary>Totales de un paciente + un tratamiento.</summary>
public record FinanceTotals(Guid PatientId, Guid TreatmentId, decimal Total, decimal Paid, int Assignments, int Payments)
{
    /// <summary>Lo que falta pagar (nunca negativo).</summary>
    public decimal Pending => Math.Max(Total - Paid, 0);

    /// <summary>Vencido: 0 hasta que existan las cuotas (etapa B).</summary>
    public decimal Overdue => 0;

    /// <summary>al_dia sin saldo; vencida con saldo vencido; parcial en los demás casos.</summary>
    public string Status => Pending == 0 ? "al_dia" : Overdue > 0 ? "vencida" : "parcial";
}

/// <summary>
/// Cálculos de la cartera, agrupados en PostgreSQL (no en memoria):
/// <list type="bullet">
/// <item><b>Total</b> = Σ costo cobrado de las asignaciones (precio del catálogo si falta).</item>
/// <item><b>Pagado</b> = Σ pagos registrados (los anulados no cuentan).</item>
/// <item><b>Pendiente</b> = máx(total − pagado, 0).</item>
/// </list>
/// </summary>
public class FinanceCalculator(AppDbContext db)
{
    public async Task<List<FinanceTotals>> TotalsAsync(Guid? patientId, Guid? treatmentId, CancellationToken cancellationToken)
    {
        var assignments = db.TreatmentAssignments.AsNoTracking();
        if (patientId is not null) assignments = assignments.Where(assignment => assignment.PatientId == patientId);
        if (treatmentId is not null) assignments = assignments.Where(assignment => assignment.TreatmentId == treatmentId);

        var charged = await assignments
            .Join(db.Treatments, assignment => assignment.TreatmentId, treatment => treatment.Id,
                (assignment, treatment) => new { assignment.PatientId, assignment.TreatmentId, Price = assignment.Price ?? treatment.Price })
            .GroupBy(entry => new { entry.PatientId, entry.TreatmentId })
            .Select(group => new { group.Key.PatientId, group.Key.TreatmentId, Total = group.Sum(entry => entry.Price), Count = group.Count() })
            .ToListAsync(cancellationToken);

        var payments = db.FinancialPayments.AsNoTracking().Where(payment => payment.Status == PaymentStatuses.Registrado);
        if (patientId is not null) payments = payments.Where(payment => payment.PatientId == patientId);
        if (treatmentId is not null) payments = payments.Where(payment => payment.TreatmentId == treatmentId);

        var paid = await payments
            .GroupBy(payment => new { payment.PatientId, payment.TreatmentId })
            .Select(group => new { group.Key.PatientId, group.Key.TreatmentId, Paid = group.Sum(payment => payment.Amount), Count = group.Count() })
            .ToDictionaryAsync(entry => (entry.PatientId, entry.TreatmentId), cancellationToken);

        return charged
            .Select(entry =>
            {
                var payment = paid.GetValueOrDefault((entry.PatientId, entry.TreatmentId));
                return new FinanceTotals(entry.PatientId, entry.TreatmentId, entry.Total, payment?.Paid ?? 0, entry.Count, payment?.Count ?? 0);
            })
            .ToList();
    }
}
