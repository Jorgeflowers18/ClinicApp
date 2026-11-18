using ClinicApp.Api.Common;
using ClinicApp.Api.Data;
using ClinicApp.Api.Modules.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ClinicApp.Api.Modules.Inventory;

/// <summary>Ciclos de esterilización del instrumental: /api/inventory/sterilization-cycles</summary>
[ApiController]
[Route("api/inventory/sterilization-cycles")]
[Authorize(Roles = Roles.AdminYRecepcion)]
public class SterilizationCyclesController(AppDbContext db, ClinicClock clock) : ControllerBase
{
    /// <summary>GET /api/inventory/sterilization-cycles → por fecha, del más reciente al más antiguo.</summary>
    [HttpGet]
    public async Task<List<SterilizationCycleDto>> List(CancellationToken cancellationToken)
    {
        var cycles = await db.SterilizationCycles.AsNoTracking()
            .Include(cycle => cycle.Items)
            .OrderByDescending(cycle => cycle.PerformedAt)
            .ThenByDescending(cycle => cycle.CreatedAt)
            .ToListAsync(cancellationToken);

        return cycles.Select(SterilizationCycleDto.FromEntity).ToList();
    }

    /// <summary>POST /api/inventory/sterilization-cycles → 201. Solo admite insumos de tipo instrumental.</summary>
    [HttpPost]
    public async Task<ActionResult<SterilizationCycleDto>> Create(SterilizationCycleRequest request, CancellationToken cancellationToken)
    {
        var performedAt = Validation.ParseDate(request.PerformedAt)!.Value;

        // La fecha no puede ser futura: se compara con "hoy" en la zona horaria de la clínica.
        if (performedAt > clock.Today)
        {
            ModelState.AddModelError("performedAt", "La fecha no puede ser futura");
        }

        var itemIds = request.ItemIds.Distinct().ToList();
        var items = await db.InventoryItems.AsNoTracking()
            .Where(item => itemIds.Contains(item.Id))
            .Select(item => new { item.Id, item.Name, item.Kind })
            .ToListAsync(cancellationToken);

        if (items.Count < itemIds.Count)
        {
            ModelState.AddModelError("itemIds", "Alguno de los instrumentos seleccionados no existe");
        }

        foreach (var item in items.Where(item => item.Kind != ItemKinds.Instrumental))
        {
            ModelState.AddModelError("itemIds", $"«{item.Name}» no es instrumental esterilizable");
        }

        var responsibleActive = await db.Professionals
            .Where(professional => professional.Id == request.ResponsibleProfessionalId)
            .Select(professional => (bool?)professional.Active)
            .FirstOrDefaultAsync(cancellationToken);
        if (responsibleActive is null)
        {
            ModelState.AddModelError("responsibleProfessionalId", "El responsable no existe");
        }
        else if (responsibleActive == false)
        {
            ModelState.AddModelError("responsibleProfessionalId", "El responsable está inactivo");
        }

        if (!ModelState.IsValid) return this.ValidationError(ModelState);

        var cycle = new SterilizationCycle
        {
            Id = Guid.CreateVersion7(),
            PerformedAt = performedAt,
            Result = request.Result,
            ResponsibleProfessionalId = request.ResponsibleProfessionalId!.Value,
            Notes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim(),
            CreatedByUserId = User.GetUserId(),
            CreatedAt = DateTime.UtcNow,
        };
        cycle.Items = itemIds.Select(itemId => new SterilizationCycleItem { CycleId = cycle.Id, ItemId = itemId }).ToList();

        db.SterilizationCycles.Add(cycle);
        await db.SaveChangesAsync(cancellationToken);

        return StatusCode(StatusCodes.Status201Created, SterilizationCycleDto.FromEntity(cycle));
    }
}
