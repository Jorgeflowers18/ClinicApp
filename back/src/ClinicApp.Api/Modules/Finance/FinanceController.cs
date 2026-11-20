using ClinicApp.Api.Common;
using ClinicApp.Api.Data;
using ClinicApp.Api.Modules.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ClinicApp.Api.Modules.Finance;

/// <summary>
/// Cartera, resúmenes y pagos: /api/finance. Solo admin y recepción: el médico no ve montos (decisión F5).
/// </summary>
[ApiController]
[Route("api/finance")]
[Authorize(Roles = Roles.AdminYRecepcion)]
public class FinanceController(AppDbContext db, ClinicClock clock, FinanceCalculator calculator) : ControllerBase
{
    /// <summary>
    /// GET /api/finance/portfolio → una fila por paciente + tratamiento, de la mayor deuda a la menor
    /// (también las que están al día, como en el mock).
    /// </summary>
    [HttpGet("portfolio")]
    public async Task<List<FinancialPortfolioRowDto>> Portfolio(CancellationToken cancellationToken)
    {
        var totals = await calculator.TotalsAsync(patientId: null, treatmentId: null, cancellationToken);
        var patientIds = totals.Select(entry => entry.PatientId).Distinct().ToList();
        var treatmentIds = totals.Select(entry => entry.TreatmentId).Distinct().ToList();

        var patients = await db.Patients.AsNoTracking().Where(patient => patientIds.Contains(patient.Id))
            .ToDictionaryAsync(patient => patient.Id, patient => $"{patient.FirstName} {patient.LastName}".Trim(), cancellationToken);
        var treatments = await db.Treatments.AsNoTracking().Where(treatment => treatmentIds.Contains(treatment.Id))
            .ToDictionaryAsync(treatment => treatment.Id, treatment => treatment.Name, cancellationToken);

        return totals
            .Select(entry => new FinancialPortfolioRowDto(
                entry.PatientId, patients.GetValueOrDefault(entry.PatientId, ""), entry.TreatmentId, treatments.GetValueOrDefault(entry.TreatmentId, ""),
                entry.Total, entry.Paid, entry.Pending, entry.Overdue, NextDueDate: null, DaysLate: 0, entry.Status))
            .OrderByDescending(row => row.Pending)
            .ThenBy(row => row.PatientName)
            .ThenBy(row => row.TreatmentName)
            .ToList();
    }

    /// <summary>
    /// GET /api/finance/treatments/{treatmentId}/summary?patientId= → resumen de un tratamiento de un paciente.
    /// Sin patientId: si lo recibió un solo paciente se usa ese; si lo recibieron varios, 400.
    /// </summary>
    [HttpGet("treatments/{treatmentId:guid}/summary")]
    public async Task<ActionResult<FinancialSummaryDto>> TreatmentSummary(Guid treatmentId, [FromQuery] Guid? patientId, CancellationToken cancellationToken)
    {
        var treatment = await db.Treatments.AsNoTracking().FirstOrDefaultAsync(entry => entry.Id == treatmentId, cancellationToken);
        if (treatment is null) return Problem(statusCode: StatusCodes.Status404NotFound, title: "Tratamiento no encontrado");

        if (patientId is not null && !await db.Patients.AnyAsync(patient => patient.Id == patientId, cancellationToken))
            return Problem(statusCode: StatusCodes.Status404NotFound, title: "Paciente no encontrado");

        var totals = await calculator.TotalsAsync(patientId, treatmentId, cancellationToken);
        if (patientId is null && totals.Count > 1)
        {
            ModelState.AddModelError("patientId", "Varios pacientes recibieron este tratamiento: indica el paciente");
            return this.ValidationError(ModelState);
        }

        var entry = totals.FirstOrDefault();
        var resolvedPatient = patientId ?? entry?.PatientId;
        var payments = resolvedPatient is null ? [] : await PaymentsAsync(resolvedPatient.Value, treatmentId, cancellationToken);
        var total = entry?.Total ?? 0;
        var paid = entry?.Paid ?? 0;

        return new FinancialSummaryDto(
            treatmentId, resolvedPatient, treatment.Name, total, paid, entry?.Pending ?? 0, OverdueBalance: 0,
            InsuranceCovered: 0, PatientResponsibility: total, NextDueDate: null, payments, Installments: [], Insurance: null, Invoice: null);
    }

    /// <summary>GET /api/finance/patients/{patientId}/summary → totales de todos los tratamientos del paciente.</summary>
    [HttpGet("patients/{patientId:guid}/summary")]
    public async Task<ActionResult<PatientFinancialSummaryDto>> PatientSummary(Guid patientId, CancellationToken cancellationToken)
    {
        if (!await db.Patients.AnyAsync(patient => patient.Id == patientId, cancellationToken))
            return Problem(statusCode: StatusCodes.Status404NotFound, title: "Paciente no encontrado");

        var totals = await calculator.TotalsAsync(patientId, treatmentId: null, cancellationToken);
        return new PatientFinancialSummaryDto(
            patientId,
            totals.Sum(entry => entry.Assignments),
            totals.Sum(entry => entry.Paid),
            totals.Sum(entry => entry.Pending),
            totals.Sum(entry => entry.Overdue),
            NextDueDate: null,
            totals.Sum(entry => entry.Payments));
    }

