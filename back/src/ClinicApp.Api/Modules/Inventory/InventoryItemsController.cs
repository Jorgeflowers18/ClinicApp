using ClinicApp.Api.Common;
using ClinicApp.Api.Data;
using ClinicApp.Api.Modules.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ClinicApp.Api.Modules.Inventory;

/// <summary>
/// Insumos, sus movimientos y sus lotes: /api/inventory/items
///
/// Roles: los tres pueden <b>leer</b> insumos (los formularios de tratamientos, que usa el médico,
/// cargan la lista). Todo lo demás es solo para admin y recepción.
/// Varios [Authorize] se suman: la clase pide "cualquier rol" y cada acción de escritura pide además
/// admin o recepción.
/// </summary>
[ApiController]
[Route("api/inventory/items")]
[Authorize(Roles = Roles.Todos)]
public class InventoryItemsController(AppDbContext db, StockService stock) : ControllerBase
{
    /// <summary>GET /api/inventory/items?page=1&amp;pageSize=10&amp;search=guantes</summary>
    [HttpGet]
    public async Task<PagedResult<InventoryItemDto>> List([FromQuery] PageQuery query, CancellationToken cancellationToken)
    {
        var items = db.InventoryItems.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            // Igual que el mock: busca en nombre, categoría y proveedor.
            var pattern = $"%{query.Search.Trim()}%";
            items = items.Where(item =>
                EF.Functions.ILike(item.Name, pattern)
                || EF.Functions.ILike(item.Category, pattern)
                || (item.Supplier != null && EF.Functions.ILike(item.Supplier, pattern)));
        }

        var page = await items.OrderBy(item => item.Name).ThenBy(item => item.Id).ToPagedResultAsync(query, cancellationToken);

