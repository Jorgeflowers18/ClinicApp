using ClinicApp.Api.Common;
using ClinicApp.Api.Data;
using ClinicApp.Api.Modules.Auth;
using ClinicApp.Api.Modules.Inventory;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ClinicApp.Api.Modules.Treatments;

/// <summary>
/// Tratamientos realizados: /api/treatment-assignments
/// Leer: los tres roles. Registrar: admin y médico (solo se registran desde la historia clínica).
/// </summary>
[ApiController]
[Route("api/treatment-assignments")]
[Authorize(Roles = Roles.Todos)]
public class TreatmentAssignmentsController(AppDbContext db, ClinicClock clock, StockService stock) : ControllerBase
{
    /// <summary>GET /api/treatment-assignments?patientId= → del más reciente al más antiguo.</summary>
    [HttpGet]
    public async Task<ActionResult<List<TreatmentAssignmentDto>>> ListByPatient([FromQuery] Guid? patientId, CancellationToken cancellationToken)
    {
        if (patientId is null)
        {
            ModelState.AddModelError("patientId", "Indica el paciente");
            return this.ValidationError(ModelState);
        }

        var assignments = await db.TreatmentAssignments.AsNoTracking()
            .Where(assignment => assignment.PatientId == patientId)
            .OrderByDescending(assignment => assignment.StartDate)
            .ThenByDescending(assignment => assignment.CreatedAt)
            .ToListAsync(cancellationToken);

        return await TreatmentAssignmentDto.FromEntitiesAsync(assignments, db, cancellationToken);
    }

    /// <summary>
    /// POST /api/treatment-assignments → 201 con el tratamiento realizado (completado, 1 de 1 sesión).
    /// Descuenta los insumos del tratamiento por FEFO; si el stock no alcanza, se registra igual.
    /// Idempotente por sourceKey: si ya existe, 200 con el existente y sin volver a descontar.
    /// </summary>
    [HttpPost]
    [Authorize(Roles = Roles.AdminYMedico)]
    public async Task<ActionResult<TreatmentAssignmentDto>> Create(CreateAssignmentRequest request, CancellationToken cancellationToken)
    {
        var sourceKey = string.IsNullOrWhiteSpace(request.SourceKey) ? null : request.SourceKey.Trim();
        if (!TryParseEncounterId(request.SourceEncounterId, out var encounterId))
        {
            ModelState.AddModelError("sourceEncounterId", "Atención inválida");
            return this.ValidationError(ModelState);
        }

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);

        // Candado por clave: dos reintentos simultáneos de la misma atención se hacen uno detrás del otro,
        // y el segundo encuentra el registro del primero.
        if (sourceKey is not null)
        {
            await db.Database.ExecuteSqlAsync($"SELECT pg_advisory_xact_lock(hashtext({"assignment:" + sourceKey}))", cancellationToken);
            var existing = await db.TreatmentAssignments.AsNoTracking().FirstOrDefaultAsync(entry => entry.SourceKey == sourceKey, cancellationToken);
            if (existing is not null)
            {
                if (existing.PatientId != request.PatientId || existing.TreatmentId != request.TreatmentId)
                {
                    return this.FieldConflict("sourceKey", "Esta atención ya registró ese tratamiento para otro paciente o tratamiento");
                }
                return Ok(await TreatmentAssignmentDto.FromEntityAsync(existing, db, cancellationToken));
            }
        }

        var treatment = await db.Treatments.AsNoTracking()
            .Include(entry => entry.Consumption)
            .FirstOrDefaultAsync(entry => entry.Id == request.TreatmentId, cancellationToken);
        if (treatment is null) return Problem(statusCode: StatusCodes.Status404NotFound, title: "Tratamiento no encontrado");
        if (!treatment.Active) ModelState.AddModelError("treatmentId", "El tratamiento está inactivo");

        var patient = await db.Patients.AsNoTracking()
            .Where(entry => entry.Id == request.PatientId)
            .Select(entry => new { entry.DeletedAt })
            .FirstOrDefaultAsync(cancellationToken);
        if (patient is null) ModelState.AddModelError("patientId", "El paciente no existe");
        else if (patient.DeletedAt is not null) ModelState.AddModelError("patientId", "El paciente está dado de baja");

        var date = Validation.ParseDate(request.Date)!.Value;
        if (date > clock.Today) ModelState.AddModelError("date", "La fecha no puede ser futura");

        if (!ModelState.IsValid) return this.ValidationError(ModelState);

        var assignment = new TreatmentAssignment
        {
            Id = Guid.CreateVersion7(),
            TreatmentId = treatment.Id,
            PatientId = request.PatientId!.Value,
            TotalSessions = 1,
            CompletedSessions = 1,
            Status = AssignmentStatuses.Completado,
            StartDate = date,
            Tooth = request.Tooth?.Trim() ?? "",
            SourceEncounterId = encounterId,
            SourceKey = sourceKey,
            Price = request.Price ?? treatment.Price,
            CreatedAt = clock.UtcNow,
            CreatedByUserId = User.GetUserId(),
        };
        db.TreatmentAssignments.Add(assignment);

        // Insumos: se bloquean las filas (FOR UPDATE) y se descuenta por FEFO. Es tolerante:
        // si falta stock, descuenta lo que hay y deja un aviso en el log.
        if (treatment.Consumption.Count > 0)
        {
            var items = await stock.LockItemsAsync(treatment.Consumption.Select(line => line.ItemId).ToList(), cancellationToken);
            var info = new MovementInfo($"Tratamiento realizado: {treatment.Name}", User.GetUserId(),
                TreatmentAssignmentId: assignment.Id, PatientId: assignment.PatientId);

            foreach (var line in treatment.Consumption)
            {
                var item = items.First(entry => entry.Id == line.ItemId);
                await stock.ConsumeAsync(item, line.Quantity, info, cancellationToken);
            }
        }

        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        return StatusCode(StatusCodes.Status201Created, await TreatmentAssignmentDto.FromEntityAsync(assignment, db, cancellationToken));
    }

    private static bool TryParseEncounterId(string? value, out Guid? id)
    {
        id = null;
        if (string.IsNullOrWhiteSpace(value)) return true;
        if (!Guid.TryParse(value, out var parsed)) return false;
        id = parsed;
        return true;
    }
}
