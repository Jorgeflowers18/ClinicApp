using ClinicApp.Api.Common;
using ClinicApp.Api.Data;
using ClinicApp.Api.Modules.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ClinicApp.Api.Modules.Appointments;

/// <summary>
/// Catálogo de profesionales: /api/professionals
/// Leer: los tres roles. Crear y editar: solo admin (pantalla /administracion del frontend).
/// </summary>
[ApiController]
[Route("api/professionals")]
[Authorize(Roles = Roles.Todos)]
public class ProfessionalsController(AppDbContext db, ClinicClock clock) : ControllerBase
{
    /// <summary>
    /// GET /api/professionals → todos, también los inactivos (con active: false), por nombre.
    /// Los inactivos siguen apareciendo para que la agenda y la historia muestren su nombre.
    /// </summary>
    [HttpGet]
    public async Task<List<ProfessionalDto>> List(CancellationToken cancellationToken)
    {
        var professionals = await db.Professionals.AsNoTracking()
            .OrderBy(professional => professional.Name)
            .ToListAsync(cancellationToken);
        var users = await LinkedUsersAsync(cancellationToken);

        return professionals
            .Select(professional => ProfessionalDto.FromEntity(professional, users.GetValueOrDefault(professional.Id)))
            .ToList();
    }

    /// <summary>GET /api/professionals/{id}</summary>
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ProfessionalDto>> Get(Guid id, CancellationToken cancellationToken)
    {
        var professional = await db.Professionals.AsNoTracking().FirstOrDefaultAsync(entry => entry.Id == id, cancellationToken);
        if (professional is null) return ProfessionalNotFound();

        var userId = await db.Users
            .Where(user => user.ProfessionalId == id)
            .Select(user => (Guid?)user.Id)
            .FirstOrDefaultAsync(cancellationToken);
        return ProfessionalDto.FromEntity(professional, userId);
    }

    /// <summary>POST /api/professionals → 201. Solo admin.</summary>
    [HttpPost]
    [Authorize(Roles = Roles.Admin)]
    public async Task<ActionResult<ProfessionalDto>> Create(ProfessionalRequest request, CancellationToken cancellationToken)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        var professional = new Professional { Id = Guid.CreateVersion7(), CreatedAt = clock.UtcNow };
        request.ApplyTo(professional);
        db.Professionals.Add(professional);

        if (await LinkUserAsync(professional.Id, request.UserId, cancellationToken) is { } error) return error;

        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        return CreatedAtAction(nameof(Get), new { id = professional.Id }, ProfessionalDto.FromEntity(professional, request.UserId));
    }

    /// <summary>
    /// PUT /api/professionals/{id}. Solo admin. Incluye active (desactivar en lugar de borrar) y userId.
    /// La respuesta trae futureAppointments: cuántas citas futuras tiene, para avisar si se desactiva.
    /// </summary>
    [HttpPut("{id:guid}")]
    [Authorize(Roles = Roles.Admin)]
    public async Task<ActionResult<ProfessionalUpdateDto>> Update(Guid id, ProfessionalRequest request, CancellationToken cancellationToken)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        var professional = await db.Professionals.FirstOrDefaultAsync(entry => entry.Id == id, cancellationToken);
        if (professional is null) return ProfessionalNotFound();

        request.ApplyTo(professional);
        if (await LinkUserAsync(id, request.UserId, cancellationToken) is { } error) return error;

        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        var futureAppointments = await CountFutureAppointmentsAsync(id, cancellationToken);
        return new ProfessionalUpdateDto(professional.Id, professional.Name, professional.Specialty,
            professional.RegistrationNumber, professional.Active, request.UserId, futureAppointments);
    }

    /// <summary>
    /// Deja vinculado al profesional con el usuario pedido (o con ninguno). Un usuario tiene como máximo
    /// un profesional y un profesional, como máximo un usuario. Devuelve el error, o null si salió bien.
    /// </summary>
    private async Task<ObjectResult?> LinkUserAsync(Guid professionalId, Guid? userId, CancellationToken cancellationToken)
    {
        var current = await db.Users.Where(user => user.ProfessionalId == professionalId).ToListAsync(cancellationToken);

        if (userId is { } wanted)
        {
            var user = await db.Users.FirstOrDefaultAsync(entry => entry.Id == wanted, cancellationToken);
            if (user is null)
            {
                ModelState.AddModelError("userId", "El usuario no existe");
                return this.ValidationError(ModelState);
            }
            if (user.ProfessionalId is { } other && other != professionalId)
            {
                return this.FieldConflict("userId", "Ese usuario ya está vinculado a otro profesional");
            }
            user.ProfessionalId = professionalId;
        }

        foreach (var user in current.Where(user => user.Id != userId))
        {
            user.ProfessionalId = null;
        }

        return null;
    }

    /// <summary>Profesional → usuario vinculado.</summary>
    private Task<Dictionary<Guid, Guid?>> LinkedUsersAsync(CancellationToken cancellationToken) =>
        db.Users.AsNoTracking()
            .Where(user => user.ProfessionalId != null)
            .ToDictionaryAsync(user => user.ProfessionalId!.Value, user => (Guid?)user.Id, cancellationToken);

    /// <summary>Citas programadas o confirmadas que empiezan desde ahora.</summary>
    private Task<int> CountFutureAppointmentsAsync(Guid professionalId, CancellationToken cancellationToken)
    {
        var now = clock.UtcNow;
        return db.Appointments.CountAsync(appointment =>
            appointment.ProfessionalId == professionalId
            && appointment.Start >= now
            && (appointment.Status == AppointmentStatuses.Programada || appointment.Status == AppointmentStatuses.Confirmada),
            cancellationToken);
    }

    private ObjectResult ProfessionalNotFound() =>
        Problem(statusCode: StatusCodes.Status404NotFound, title: "Profesional no encontrado");
}
