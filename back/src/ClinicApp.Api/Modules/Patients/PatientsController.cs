using ClinicApp.Api.Common;
using ClinicApp.Api.Data;
using ClinicApp.Api.Modules.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ClinicApp.Api.Modules.Patients;

/// <summary>
/// Pacientes: /api/patients
///
/// Roles: los tres ven, crean y editan. Dar de baja: admin y recepción. Reactivar: solo admin.
/// El paciente no se borra nunca (baja lógica): tiene citas, tratamientos, historia y pagos.
/// </summary>
[ApiController]
[Route("api/patients")]
[Authorize(Roles = Roles.Todos)]
public class PatientsController(AppDbContext db, ClinicClock clock) : ControllerBase
{
    private const string DuplicateDocument = "Ya existe un paciente con esta cédula";

    /// <summary>
    /// GET /api/patients?page=1&amp;pageSize=10&amp;search=perez&amp;status&amp;gender&amp;registeredFrom&amp;registeredTo&amp;deleted
    /// Sin los dados de baja, de la más reciente a la más antigua. La búsqueda no distingue
    /// mayúsculas ni tildes y mira nombres, apellidos, cédula, teléfono y N.° de historia (HC-000123).
    /// Filtros: <c>status</c> (estado del tratamiento), <c>gender</c>, <c>registeredFrom</c>/<c>registeredTo</c>
    /// (días de la clínica, inclusivos, sobre la fecha de registro) y <c>deleted=true</c> (solo admin): solo los
    /// dados de baja, del más reciente en darse de baja al más antiguo.
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<PagedResult<PatientDto>>> List(
        [FromQuery] PageQuery query,
        [FromQuery] string? status, [FromQuery] string? gender,
        [FromQuery] string? registeredFrom, [FromQuery] string? registeredTo,
        [FromQuery] bool deleted,
        CancellationToken cancellationToken)
    {
        if (deleted && !User.IsInRole(Roles.Admin)) return Forbid();

        if (!string.IsNullOrEmpty(status) && !PatientOptions.TreatmentStatuses.Contains(status))
            ModelState.AddModelError("status", "Estado de tratamiento inválido");
        if (!string.IsNullOrEmpty(gender) && !PatientOptions.Genders.Contains(gender))
            ModelState.AddModelError("gender", "Género inválido");
        var dateAttribute = new IsoDateAttribute();
        if (!dateAttribute.IsValid(registeredFrom)) ModelState.AddModelError("registeredFrom", "Fecha inválida (formato AAAA-MM-DD)");
        if (!dateAttribute.IsValid(registeredTo)) ModelState.AddModelError("registeredTo", "Fecha inválida (formato AAAA-MM-DD)");
        if (!ModelState.IsValid) return this.ValidationError(ModelState);

        var from = Validation.ParseDate(registeredFrom);
        var to = Validation.ParseDate(registeredTo);
        if (from is not null && to is not null && from > to)
            ModelState.AddModelError("registeredTo", "La fecha final no puede ser anterior a la inicial");
        if (!ModelState.IsValid) return this.ValidationError(ModelState);

        var patients = db.Patients.AsNoTracking()
            .Where(patient => deleted ? patient.DeletedAt != null : patient.DeletedAt == null);

        if (!string.IsNullOrEmpty(status)) patients = patients.Where(patient => patient.TreatmentStatus == status);
        if (!string.IsNullOrEmpty(gender)) patients = patients.Where(patient => patient.Gender == gender);
        if (from is { } fromDate)
        {
            var start = clock.ToUtc(fromDate, TimeOnly.MinValue);
            patients = patients.Where(patient => patient.CreatedAt >= start);
        }
        if (to is { } toDate)
        {
            var end = clock.ToUtc(toDate.AddDays(1), TimeOnly.MinValue);
            patients = patients.Where(patient => patient.CreatedAt < end);
        }

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var pattern = TextSearch.ContainsPattern(query.Search);
            var recordNumber = PatientOptions.ParseRecordNumber(query.Search);

            patients = patients.Where(patient =>
                EF.Functions.ILike(TextSearch.Unaccent(patient.FirstName + " " + patient.LastName), TextSearch.Unaccent(pattern))
                || EF.Functions.ILike(TextSearch.Unaccent(patient.LastName + " " + patient.FirstName), TextSearch.Unaccent(pattern))
                || EF.Functions.ILike(patient.DocumentId, pattern)
                || EF.Functions.ILike(patient.Phone, pattern)
                || (recordNumber != null && patient.RecordNumber == recordNumber));
        }

        var ordered = deleted
            ? patients.OrderByDescending(patient => patient.DeletedAt).ThenByDescending(patient => patient.Id)
            : patients.OrderByDescending(patient => patient.CreatedAt).ThenByDescending(patient => patient.Id);
        var page = await ordered.ToPagedResultAsync(query, cancellationToken);

