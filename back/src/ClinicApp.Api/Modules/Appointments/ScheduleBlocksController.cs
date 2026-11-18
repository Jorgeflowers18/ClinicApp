using ClinicApp.Api.Common;
using ClinicApp.Api.Data;
using ClinicApp.Api.Modules.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ClinicApp.Api.Modules.Appointments;

/// <summary>Bloqueos puntuales de horario: /api/schedule-blocks. Los tres roles.</summary>
[ApiController]
[Route("api/schedule-blocks")]
[Authorize(Roles = Roles.Todos)]
public class ScheduleBlocksController(AppDbContext db, ClinicClock clock, AvailabilityService availability) : ControllerBase
{
    /// <summary>
    /// GET /api/schedule-blocks?from=YYYY-MM-DD&amp;to=YYYY-MM-DD → por inicio. Sin rango, todos.
    /// Con rango, los que se cruzan con esos días (en hora de la clínica).
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<List<ScheduleBlockDto>>> List([FromQuery] string? from, [FromQuery] string? to, CancellationToken cancellationToken)
    {
        var blocks = db.ScheduleBlocks.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(from) || !string.IsNullOrWhiteSpace(to))
        {
            var attribute = new IsoDateAttribute();
            if (string.IsNullOrWhiteSpace(from) || !attribute.IsValid(from)) ModelState.AddModelError("from", "Fecha inválida (formato AAAA-MM-DD)");
            if (string.IsNullOrWhiteSpace(to) || !attribute.IsValid(to)) ModelState.AddModelError("to", "Fecha inválida (formato AAAA-MM-DD)");
            if (!ModelState.IsValid) return this.ValidationError(ModelState);

            var (start, end) = clock.UtcRange(Validation.ParseDate(from)!.Value, Validation.ParseDate(to)!.Value);
            blocks = blocks.Where(block => block.Start < end && block.End > start);
        }

        var list = await blocks.OrderBy(block => block.Start).ThenBy(block => block.Id).ToListAsync(cancellationToken);
        return list.Select(ScheduleBlockDto.FromEntity).ToList();
    }

    /// <summary>POST /api/schedule-blocks → 201. 409 si cae sobre una cita no cancelada.</summary>
    [HttpPost]
    public async Task<ActionResult<ScheduleBlockDto>> Create(ScheduleBlockRequest request, CancellationToken cancellationToken)
    {
        foreach (var (field, message) in request.ValidateRange()) ModelState.AddModelError(field, message);

        if (!TimeSlotRequest.TryParseOptionalId(request.ProfessionalId, out var professionalId))
            ModelState.AddModelError("professionalId", "Profesional inválido");
        if (!TimeSlotRequest.TryParseOptionalId(request.RoomId, out var roomId))
            ModelState.AddModelError("roomId", "Consultorio inválido");
        if (ModelState.IsValid && professionalId is null && roomId is null)
            ModelState.AddModelError("roomId", "Selecciona un profesional o un consultorio");

        if (ModelState.IsValid && professionalId is not null && !await db.Professionals.AnyAsync(entry => entry.Id == professionalId, cancellationToken))
            ModelState.AddModelError("professionalId", "El profesional no existe");
        if (ModelState.IsValid && roomId is not null && !await db.Rooms.AnyAsync(entry => entry.Id == roomId, cancellationToken))
            ModelState.AddModelError("roomId", "El consultorio no existe");

        if (!ModelState.IsValid) return this.ValidationError(ModelState);

        var (start, end) = request.ToUtc(clock);

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        await availability.LockAsync(professionalId, roomId, cancellationToken);

        var conflict = await availability.FindBlockConflictAsync(professionalId, roomId, start, end, cancellationToken);
        if (conflict is not null) return this.FieldConflict("startTime", conflict);

        var block = new ScheduleBlock
        {
            Id = Guid.CreateVersion7(),
            ProfessionalId = professionalId,
            RoomId = roomId,
            Start = start,
            End = end,
            Reason = request.Reason.Trim(),
            CreatedAt = clock.UtcNow,
            CreatedByUserId = User.GetUserId(),
        };
        db.ScheduleBlocks.Add(block);
        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        return StatusCode(StatusCodes.Status201Created, ScheduleBlockDto.FromEntity(block));
    }

    /// <summary>DELETE /api/schedule-blocks/{id} → 204.</summary>
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var deleted = await db.ScheduleBlocks.Where(block => block.Id == id).ExecuteDeleteAsync(cancellationToken);
        return deleted == 0
            ? Problem(statusCode: StatusCodes.Status404NotFound, title: "Bloqueo no encontrado")
            : NoContent();
    }
}
