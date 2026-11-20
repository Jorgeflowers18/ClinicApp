using ClinicApp.Api.Common;
using ClinicApp.Api.Data;
using ClinicApp.Api.Modules.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

namespace ClinicApp.Api.Modules.Institution;

/// <summary>Perfil de la institución: /api/institution</summary>
[ApiController]
[Route("api/institution")]
public class InstitutionController(AppDbContext db, ClinicClock clock) : ControllerBase
{
    /// <summary>
    /// GET /api/institution/public → { name, logoText, logoImage }, <b>sin sesión</b>, para la pantalla de
    /// inicio de sesión. Nunca devuelve el RUC, el contacto ni las notas.
    /// </summary>
    [HttpGet("public")]
    [AllowAnonymous]
    [EnableRateLimiting(RateLimits.Public)]
    public async Task<PublicInstitutionDto> GetPublic(CancellationToken cancellationToken)
    {
        var profile = await LoadAsync(tracking: false, cancellationToken);
        return new PublicInstitutionDto(profile.Name, profile.LogoText, profile.LogoImage);
    }

    /// <summary>GET /api/institution/profile → el perfil completo con sus sedes. Los tres roles.</summary>
    [HttpGet("profile")]
    [Authorize(Roles = Roles.Todos)]
    public async Task<InstitutionProfileDto> GetProfile(CancellationToken cancellationToken) =>
        InstitutionProfileDto.FromEntity(await LoadAsync(tracking: false, cancellationToken));

    /// <summary>
    /// PUT /api/institution/profile → reemplaza el perfil completo. Solo admin.
    /// Las sedes con id se actualizan, las que vienen sin id se crean (el servidor les da un UUID v7) y las que
    /// no vienen se borran. Un id que no es de una sede de la clínica da 400 en <c>branches[i].id</c>.
    /// </summary>
    [HttpPut("profile")]
    [Authorize(Roles = Roles.Admin)]
    [RequestSizeLimit(2 * 1024 * 1024)]
    public async Task<ActionResult<InstitutionProfileDto>> UpdateProfile(InstitutionProfileRequest request, CancellationToken cancellationToken)
    {
        var profile = await LoadAsync(tracking: true, cancellationToken);

        profile.Name = request.Name.Trim();
        profile.LegalName = Validation.Clean(request.LegalName);
        profile.Ruc = Validation.Clean(request.Ruc);
        profile.Phone = Validation.Clean(request.Phone);
        profile.Email = Validation.Clean(request.Email).ToLowerInvariant();
        profile.Address = Validation.Clean(request.Address);
        profile.Website = Validation.Clean(request.Website);
        profile.LogoText = Validation.Clean(request.LogoText);
        profile.LogoImage = string.IsNullOrWhiteSpace(request.LogoImage) ? null : request.LogoImage;
        profile.Notes = Validation.Clean(request.Notes);
        profile.Hours = Validation.Clean(request.Hours);
        profile.UpdatedAt = clock.UtcNow;
        profile.UpdatedByUserId = User.GetUserId();

        if (SyncBranches(profile, request.Branches) is { } unknown)
        {
            ModelState.AddModelError($"branches[{unknown}].id", "La sede no existe");
            return ValidationProblem(ModelState);
        }

        // En dos pasos: primero se guardan todas sin "principal" y después se marca la principal. Así el índice
        // único "una sola principal" no choca cuando la principal pasa de una sede a otra.
        var mains = profile.Branches.Where(branch => branch.IsMain).ToList();
        mains.ForEach(branch => branch.IsMain = false);

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        await db.SaveChangesAsync(cancellationToken);
        mains.ForEach(branch => branch.IsMain = true);
        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        return InstitutionProfileDto.FromEntity(profile);
    }

    /// <summary>
    /// Sincroniza las sedes con la lista recibida. Devuelve el índice de la primera sede cuyo id no es de una sede
    /// de la clínica, o null si todas son válidas (en ese caso no se cambia nada).
    /// </summary>
    private int? SyncBranches(InstitutionProfile profile, List<InstitutionBranchRequest> requested)
    {
        // La validación del request ya garantiza que cada id es vacío o un UUID, sin repetidos.
        var ids = requested.Select(branch => Guid.TryParse(branch.Id?.Trim(), out var id) ? id : (Guid?)null).ToList();
        for (var index = 0; index < ids.Count; index++)
            if (ids[index] is { } id && profile.Branches.All(branch => branch.Id != id)) return index;

        foreach (var removed in profile.Branches.Where(branch => !ids.Contains(branch.Id)).ToList())
            profile.Branches.Remove(removed);

        for (var index = 0; index < requested.Count; index++)
        {
            var request = requested[index];
            var branch = ids[index] is { } id ? profile.Branches.Single(entry => entry.Id == id) : null;
            if (branch is null)
            {
                // db.Add y no solo profile.Branches.Add: con el id ya puesto, EF la tomaría por una fila existente.
                branch = new InstitutionBranch { Id = Guid.CreateVersion7(), InstitutionId = profile.Id };
                db.InstitutionBranches.Add(branch);
            }
            branch.Position = index;
            branch.Name = Validation.Clean(request.Name);
            branch.Address = Validation.Clean(request.Address);
            branch.Phone = Validation.Clean(request.Phone);
            branch.Hours = Validation.Clean(request.Hours);
            branch.IsMain = request.IsMain;
        }
        return null;
    }

    /// <summary>El perfil de la única clínica (la semilla lo crea al arrancar si no existe).</summary>
    private async Task<InstitutionProfile> LoadAsync(bool tracking, CancellationToken cancellationToken)
    {
        var query = db.Institutions.Include(profile => profile.Branches).AsQueryable();
        if (!tracking) query = query.AsNoTracking();
        return await query.FirstOrDefaultAsync(profile => profile.Id == InstitutionProfile.SingleId, cancellationToken)
            ?? throw new InvalidOperationException("No existe el perfil de la institución (lo crea InstitutionSeeder al arrancar).");
    }
}