        return new PagedResult<InventoryItemDto>(
            page.Items.Select(InventoryItemDto.FromEntity).ToList(),
            page.Page, page.PageSize, page.TotalItems, page.TotalPages);
    }

    /// <summary>
    /// GET /api/inventory/items/options → todos los insumos, sin paginar y por nombre, con solo
    /// <c>{ id, name, unit, kind }</c>: una sola petición para los selectores en vez de juntar páginas de 100.
    /// </summary>
    [HttpGet("options")]
    public async Task<List<InventoryItemOptionDto>> Options(CancellationToken cancellationToken) =>
        await db.InventoryItems.AsNoTracking()
            .OrderBy(item => item.Name).ThenBy(item => item.Id)
            .Select(item => new InventoryItemOptionDto(item.Id, item.Name, item.Unit, item.Kind))
            .ToListAsync(cancellationToken);

    /// <summary>GET /api/inventory/items/{id}</summary>
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<InventoryItemDto>> Get(Guid id, CancellationToken cancellationToken)
    {
        var item = await db.InventoryItems.AsNoTracking().FirstOrDefaultAsync(entry => entry.Id == id, cancellationToken);
        if (item is null) return ItemNotFound();

        return InventoryItemDto.FromEntity(item);
    }

    /// <summary>POST /api/inventory/items → 201. El insumo nace con stock 0.</summary>
    [HttpPost]
    [Authorize(Roles = Roles.AdminYRecepcion)]
    public async Task<ActionResult<InventoryItemDto>> Create(InventoryItemRequest request, CancellationToken cancellationToken)
    {
        var item = new InventoryItem { Id = Guid.CreateVersion7(), Stock = 0, CreatedAt = DateTime.UtcNow };
        request.ApplyTo(item);

        db.InventoryItems.Add(item);
        await db.SaveChangesAsync(cancellationToken);

        return CreatedAtAction(nameof(Get), new { id = item.Id }, InventoryItemDto.FromEntity(item));
    }

    /// <summary>
    /// PUT /api/inventory/items/{id}. No toca el stock: EF Core solo actualiza las columnas que cambiaron,
    /// así que una salida que ocurra al mismo tiempo no se pierde.
    /// </summary>
    [HttpPut("{id:guid}")]
    [Authorize(Roles = Roles.AdminYRecepcion)]
    public async Task<ActionResult<InventoryItemDto>> Update(Guid id, InventoryItemRequest request, CancellationToken cancellationToken)
    {
        var item = await db.InventoryItems.FirstOrDefaultAsync(entry => entry.Id == id, cancellationToken);
        if (item is null) return ItemNotFound();

        request.ApplyTo(item);
        await db.SaveChangesAsync(cancellationToken);

        return InventoryItemDto.FromEntity(item);
    }

    /// <summary>
    /// DELETE /api/inventory/items/{id} → 204.
    /// 409 si el insumo tiene historia (movimientos, órdenes, ciclos o tratamientos): borrarlo perdería el historial.
    /// </summary>
    [HttpDelete("{id:guid}")]
    [Authorize(Roles = Roles.AdminYRecepcion)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        // Bloqueo: nadie registra un movimiento de este insumo mientras se decide si se puede borrar.
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        var item = await stock.LockItemAsync(id, cancellationToken);
        if (item is null) return ItemNotFound();

        var inUse =
            await db.StockMovements.AnyAsync(movement => movement.ItemId == id, cancellationToken)
            || await db.StockLots.AnyAsync(lot => lot.ItemId == id, cancellationToken)
            || await db.PurchaseOrderLines.AnyAsync(line => line.ItemId == id, cancellationToken)
            || await db.SterilizationCycleItems.AnyAsync(cycleItem => cycleItem.ItemId == id, cancellationToken)
            || await db.TreatmentConsumptions.AnyAsync(consumption => consumption.ItemId == id, cancellationToken);

        if (inUse)
        {
            return Problem(
                statusCode: StatusCodes.Status409Conflict,
                title: "No se puede eliminar: el insumo tiene movimientos o está en uso",
                detail: "El insumo aparece en movimientos de stock, órdenes de compra, ciclos de esterilización o tratamientos.");
        }

        db.InventoryItems.Remove(item);
        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        return NoContent();
    }

    /// <summary>GET /api/inventory/items/{id}/movements → del más reciente al más antiguo.</summary>
    [HttpGet("{id:guid}/movements")]
    [Authorize(Roles = Roles.AdminYRecepcion)]
    public async Task<ActionResult<List<StockMovementDto>>> ListMovements(Guid id, CancellationToken cancellationToken)
    {
        if (!await db.InventoryItems.AnyAsync(item => item.Id == id, cancellationToken)) return ItemNotFound();

        var movements = await db.StockMovements.AsNoTracking()
            .Where(movement => movement.ItemId == id)
            .OrderByDescending(movement => movement.CreatedAt)
            .ThenByDescending(movement => movement.Id) // UUID v7: crece con el tiempo
            .ToListAsync(cancellationToken);

        return movements.Select(StockMovementDto.FromEntity).ToList();
    }

    /// <summary>
    /// POST /api/inventory/items/{id}/movements → 201 con el movimiento.
    /// Entrada: crea un lote. Salida: descuenta por FEFO; si abarca varios lotes crea un movimiento
    /// por lote y devuelve el primero (el frontend vuelve a pedir la lista después).
    /// </summary>
    [HttpPost("{id:guid}/movements")]
    [Authorize(Roles = Roles.AdminYRecepcion)]
    public async Task<ActionResult<StockMovementDto>> RegisterMovement(Guid id, MovementRequest request, CancellationToken cancellationToken)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        var item = await stock.LockItemAsync(id, cancellationToken);
        if (item is null) return ItemNotFound();

        var info = new MovementInfo(request.Reason.Trim(), User.GetUserId());
        StockMovement movement;

        if (request.Type == MovementTypes.Entrada)
        {
            movement = stock.AddEntry(item, request.Quantity, Validation.ParseDate(request.ExpirationDate), info);
        }
        else
        {
            // Salida manual: estricta. Con la fila bloqueada, item.Stock es el valor real en este momento.
            if (request.Quantity > item.Stock)
            {
                ModelState.AddModelError("quantity", $"No puede superar el stock disponible ({item.Stock})");
                return this.ValidationError(ModelState, $"Stock insuficiente. Disponible: {item.Stock}");
            }

            var movements = await stock.ConsumeAsync(item, request.Quantity, info, cancellationToken);
            movement = movements[0];
        }

        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        return StatusCode(StatusCodes.Status201Created, StockMovementDto.FromEntity(movement));
    }

    /// <summary>GET /api/inventory/items/{id}/lots → en orden FEFO (el próximo a salir primero).</summary>
    [HttpGet("{id:guid}/lots")]
    [Authorize(Roles = Roles.AdminYRecepcion)]
    public async Task<ActionResult<List<StockLotDto>>> ListLots(Guid id, CancellationToken cancellationToken)
    {
        if (!await db.InventoryItems.AnyAsync(item => item.Id == id, cancellationToken)) return ItemNotFound();

        var lots = await db.StockLots.AsNoTracking()
            .Where(lot => lot.ItemId == id)
            .OrderByFefo()
            .ToListAsync(cancellationToken);

        return lots.Select(StockLotDto.FromEntity).ToList();
    }

    private ObjectResult ItemNotFound() =>
        Problem(statusCode: StatusCodes.Status404NotFound, title: "Insumo no encontrado");
}
