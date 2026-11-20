using ClinicApp.Api.Common;
using ClinicApp.Api.Data;
using ClinicApp.Api.Modules.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ClinicApp.Api.Modules.Appointments;

/// <summary>
/// Catálogo de consultorios: /api/rooms
/// Leer: los tres roles. Crear y editar: solo admin.
/// </summary>
[ApiController]
[Route("api/rooms")]
[Authorize(Roles = Roles.Todos)]
public class RoomsController(AppDbContext db, ClinicClock clock) : ControllerBase
{
    private const string DuplicateName = "Ya existe un consultorio activo con ese nombre";

    /// <summary>GET /api/rooms → todos, también los inactivos, por nombre.</summary>
    [HttpGet]
    public async Task<List<RoomDto>> List(CancellationToken cancellationToken)
    {
        var rooms = await db.Rooms.AsNoTracking().OrderBy(room => room.Name).ToListAsync(cancellationToken);
        return rooms.Select(RoomDto.FromEntity).ToList();
    }

    /// <summary>POST /api/rooms → 201. Solo admin.</summary>
    [HttpPost]
    [Authorize(Roles = Roles.Admin)]
    public async Task<ActionResult<RoomDto>> Create(RoomRequest request, CancellationToken cancellationToken)
    {
        var name = request.Name.Trim();
        if (request.Active && await NameInUseAsync(name, exceptId: null, cancellationToken))
        {
            return this.FieldConflict("name", DuplicateName);
        }

        var room = new Room { Id = Guid.CreateVersion7(), Name = name, Active = request.Active, CreatedAt = clock.UtcNow };
        db.Rooms.Add(room);
        await db.SaveChangesAsync(cancellationToken);

        return StatusCode(StatusCodes.Status201Created, RoomDto.FromEntity(room));
    }

    /// <summary>PUT /api/rooms/{id}. Solo admin. Se desactiva en lugar de borrarse.</summary>
    [HttpPut("{id:guid}")]
    [Authorize(Roles = Roles.Admin)]
    public async Task<ActionResult<RoomDto>> Update(Guid id, RoomRequest request, CancellationToken cancellationToken)
    {
        var room = await db.Rooms.FirstOrDefaultAsync(entry => entry.Id == id, cancellationToken);
        if (room is null) return Problem(statusCode: StatusCodes.Status404NotFound, title: "Consultorio no encontrado");

        var name = request.Name.Trim();
        if (request.Active && await NameInUseAsync(name, exceptId: id, cancellationToken))
        {
            return this.FieldConflict("name", DuplicateName);
        }

        room.Name = name;
        room.Active = request.Active;
        await db.SaveChangesAsync(cancellationToken);

        return RoomDto.FromEntity(room);
    }

    /// <summary>¿Hay otro consultorio activo con ese nombre? (sin distinguir mayúsculas)</summary>
    private Task<bool> NameInUseAsync(string name, Guid? exceptId, CancellationToken cancellationToken)
    {
        var lowered = name.ToLower();
        return db.Rooms.AnyAsync(room => room.Active && room.Id != exceptId && room.Name.ToLower() == lowered, cancellationToken);
    }
}
