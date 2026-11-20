using ClinicApp.Api.Common;
using ClinicApp.Api.Data;
using ClinicApp.Api.Modules.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ClinicApp.Api.Modules.Treatments;

/// <summary>
/// Catálogo de tratamientos: /api/treatments
/// El AppDbContext llega por el constructor (inyección de dependencias).
/// </summary>
[ApiController]
[Route("api/treatments")]
[Authorize(Roles = Roles.Todos)] // admin, recepcion y medico
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
        // Include: trae también los insumos de cada tratamiento (tabla treatment_consumptions).
        IQueryable<Treatment> treatments = db.Treatments.AsNoTracking().Include(treatment => treatment.Consumption);

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
            .Include(entry => entry.Consumption)
            .FirstOrDefaultAsync(item => item.Id == id, cancellationToken);

        if (treatment is null) return TreatmentNotFound();

        return TreatmentDto.FromEntity(treatment);
    }

    /// <summary>POST /api/treatments → 201 Created con el tratamiento creado.</summary>
    [HttpPost]
    public async Task<ActionResult<TreatmentDto>> Create(TreatmentRequest request, CancellationToken cancellationToken)
    {
        // Si llegamos aquí, [ApiController] ya validó el request: si algo fallaba, respondió 400 solo.
        if (!await ValidateConsumptionAsync(request, cancellationToken)) return this.ValidationError(ModelState);

        var treatment = new Treatment { Id = Guid.CreateVersion7(), CreatedAt = DateTime.UtcNow };
        request.ApplyTo(treatment);
        SyncConsumption(treatment, request);

        db.Treatments.Add(treatment);
        await db.SaveChangesAsync(cancellationToken); // aquí recién se ejecuta el INSERT

        return CreatedAtAction(nameof(Get), new { id = treatment.Id }, TreatmentDto.FromEntity(treatment));
    }

    /// <summary>PUT /api/treatments/{id}</summary>
    [HttpPut("{id:guid}")]
    public async Task<ActionResult<TreatmentDto>> Update(Guid id, TreatmentRequest request, CancellationToken cancellationToken)
    {
        // Sin AsNoTracking: EF Core vigila el objeto y al guardar genera un UPDATE solo de lo que cambió.
        var treatment = await db.Treatments
            .Include(entry => entry.Consumption)
            .FirstOrDefaultAsync(item => item.Id == id, cancellationToken);
        if (treatment is null) return TreatmentNotFound();

        if (!await ValidateConsumptionAsync(request, cancellationToken)) return this.ValidationError(ModelState);

        request.ApplyTo(treatment);
        SyncConsumption(treatment, request);
        await db.SaveChangesAsync(cancellationToken);

        return TreatmentDto.FromEntity(treatment);
    }

    /// <summary>DELETE /api/treatments/{id} → 204 No Content.</summary>
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var treatment = await db.Treatments.FirstOrDefaultAsync(item => item.Id == id, cancellationToken);
        if (treatment is null) return TreatmentNotFound();

        // Un tratamiento que ya se usó no se borra: se perdería de dónde salieron las citas
        // y los tratamientos realizados (Finanzas cobra con ellos). Se sugiere desactivarlo.
        if (await IsInUseAsync(id, cancellationToken))
        {
            return Problem(
                statusCode: StatusCodes.Status409Conflict,
                title: "Este tratamiento ya se usó. Desactívalo en su lugar.");
        }

        db.Treatments.Remove(treatment);
        await db.SaveChangesAsync(cancellationToken);

        return NoContent();
    }

    /// <summary>
    /// Revisa contra la base que cada insumo exista y no se repita. Los errores van con el nombre del campo
    /// del formulario ("consumption[1].itemId") para que el frontend marque la línea correcta.
    /// </summary>
    private async Task<bool> ValidateConsumptionAsync(TreatmentRequest request, CancellationToken cancellationToken)
    {
        var lines = request.Consumption ?? [];
        var itemIds = lines.Select(line => line.ItemId!.Value).Distinct().ToList();
        var existingIds = itemIds.Count == 0
            ? []
            : await db.InventoryItems
                .Where(item => itemIds.Contains(item.Id))
                .Select(item => item.Id)
                .ToListAsync(cancellationToken);

        var seen = new HashSet<Guid>();
        for (var index = 0; index < lines.Count; index++)
        {
            var itemId = lines[index].ItemId!.Value;
            if (!existingIds.Contains(itemId))
                ModelState.AddModelError($"consumption[{index}].itemId", "El insumo no existe");
            else if (!seen.Add(itemId))
                ModelState.AddModelError($"consumption[{index}].itemId", "Insumo repetido: suma las cantidades en una sola línea");
        }

        return ModelState.IsValid;
    }

    /// <summary>
    /// Deja los consumos del tratamiento iguales a los del formulario: actualiza la cantidad de los que siguen,
    /// agrega los nuevos y quita los que ya no están. EF Core genera los UPDATE, INSERT y DELETE al guardar.
    /// </summary>
    private static void SyncConsumption(Treatment treatment, TreatmentRequest request)
    {
        var wanted = (request.Consumption ?? []).ToDictionary(line => line.ItemId!.Value, line => line.Quantity);

        treatment.Consumption.RemoveAll(consumption => !wanted.ContainsKey(consumption.ItemId));

        foreach (var (itemId, quantity) in wanted)
        {
            var existing = treatment.Consumption.Find(consumption => consumption.ItemId == itemId);
            if (existing is not null)
                existing.Quantity = quantity;
            else
                treatment.Consumption.Add(new TreatmentConsumption { TreatmentId = treatment.Id, ItemId = itemId, Quantity = quantity });
        }
    }

    /// <summary>
    /// GET /api/treatments/{id}/assignments → tratamientos realizados de este tratamiento, del más reciente al
    /// más antiguo ("Pacientes que recibieron este tratamiento").
    /// </summary>
    [HttpGet("{id:guid}/assignments")]
    public async Task<ActionResult<List<TreatmentAssignmentDto>>> ListAssignments(Guid id, CancellationToken cancellationToken)
    {
        if (!await db.Treatments.AnyAsync(treatment => treatment.Id == id, cancellationToken)) return TreatmentNotFound();

        var assignments = await db.TreatmentAssignments.AsNoTracking()
            .Where(assignment => assignment.TreatmentId == id)
            .OrderByDescending(assignment => assignment.StartDate)
            .ThenByDescending(assignment => assignment.CreatedAt)
            .ToListAsync(cancellationToken);

        return assignments.Select(TreatmentAssignmentDto.FromEntity).ToList();
    }

    /// <summary>
    /// ¿Aparece en alguna cita, en un tratamiento realizado, o en el plan o los tratamientos de una historia
    /// clínica? Los dos últimos están dentro de columnas jsonb: se buscan con el operador @> de PostgreSQL
    /// ("el arreglo contiene un objeto con este treatmentId").
    /// </summary>
    private async Task<bool> IsInUseAsync(Guid treatmentId, CancellationToken cancellationToken)
    {
        if (await db.Appointments.AnyAsync(appointment => appointment.TreatmentId == treatmentId, cancellationToken)
            || await db.TreatmentAssignments.AnyAsync(assignment => assignment.TreatmentId == treatmentId, cancellationToken))
        {
            return true;
        }

        var reference = $$"""[{"treatmentId":"{{treatmentId}}"}]""";
        return await db.Database
            .SqlQuery<bool>($"""
                SELECT EXISTS (SELECT 1 FROM clinical_records WHERE plan @> {reference}::jsonb)
                    OR EXISTS (SELECT 1 FROM clinical_encounters WHERE performed_treatments @> {reference}::jsonb) AS "Value"
                """)
            .SingleAsync(cancellationToken);
    }

    /// <summary>404 en formato ProblemDetails: el frontend muestra el "title" como mensaje.</summary>
    private ObjectResult TreatmentNotFound() =>
        Problem(statusCode: StatusCodes.Status404NotFound, title: "Tratamiento no encontrado");
}
