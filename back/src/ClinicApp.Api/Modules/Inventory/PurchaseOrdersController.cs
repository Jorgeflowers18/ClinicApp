using ClinicApp.Api.Common;
using ClinicApp.Api.Data;
using ClinicApp.Api.Modules.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ClinicApp.Api.Modules.Inventory;

/// <summary>Órdenes de compra: /api/inventory/purchase-orders (sin paginar: volumen bajo).</summary>
[ApiController]
[Route("api/inventory/purchase-orders")]
[Authorize(Roles = Roles.AdminYRecepcion)]
public class PurchaseOrdersController(AppDbContext db, StockService stock) : ControllerBase
{
    /// <summary>GET /api/inventory/purchase-orders → de la más reciente a la más antigua, con sus líneas.</summary>
    [HttpGet]
    public async Task<List<PurchaseOrderDto>> List(CancellationToken cancellationToken)
    {
        var orders = await db.PurchaseOrders.AsNoTracking()
            .Include(order => order.Lines) // trae las líneas en la misma consulta (JOIN)
            .OrderByDescending(order => order.CreatedAt)
            .ToListAsync(cancellationToken);

        return orders.Select(PurchaseOrderDto.FromEntity).ToList();
    }

    /// <summary>POST /api/inventory/purchase-orders → 201, estado "pendiente". No mueve stock hasta recibirla.</summary>
    [HttpPost]
    public async Task<ActionResult<PurchaseOrderDto>> Create(PurchaseOrderRequest request, CancellationToken cancellationToken)
    {
        // El formato ya lo validó [ApiController]; aquí se valida contra la base.
        var supplierId = request.SupplierId!.Value;
        if (!await db.Suppliers.AnyAsync(supplier => supplier.Id == supplierId, cancellationToken))
        {
            ModelState.AddModelError("supplierId", "El proveedor no existe");
        }

        var itemIds = request.Lines.Select(line => line.ItemId!.Value).Distinct().ToList();
        var existingIds = await db.InventoryItems
            .Where(item => itemIds.Contains(item.Id))
            .Select(item => item.Id)
            .ToListAsync(cancellationToken);

        for (var index = 0; index < request.Lines.Count; index++)
        {
            if (!existingIds.Contains(request.Lines[index].ItemId!.Value))
            {
                ModelState.AddModelError($"lines[{index}].itemId", "El insumo no existe");
            }
        }

        if (!ModelState.IsValid) return this.ValidationError(ModelState);

        var order = new PurchaseOrder
        {
            Id = Guid.CreateVersion7(),
            SupplierId = supplierId,
            Status = PurchaseOrderStatuses.Pendiente,
            Notes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim(),
            CreatedByUserId = User.GetUserId(),
            CreatedAt = DateTime.UtcNow,
            Lines = request.Lines.Select((line, index) => new PurchaseOrderLine
            {
                Id = Guid.CreateVersion7(),
                Position = index,
                ItemId = line.ItemId!.Value,
                Quantity = line.Quantity,
                UnitCost = line.UnitCost,
                ExpirationDate = Validation.ParseDate(line.ExpirationDate),
            }).ToList(),
        };

        db.PurchaseOrders.Add(order); // también inserta las líneas
        await db.SaveChangesAsync(cancellationToken);

        return StatusCode(StatusCodes.Status201Created, PurchaseOrderDto.FromEntity(order));
    }

    /// <summary>
    /// POST /api/inventory/purchase-orders/{id}/receive → por cada línea, un lote y un movimiento de entrada.
    /// Todo en una transacción: si algo falla, no se recibe nada.
    /// </summary>
    [HttpPost("{id:guid}/receive")]
    public async Task<ActionResult<PurchaseOrderDto>> Receive(Guid id, CancellationToken cancellationToken)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);

        // Bloquea la orden: si dos personas pulsan "Recibir" a la vez, la segunda espera
        // y luego ve la orden ya recibida (409), en lugar de sumar el stock dos veces.
        var order = await LockOrderAsync(id, cancellationToken);
        if (order is null) return OrderNotFound();
        if (order.Status != PurchaseOrderStatuses.Pendiente) return NotPending("Solo se pueden recibir órdenes pendientes");

        await db.Entry(order).Collection(entry => entry.Lines).LoadAsync(cancellationToken);

        var items = (await stock.LockItemsAsync(order.Lines.Select(line => line.ItemId).ToList(), cancellationToken))
            .ToDictionary(item => item.Id);

        var info = new MovementInfo($"Recepción de orden de compra #{order.Id}", User.GetUserId(), PurchaseOrderId: order.Id);
        foreach (var line in order.Lines.OrderBy(line => line.Position))
        {
            stock.AddEntry(items[line.ItemId], line.Quantity, line.ExpirationDate, info);
        }

        order.Status = PurchaseOrderStatuses.Recibida;
        order.ReceivedAt = DateTime.UtcNow;

        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        return PurchaseOrderDto.FromEntity(order);
    }

    /// <summary>POST /api/inventory/purchase-orders/{id}/cancel → solo si está pendiente. No mueve stock.</summary>
    [HttpPost("{id:guid}/cancel")]
    public async Task<ActionResult<PurchaseOrderDto>> Cancel(Guid id, CancellationToken cancellationToken)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);

        var order = await LockOrderAsync(id, cancellationToken);
        if (order is null) return OrderNotFound();
        if (order.Status != PurchaseOrderStatuses.Pendiente) return NotPending("Solo se pueden cancelar órdenes pendientes");

        await db.Entry(order).Collection(entry => entry.Lines).LoadAsync(cancellationToken);
        order.Status = PurchaseOrderStatuses.Cancelada;

        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        return PurchaseOrderDto.FromEntity(order);
    }

    /// <summary>Lee la orden y bloquea su fila hasta el final de la transacción (SELECT ... FOR UPDATE).</summary>
    private async Task<PurchaseOrder?> LockOrderAsync(Guid id, CancellationToken cancellationToken)
    {
        var orders = await db.PurchaseOrders
            .FromSql($"SELECT * FROM purchase_orders WHERE id = {id} FOR UPDATE")
            .ToListAsync(cancellationToken);
        return orders.SingleOrDefault();
    }

    private ObjectResult OrderNotFound() =>
        Problem(statusCode: StatusCodes.Status404NotFound, title: "Orden de compra no encontrada");

    /// <summary>409: la orden ya no está pendiente (conflicto con su estado actual).</summary>
    private ObjectResult NotPending(string title) =>
        Problem(statusCode: StatusCodes.Status409Conflict, title: title);
}
