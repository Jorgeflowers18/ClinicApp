using ClinicApp.Api.Common;
using ClinicApp.Api.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ClinicApp.Api.Modules.Treatments;

/// <summary>
/// Catálogo de tratamientos: /api/treatments
/// El AppDbContext llega por el constructor (inyección de dependencias).
/// </summary>
[ApiController]
[Route("api/treatments")]
public class TreatmentsController(AppDbContext db) : ControllerBase
{
    /// <summary>
    /// GET /api/treatments?page=1&amp;pageSize=10&amp;search=limpieza → lista paginada (pantalla Tratamientos).
    /// GET /api/treatments?active=true → todos los activos sin paginar (selectores de la historia clínica).
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> List([FromQuery] PageQuery query, [FromQuery] bool? active, CancellationToken cancellationToken)
    {
        // AsNoTracking: solo vamos a leer, así EF Core no vigila cambios en estos objetos (más rápido).
        var treatments = db.Treatments.AsNoTracking();

        if (active == true)
        {
            var activeTreatments = await treatments
                .Where(treatment => treatment.Active)
                .OrderBy(treatment => treatment.Name)
                .ToListAsync(cancellationToken);

            return Ok(activeTreatments.Select(TreatmentDto.FromEntity));
        }

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            // ILIKE: búsqueda sin distinguir mayúsculas, en el nombre o la categoría (igual que el mock).
            var pattern = $"%{query.Search.Trim()}%";
            treatments = treatments.Where(treatment =>
                EF.Functions.ILike(treatment.Name, pattern) || EF.Functions.ILike(treatment.Category, pattern));
        }

        var page = await treatments
            .OrderBy(treatment => treatment.Name)
            .ToPagedResultAsync(query, cancellationToken);

        return Ok(new PagedResult<TreatmentDto>(
            page.Items.Select(TreatmentDto.FromEntity).ToList(),
            page.Page,
            page.PageSize,
            page.TotalItems,
            page.TotalPages));
    }

    /// <summary>GET /api/treatments/{id}</summary>
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<TreatmentDto>> Get(Guid id, CancellationToken cancellationToken)
    {
        var treatment = await db.Treatments.AsNoTracking()
            .FirstOrDefaultAsync(item => item.Id == id, cancellationToken);

        if (treatment is null) return TreatmentNotFound();

        return TreatmentDto.FromEntity(treatment);
    }

    /// <summary>POST /api/treatments → 201 Created con el tratamiento creado.</summary>
    [HttpPost]
    public async Task<ActionResult<TreatmentDto>> Create(TreatmentRequest request, CancellationToken cancellationToken)
    {
        // Si llegamos aquí, [ApiController] ya validó el request: si algo fallaba, respondió 400 solo.
        var treatment = new Treatment { Id = Guid.CreateVersion7(), CreatedAt = DateTime.UtcNow };
        request.ApplyTo(treatment);

        db.Treatments.Add(treatment);
        await db.SaveChangesAsync(cancellationToken); // aquí recién se ejecuta el INSERT

        return CreatedAtAction(nameof(Get), new { id = treatment.Id }, TreatmentDto.FromEntity(treatment));
    }

    /// <summary>PUT /api/treatments/{id}</summary>
    [HttpPut("{id:guid}")]
    public async Task<ActionResult<TreatmentDto>> Update(Guid id, TreatmentRequest request, CancellationToken cancellationToken)
    {
        // Sin AsNoTracking: EF Core vigila el objeto y al guardar genera un UPDATE solo de lo que cambió.
        var treatment = await db.Treatments.FirstOrDefaultAsync(item => item.Id == id, cancellationToken);
        if (treatment is null) return TreatmentNotFound();

        request.ApplyTo(treatment);
        await db.SaveChangesAsync(cancellationToken);

        return TreatmentDto.FromEntity(treatment);
    }

    /// <summary>DELETE /api/treatments/{id} → 204 No Content.</summary>
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var treatment = await db.Treatments.FirstOrDefaultAsync(item => item.Id == id, cancellationToken);
        if (treatment is null) return TreatmentNotFound();

        // Pendiente: cuando existan los tratamientos realizados (asignaciones), responder 409
        // si el tratamiento ya se usó, y sugerir desactivarlo en lugar de borrarlo.
        db.Treatments.Remove(treatment);
        await db.SaveChangesAsync(cancellationToken);

        return NoContent();
    }

    /// <summary>404 en formato ProblemDetails: el frontend muestra el "title" como mensaje.</summary>
    private ObjectResult TreatmentNotFound() =>
        Problem(statusCode: StatusCodes.Status404NotFound, title: "Tratamiento no encontrado");
}
