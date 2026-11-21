using ClinicApp.Api.Common;
using ClinicApp.Api.Data;
using ClinicApp.Api.Modules.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ClinicApp.Api.Modules.Appointments;

/// <summary>
/// Agenda: /api/appointments. Los tres roles.
///
/// El frontend envía la fecha y las horas en hora de la clínica (date + startTime + endTime); la API
/// las convierte a UTC con ClinicClock y devuelve start/end en ISO UTC.
/// </summary>
[ApiController]
[Route("api/appointments")]
[Authorize(Roles = Roles.Todos)]
public class AppointmentsController(
    AppDbContext db, ClinicClock clock, AvailabilityService availability, IAppointmentEvents events) : ControllerBase
{
    /// <summary>
    /// GET /api/appointments?from=YYYY-MM-DD&amp;to=YYYY-MM-DD&amp;patientId=&amp;professionalId=
    /// Sin from/to devuelve todas (es lo que pide hoy el frontend). Ordenadas por inicio;
    /// con patientId, de la más reciente a la más antigua (pestaña "Citas" de la historia clínica).
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<List<AppointmentDto>>> List(
        [FromQuery] string? from, [FromQuery] string? to, [FromQuery] Guid? patientId, [FromQuery] Guid? professionalId,
        CancellationToken cancellationToken)
    {
        if (!TryParseRange(from, to, out var range)) return this.ValidationError(ModelState);

        var appointments = db.Appointments.AsNoTracking();
        if (range is { } period)
        {
            var (start, end) = period;
            appointments = appointments.Where(appointment => appointment.Start >= start && appointment.Start < end);
        }
        if (patientId is not null) appointments = appointments.Where(appointment => appointment.PatientId == patientId);
        if (professionalId is not null) appointments = appointments.Where(appointment => appointment.ProfessionalId == professionalId);

        var ordered = patientId is not null
            ? appointments.OrderByDescending(appointment => appointment.Start).ThenByDescending(appointment => appointment.Id)
            : appointments.OrderBy(appointment => appointment.Start).ThenBy(appointment => appointment.Id);

        var list = await ordered.ToListAsync(cancellationToken);
        var names = await PatientNamesAsync(list.Select(appointment => appointment.PatientId), cancellationToken);
        return list.Select(appointment => AppointmentDto.FromEntity(appointment, names.GetValueOrDefault(appointment.PatientId, ""))).ToList();
    }

    /// <summary>GET /api/appointments/{id}</summary>
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<AppointmentDto>> Get(Guid id, CancellationToken cancellationToken)
    {
        var appointment = await db.Appointments.AsNoTracking().FirstOrDefaultAsync(entry => entry.Id == id, cancellationToken);
        return appointment is null ? AppointmentNotFound() : await ToDtoAsync(appointment, cancellationToken);
    }

    /// <summary>POST /api/appointments → 201 (programada). 409 si el horario choca.</summary>
    [HttpPost]
    public async Task<ActionResult<AppointmentDto>> Create(AppointmentRequest request, CancellationToken cancellationToken)
    {
        var values = await ValidateAsync(request, current: null, cancellationToken);
        if (values is null) return this.ValidationError(ModelState);

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        await availability.LockAsync(values.ProfessionalId, values.RoomId, cancellationToken);

        var conflict = await availability.FindAppointmentConflictAsync(
            values.ProfessionalId, values.RoomId, values.Start, values.End, excludeAppointmentId: null, cancellationToken);
        if (conflict is not null) return this.FieldConflict("startTime", conflict);

        var appointment = new Appointment
        {
            Id = Guid.CreateVersion7(),
            Status = AppointmentStatuses.Programada,
            CreatedAt = clock.UtcNow,
            CreatedByUserId = User.GetUserId(),
        };
        values.ApplyTo(appointment);
        db.Appointments.Add(appointment);

        await events.AppointmentCreatedAsync(appointment, cancellationToken);
        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        return CreatedAtAction(nameof(Get), new { id = appointment.Id }, await ToDtoAsync(appointment, cancellationToken));
    }

    /// <summary>PUT /api/appointments/{id}. Solo citas programadas o confirmadas; no choca consigo misma.</summary>
    [HttpPut("{id:guid}")]
    public async Task<ActionResult<AppointmentDto>> Update(Guid id, AppointmentRequest request, CancellationToken cancellationToken)
    {
        var existing = await db.Appointments.AsNoTracking().FirstOrDefaultAsync(entry => entry.Id == id, cancellationToken);
        if (existing is null) return AppointmentNotFound();
        if (!AppointmentStatuses.IsEditable(existing.Status)) return NotEditable();

        var values = await ValidateAsync(request, existing, cancellationToken);
        if (values is null) return this.ValidationError(ModelState);

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        // Se bloquea la agenda a la que se mueve la cita (profesional y consultorio nuevos): es donde
        // podría chocar con otra cita que se esté agendando al mismo tiempo.
        await availability.LockAsync(values.ProfessionalId, values.RoomId, cancellationToken);

        var appointment = await db.Appointments.FirstOrDefaultAsync(entry => entry.Id == id, cancellationToken);
        if (appointment is null) return AppointmentNotFound();
        if (!AppointmentStatuses.IsEditable(appointment.Status)) return NotEditable();

        var conflict = await availability.FindAppointmentConflictAsync(
            values.ProfessionalId, values.RoomId, values.Start, values.End, excludeAppointmentId: id, cancellationToken);
        if (conflict is not null) return this.FieldConflict("startTime", conflict);

        values.ApplyTo(appointment);
        appointment.UpdatedAt = clock.UtcNow;
        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        return await ToDtoAsync(appointment, cancellationToken);
    }

    /// <summary>
    /// PATCH /api/appointments/{id}/status { status }.
    /// programada → confirmada; programada o confirmada → completada, no_asistio o cancelada.
    /// Repetir el mismo estado responde 200 sin cambios.
    /// </summary>
    [HttpPatch("{id:guid}/status")]
    public async Task<ActionResult<AppointmentDto>> ChangeStatus(Guid id, AppointmentStatusRequest request, CancellationToken cancellationToken)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        var appointment = await db.Appointments
            .FromSql($"SELECT * FROM appointments WHERE id = {id} FOR UPDATE")
            .FirstOrDefaultAsync(cancellationToken);
        if (appointment is null) return AppointmentNotFound();

        if (appointment.Status == request.Status) return await ToDtoAsync(appointment, cancellationToken);

        if (!AppointmentStatuses.CanChange(appointment.Status, request.Status))
        {
            return Problem(statusCode: StatusCodes.Status409Conflict,
                title: $"Una cita {appointment.Status.Replace('_', ' ')} no puede pasar a {request.Status.Replace('_', ' ')}");
        }

        appointment.Status = request.Status;
        appointment.StatusChangedAt = clock.UtcNow;
        appointment.StatusChangedByUserId = User.GetUserId();

        if (request.Status == AppointmentStatuses.Cancelada)
        {
            await events.AppointmentCancelledAsync(appointment, cancellationToken);
        }

        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        return await ToDtoAsync(appointment, cancellationToken);
    }

    /// <summary>"Nombres Apellidos" de cada paciente, en una sola consulta (también los dados de baja).</summary>
    private async Task<Dictionary<Guid, string>> PatientNamesAsync(IEnumerable<Guid> patientIds, CancellationToken cancellationToken)
    {
        var ids = patientIds.Distinct().ToList();
        if (ids.Count == 0) return [];
        return await db.Patients.AsNoTracking()
            .Where(patient => ids.Contains(patient.Id))
            .ToDictionaryAsync(patient => patient.Id, patient => patient.FirstName + " " + patient.LastName, cancellationToken);
    }

    private async Task<AppointmentDto> ToDtoAsync(Appointment appointment, CancellationToken cancellationToken)
    {
        var names = await PatientNamesAsync([appointment.PatientId], cancellationToken);
        return AppointmentDto.FromEntity(appointment, names.GetValueOrDefault(appointment.PatientId, ""));
    }

    /// <summary>Datos ya validados de una cita (ids convertidos y horas en UTC).</summary>
    private sealed record AppointmentValues(
        Guid PatientId, Guid ProfessionalId, Guid? TreatmentId, Guid? RoomId, DateTime Start, DateTime End, string? Notes)
    {
        public void ApplyTo(Appointment appointment)
        {
            appointment.PatientId = PatientId;
            appointment.ProfessionalId = ProfessionalId;
            appointment.TreatmentId = TreatmentId;
            appointment.RoomId = RoomId;
            appointment.Start = Start;
            appointment.End = End;
            appointment.Notes = Notes;
        }
    }

    /// <summary>
    /// Valida el formulario contra la base. Al editar, un paciente, profesional, consultorio o tratamiento
    /// que se desactivó después solo se rechaza si se está cambiando a él.
    /// </summary>
    private async Task<AppointmentValues?> ValidateAsync(AppointmentRequest request, Appointment? current, CancellationToken cancellationToken)
    {
        foreach (var (field, message) in request.ValidateRange()) ModelState.AddModelError(field, message);

        if (!TimeSlotRequest.TryParseOptionalId(request.PatientId, out var patientId) || patientId is null)
            ModelState.AddModelError("patientId", "Selecciona un paciente");
        if (!TimeSlotRequest.TryParseOptionalId(request.ProfessionalId, out var professionalId) || professionalId is null)
            ModelState.AddModelError("professionalId", "Selecciona un profesional");
        if (!TimeSlotRequest.TryParseOptionalId(request.TreatmentId, out var treatmentId))
            ModelState.AddModelError("treatmentId", "Tratamiento inválido");
        if (!TimeSlotRequest.TryParseOptionalId(request.RoomId, out var roomId))
            ModelState.AddModelError("roomId", "Consultorio inválido");

        if (!ModelState.IsValid) return null;

        if (patientId != current?.PatientId)
        {
            var patient = await db.Patients.AsNoTracking()
                .Where(entry => entry.Id == patientId)
                .Select(entry => new { entry.DeletedAt })
                .FirstOrDefaultAsync(cancellationToken);
            if (patient is null) ModelState.AddModelError("patientId", "El paciente no existe");
            else if (patient.DeletedAt is not null) ModelState.AddModelError("patientId", "El paciente está dado de baja");
        }

        if (professionalId != current?.ProfessionalId)
        {
            var active = await db.Professionals.Where(entry => entry.Id == professionalId).Select(entry => (bool?)entry.Active).FirstOrDefaultAsync(cancellationToken);
            if (active is null) ModelState.AddModelError("professionalId", "El profesional no existe");
            else if (active == false) ModelState.AddModelError("professionalId", "El profesional está inactivo");
        }

        if (roomId is not null && roomId != current?.RoomId)
        {
            var active = await db.Rooms.Where(entry => entry.Id == roomId).Select(entry => (bool?)entry.Active).FirstOrDefaultAsync(cancellationToken);
            if (active is null) ModelState.AddModelError("roomId", "El consultorio no existe");
            else if (active == false) ModelState.AddModelError("roomId", "El consultorio está inactivo");
        }

        if (treatmentId is not null && treatmentId != current?.TreatmentId)
        {
            var active = await db.Treatments.Where(entry => entry.Id == treatmentId).Select(entry => (bool?)entry.Active).FirstOrDefaultAsync(cancellationToken);
            if (active is null) ModelState.AddModelError("treatmentId", "El tratamiento no existe");
            else if (active == false) ModelState.AddModelError("treatmentId", "El tratamiento está inactivo");
        }

        if (!ModelState.IsValid) return null;

        var (start, end) = request.ToUtc(clock);
        var notes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim();
        return new AppointmentValues(patientId!.Value, professionalId!.Value, treatmentId, roomId, start, end, notes);
    }

    /// <summary>from/to opcionales ("YYYY-MM-DD", inclusivos, en hora de la clínica) → rango UTC.</summary>
    private bool TryParseRange(string? from, string? to, out (DateTime Start, DateTime End)? range)
    {
        range = null;
        if (string.IsNullOrWhiteSpace(from) && string.IsNullOrWhiteSpace(to)) return true;

        var attribute = new IsoDateAttribute();
        if (string.IsNullOrWhiteSpace(from) || !attribute.IsValid(from)) ModelState.AddModelError("from", "Fecha inválida (formato AAAA-MM-DD)");
        if (string.IsNullOrWhiteSpace(to) || !attribute.IsValid(to)) ModelState.AddModelError("to", "Fecha inválida (formato AAAA-MM-DD)");
        if (!ModelState.IsValid) return false;

        var fromDate = Validation.ParseDate(from)!.Value;
        var toDate = Validation.ParseDate(to)!.Value;
        if (fromDate > toDate)
        {
            ModelState.AddModelError("to", "La fecha final debe ser igual o posterior a la inicial");
            return false;
        }

        range = clock.UtcRange(fromDate, toDate);
        return true;
    }

    private ObjectResult NotEditable() =>
        Problem(statusCode: StatusCodes.Status409Conflict, title: "Solo se pueden editar citas programadas o confirmadas");

    private ObjectResult AppointmentNotFound() =>
        Problem(statusCode: StatusCodes.Status404NotFound, title: "Cita no encontrada");
}
