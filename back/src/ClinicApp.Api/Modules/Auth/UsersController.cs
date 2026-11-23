using ClinicApp.Api.Common;
using ClinicApp.Api.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ClinicApp.Api.Modules.Auth;

/// <summary>
/// Gestión de usuarios: /api/users. Solo admin.
/// <list type="bullet">
/// <item>Las cuentas no se borran: se desactivan (los registros guardan quién los hizo).</item>
/// <item>Una cuenta nueva no tiene contraseña usable: recibe un enlace de un solo uso para elegirla.</item>
/// <item>El admin no puede desactivarse ni quitarse el rol a sí mismo, y siempre queda al menos un admin activo.</item>
/// <item>Al desactivar o cambiar el rol se cierran las sesiones de esa cuenta.</item>
/// </list>
/// </summary>
[ApiController]
[Route("api/users")]
[Authorize(Roles = Roles.Admin)]
public sealed class UsersController(AppDbContext db, AuthOptions options, IPasswordHasher<User> passwordHasher) : ControllerBase
{
    private const string DuplicateEmail = "Ya existe una cuenta con ese correo";
    private const string LastAdmin = "Debe quedar al menos un administrador activo";

    /// <summary>GET /api/users → todas las cuentas, también las inactivas, por nombre. Sin paginar: son decenas.</summary>
    [HttpGet]
    public Task<List<UserDto>> List(CancellationToken cancellationToken) =>
        Project(db.Users.AsNoTracking().OrderBy(user => user.Name)).ToListAsync(cancellationToken);

    /// <summary>
    /// POST /api/users → 201 con la cuenta y el enlace para que la persona elija su contraseña
    /// (vale <c>Auth:InvitationHours</c>, 72 horas).
    /// </summary>
    [HttpPost]
    public async Task<ActionResult<UserCreatedDto>> Create(UserCreateRequest request, CancellationToken cancellationToken)
    {
        var email = AuthController.NormalizeEmail(request.Email);
        if (await CheckAsync(null, email, request.ProfessionalId, cancellationToken) is { } error) return error;

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        var user = new User
        {
            Id = Guid.CreateVersion7(),
            Email = email,
            Name = request.Name.Trim(),
            Role = request.Role,
            ProfessionalId = request.ProfessionalId,
            CreatedAt = DateTime.UtcNow,
        };
        // Contraseña aleatoria que nadie conoce: no puede iniciar sesión hasta usar el enlace.
        user.PasswordHash = passwordHasher.HashPassword(user, TokenService.NewOpaqueToken());
        db.Users.Add(user);
        await db.SaveChangesAsync(cancellationToken);

        var link = await db.CreatePasswordLinkAsync(options, user.Id, TimeSpan.FromHours(options.InvitationHours), cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        return StatusCode(StatusCodes.Status201Created, new UserCreatedDto(await GetDtoAsync(user.Id, cancellationToken), link));
    }

    /// <summary>PUT /api/users/{id}: nombre, correo, rol, profesional vinculado y activo.</summary>
    [HttpPut("{id:guid}")]
    public async Task<ActionResult<UserDto>> Update(Guid id, UserUpdateRequest request, CancellationToken cancellationToken)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        var user = await db.Users.FirstOrDefaultAsync(entry => entry.Id == id, cancellationToken);
        if (user is null) return UserNotFound();

        var losesAdmin = user.Role == Roles.Admin && user.Active && (request.Role != Roles.Admin || !request.Active);
        if (id == User.GetUserId())
        {
            if (!request.Active) return this.FieldConflict("active", "No puedes desactivar tu propia cuenta");
            if (request.Role != Roles.Admin) return this.FieldConflict("role", "No puedes quitarte el rol de administrador");
        }
        // Con las reglas de arriba solo pasa si quien llama ya perdió el rol y su token aún no vence (15 min).
        if (losesAdmin && !await db.Users.AnyAsync(other => other.Id != id && other.Active && other.Role == Roles.Admin, cancellationToken))
        {
            return this.FieldConflict(request.Active ? "role" : "active", LastAdmin);
        }

        var email = AuthController.NormalizeEmail(request.Email);
        if (await CheckAsync(id, email, request.ProfessionalId, cancellationToken) is { } error) return error;

        var endSessions = user.Role != request.Role || (user.Active && !request.Active);
        user.Name = request.Name.Trim();
        user.Email = email;
        user.Role = request.Role;
        user.ProfessionalId = request.ProfessionalId;
        user.Active = request.Active;
        await db.SaveChangesAsync(cancellationToken);

        // Con otro rol o desactivada, la sesión no se renueva: vuelve a entrar (si puede) con sus permisos nuevos.
        if (endSessions) await db.RevokeAllSessionsAsync(id, cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        return await GetDtoAsync(id, cancellationToken);
    }

    /// <summary>
    /// POST /api/users/{id}/password-link → un enlace nuevo para elegir la contraseña (cuenta nueva cuyo enlace
    /// venció, u olvido). El anterior deja de valer. Una cuenta desactivada responde 409.
    /// </summary>
    [HttpPost("{id:guid}/password-link")]
    public async Task<ActionResult<PasswordLinkDto>> CreatePasswordLink(Guid id, CancellationToken cancellationToken)
    {
        var user = await db.Users.AsNoTracking()
            .Select(entry => new { entry.Id, entry.Active })
            .FirstOrDefaultAsync(entry => entry.Id == id, cancellationToken);
        if (user is null) return UserNotFound();
        if (!user.Active) return this.FieldConflict("active", "La cuenta está desactivada: actívala antes de generar un enlace");

        return await db.CreatePasswordLinkAsync(options, id, TimeSpan.FromHours(options.InvitationHours), cancellationToken);
    }

    /// <summary>Correo libre y profesional existente y sin otra cuenta. Devuelve el error, o null.</summary>
    private async Task<ObjectResult?> CheckAsync(Guid? userId, string email, Guid? professionalId, CancellationToken cancellationToken)
    {
        if (await db.Users.AnyAsync(user => user.Email == email && user.Id != userId, cancellationToken))
        {
            return this.FieldConflict("email", DuplicateEmail);
        }

        if (professionalId is { } wanted)
        {
            if (!await db.Professionals.AnyAsync(professional => professional.Id == wanted, cancellationToken))
            {
                ModelState.AddModelError("professionalId", "El profesional no existe");
                return this.ValidationError(ModelState);
            }
            if (await db.Users.AnyAsync(user => user.ProfessionalId == wanted && user.Id != userId, cancellationToken))
            {
                return this.FieldConflict("professionalId", "Ese profesional ya tiene una cuenta");
            }
        }

        return null;
    }

    private Task<UserDto> GetDtoAsync(Guid id, CancellationToken cancellationToken) =>
        Project(db.Users.AsNoTracking().Where(user => user.Id == id)).SingleAsync(cancellationToken);

    // Proyección: no lee el perfil (su foto puede pesar cientos de KB) ni el hash de la contraseña.
    private IQueryable<UserDto> Project(IQueryable<User> users) =>
        users.Select(user => new UserDto(
            user.Id,
            user.Name,
            user.Email,
            user.Role,
            user.ProfessionalId,
            db.Professionals.Where(professional => professional.Id == user.ProfessionalId).Select(professional => professional.Name).FirstOrDefault(),
            user.Active,
            user.CreatedAt,
            user.LastLoginAt));

    private ObjectResult UserNotFound() =>
        Problem(statusCode: StatusCodes.Status404NotFound, title: "Usuario no encontrado");
}