    /// <summary>
    /// POST /api/finance/payments → 201. El paciente debe haber recibido el tratamiento, y el monto no puede
    /// superar lo pendiente (409). Un candado por paciente + tratamiento evita que dos pagos simultáneos
    /// pasen los dos el control del saldo.
    /// </summary>
    [HttpPost("payments")]
    public async Task<ActionResult<FinancialPaymentDto>> RegisterPayment(PaymentRequest request, CancellationToken cancellationToken)
    {
        var date = Validation.ParseDate(request.Date)!.Value;
        if (date > clock.Today) ModelState.AddModelError("date", "La fecha no puede ser futura");
        if (!ModelState.IsValid) return this.ValidationError(ModelState);

        var patientId = request.PatientId!.Value;
        var treatmentId = request.TreatmentId!.Value;

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        await db.Database.ExecuteSqlAsync($"SELECT pg_advisory_xact_lock(hashtext({$"payment:{patientId}:{treatmentId}"}))", cancellationToken);

        var totals = (await calculator.TotalsAsync(patientId, treatmentId, cancellationToken)).FirstOrDefault();
        if (totals is null)
        {
            ModelState.AddModelError("treatmentId", "El paciente no tiene este tratamiento realizado");
            return this.ValidationError(ModelState);
        }

        if (request.Amount > totals.Pending)
        {
            return this.FieldConflict("amount", $"El pago supera el saldo pendiente ({totals.Pending:0.00})");
        }

        var payment = new FinancialPayment
        {
            Id = Guid.CreateVersion7(),
            PatientId = patientId,
            TreatmentId = treatmentId,
            Date = date,
            Amount = request.Amount,
            Method = request.Method,
            Reference = Validation.Clean(request.Reference),
            Observations = Validation.Clean(request.Observations),
            Status = PaymentStatuses.Registrado,
            RegisteredByUserId = User.GetUserId(),
            CreatedAt = clock.UtcNow,
        };
        db.FinancialPayments.Add(payment);
        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        return StatusCode(StatusCodes.Status201Created, FinancialPaymentDto.FromEntity(payment, await UserNameAsync(payment.RegisteredByUserId, cancellationToken)));
    }

    /// <summary>POST /api/finance/payments/{id}/void { reason } → 200. El pago queda anulado y deja de contar.</summary>
    [HttpPost("payments/{id:guid}/void")]
    public async Task<ActionResult<FinancialPaymentDto>> VoidPayment(Guid id, VoidPaymentRequest request, CancellationToken cancellationToken)
    {
        var payment = await db.FinancialPayments.FirstOrDefaultAsync(entry => entry.Id == id, cancellationToken);
        if (payment is null) return Problem(statusCode: StatusCodes.Status404NotFound, title: "Pago no encontrado");
        if (payment.Status != PaymentStatuses.Registrado) return Problem(statusCode: StatusCodes.Status409Conflict, title: "El pago ya está anulado");

        payment.Status = PaymentStatuses.Anulado;
        payment.VoidReason = request.Reason.Trim();
        payment.VoidedAt = clock.UtcNow;
        payment.VoidedByUserId = User.GetUserId();
        await db.SaveChangesAsync(cancellationToken);

        return FinancialPaymentDto.FromEntity(payment, await UserNameAsync(payment.RegisteredByUserId, cancellationToken));
    }

    private async Task<List<FinancialPaymentDto>> PaymentsAsync(Guid patientId, Guid treatmentId, CancellationToken cancellationToken)
    {
        var payments = await db.FinancialPayments.AsNoTracking()
            .Where(payment => payment.PatientId == patientId && payment.TreatmentId == treatmentId)
            .OrderByDescending(payment => payment.Date).ThenByDescending(payment => payment.CreatedAt)
            .ToListAsync(cancellationToken);
        var userIds = payments.Select(payment => payment.RegisteredByUserId).OfType<Guid>().Distinct().ToList();
        var names = await db.Users.AsNoTracking().Where(user => userIds.Contains(user.Id))
            .ToDictionaryAsync(user => user.Id, user => user.Name, cancellationToken);

        return payments.Select(payment => FinancialPaymentDto.FromEntity(payment,
            payment.RegisteredByUserId is { } userId ? names.GetValueOrDefault(userId, "") : "")).ToList();
    }

    private async Task<string> UserNameAsync(Guid? userId, CancellationToken cancellationToken) =>
        userId is null ? "" : await db.Users.Where(user => user.Id == userId).Select(user => user.Name).FirstOrDefaultAsync(cancellationToken) ?? "";
}