        return new PagedResult<PatientDto>(
            page.Items.Select(PatientDto.FromEntity).ToList(), page.Page, page.PageSize, page.TotalItems, page.TotalPages);
    }

    /// <summary>GET /api/patients/{id}. También devuelve a los dados de baja (con deletedAt).</summary>
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<PatientDto>> Get(Guid id, CancellationToken cancellationToken)
    {
        var patient = await db.Patients.AsNoTracking().FirstOrDefaultAsync(entry => entry.Id == id, cancellationToken);
        return patient is null ? PatientNotFound() : PatientDto.FromEntity(patient);
    }

    /// <summary>POST /api/patients → 201. El servidor asigna el N.° de historia clínica.</summary>
    [HttpPost]
    public async Task<ActionResult<PatientDto>> Create(PatientRequest request, CancellationToken cancellationToken)
    {
        if (!ValidateDates(request)) return this.ValidationError(ModelState);

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        if (await DocumentInUseAsync(request.DocumentId, exceptId: null, cancellationToken))
        {
            return this.FieldConflict("documentId", DuplicateDocument);
        }

        var patient = new Patient
        {
            Id = Guid.CreateVersion7(),
            CreatedAt = clock.UtcNow,
            CreatedByUserId = User.GetUserId(),
        };
        request.ApplyTo(patient);

        db.Patients.Add(patient);
        await db.SaveChangesAsync(cancellationToken); // aquí PostgreSQL asigna record_number
        await transaction.CommitAsync(cancellationToken);

        return CreatedAtAction(nameof(Get), new { id = patient.Id }, PatientDto.FromEntity(patient));
    }

    /// <summary>PUT /api/patients/{id}. El N.° de historia clínica no cambia aunque se envíe.</summary>
    [HttpPut("{id:guid}")]
    public async Task<ActionResult<PatientDto>> Update(Guid id, PatientRequest request, CancellationToken cancellationToken)
    {
        if (!ValidateDates(request)) return this.ValidationError(ModelState);

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        var patient = await db.Patients.FirstOrDefaultAsync(entry => entry.Id == id, cancellationToken);
        if (patient is null) return PatientNotFound();

        if (!patient.IsActive)
        {
            return Problem(statusCode: StatusCodes.Status409Conflict, title: "Reactiva al paciente antes de editarlo");
        }

        // Solo se revisa si la cédula cambió: así se pueden editar otros datos de un paciente importado
        // que comparte cédula con otro (datos antiguos).
        if (!string.Equals(patient.DocumentId, request.DocumentId.Trim(), StringComparison.Ordinal)
            && await DocumentInUseAsync(request.DocumentId, exceptId: id, cancellationToken))
        {
            return this.FieldConflict("documentId", DuplicateDocument);
        }

        request.ApplyTo(patient);
        patient.UpdatedAt = clock.UtcNow;
        patient.UpdatedByUserId = User.GetUserId();

        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        return PatientDto.FromEntity(patient);
    }

    /// <summary>DELETE /api/patients/{id} → 204. Baja lógica; repetirla no hace nada.</summary>
    [HttpDelete("{id:guid}")]
    [Authorize(Roles = Roles.AdminYRecepcion)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var patient = await db.Patients.FirstOrDefaultAsync(entry => entry.Id == id, cancellationToken);
        if (patient is null) return PatientNotFound();

        if (patient.IsActive)
        {
            patient.DeletedAt = clock.UtcNow;
            patient.DeletedByUserId = User.GetUserId();
            await db.SaveChangesAsync(cancellationToken);
        }

        return NoContent();
    }

    /// <summary>POST /api/patients/{id}/restore → reactiva a un paciente dado de baja. Solo admin.</summary>
    [HttpPost("{id:guid}/restore")]
    [Authorize(Roles = Roles.Admin)]
    public async Task<ActionResult<PatientDto>> Restore(Guid id, CancellationToken cancellationToken)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        var patient = await db.Patients.FirstOrDefaultAsync(entry => entry.Id == id, cancellationToken);
        if (patient is null) return PatientNotFound();

        if (!patient.IsActive)
        {
            if (await DocumentInUseAsync(patient.DocumentId, exceptId: id, cancellationToken))
            {
                return this.FieldConflict("documentId", "Otro paciente activo ya usa esta cédula");
            }

            patient.DeletedAt = null;
            patient.DeletedByUserId = null;
            patient.UpdatedAt = clock.UtcNow;
            patient.UpdatedByUserId = User.GetUserId();
            await db.SaveChangesAsync(cancellationToken);
        }

        await transaction.CommitAsync(cancellationToken);
        return PatientDto.FromEntity(patient);
    }

    /// <summary>
    /// ¿Otro paciente activo usa esta cédula? Toma un candado de PostgreSQL por cédula hasta el final de la
    /// transacción: así dos altas simultáneas con la misma cédula no pasan las dos.
    /// </summary>
    private async Task<bool> DocumentInUseAsync(string documentId, Guid? exceptId, CancellationToken cancellationToken)
    {
        var document = documentId.Trim();
        await db.Database.ExecuteSqlAsync($"SELECT pg_advisory_xact_lock(hashtext({"patient-document:" + document}))", cancellationToken);

        return await db.Patients.AnyAsync(
            patient => patient.DeletedAt == null && patient.DocumentId == document && patient.Id != exceptId,
            cancellationToken);
    }

    private bool ValidateDates(PatientRequest request)
    {
        foreach (var (field, message) in request.ValidateDates(clock.Today).Concat(request.ValidateRules()))
        {
            ModelState.AddModelError(field, message);
        }
        return ModelState.IsValid;
    }

    private ObjectResult PatientNotFound() =>
        Problem(statusCode: StatusCodes.Status404NotFound, title: "Paciente no encontrado");
}
