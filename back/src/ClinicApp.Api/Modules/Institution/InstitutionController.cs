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
    /// Las sedes con un id existente se actualizan, las nuevas se crean y las que no vienen se borran.
    /// </summary>
    [HttpPut("profile")]
    [Authorize(Roles = Roles.Admin)]
    [RequestSizeLimit(2 * 1024 * 1024)]
    public async Task<InstitutionProfileDto> UpdateProfile(InstitutionProfileRequest request, CancellationToken cancellationToken)
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

        SyncBranches(profile, request.Branches);

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

    private static void SyncBranches(InstitutionProfile profile, List<InstitutionBranchRequest> requested)
    {
        var wanted = requested.Select((branch, index) => (Branch: branch, Index: index)).ToDictionary(entry => entry.Branch.Id.Trim());
        profile.Branches.RemoveAll(branch => !wanted.ContainsKey(branch.Id));

        foreach (var (id, (request, index)) in wanted)
        {
            var branch = profile.Branches.Find(entry => entry.Id == id);
            if (branch is null)
            {
                branch = new InstitutionBranch { InstitutionId = profile.Id, Id = id };
                profile.Branches.Add(branch);
            }
            branch.Position = index;
            branch.Name = request.Name.Trim();
            branch.Address = Validation.Clean(request.Address);
            branch.Phone = Validation.Clean(request.Phone);
            branch.Hours = Validation.Clean(request.Hours);
            branch.IsMain = request.IsMain;
        }
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
