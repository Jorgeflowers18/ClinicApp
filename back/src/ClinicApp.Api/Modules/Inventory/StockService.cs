using ClinicApp.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace ClinicApp.Api.Modules.Inventory;

/// <summary>Datos que se copian en cada movimiento generado (motivo, origen y autor).</summary>
public record MovementInfo(
    string Reason,
    Guid? CreatedByUserId,
    Guid? PurchaseOrderId = null,
    Guid? TreatmentAssignmentId = null,
    Guid? PatientId = null);

/// <summary>
/// Única pieza que cambia el stock. Mantiene siempre <c>inventory_items.stock = Σ stock_lots.quantity</c>.
///
/// Cómo se usa (dentro de una transacción, para que nadie más toque el insumo mientras tanto):
/// <code>
/// await using var transaction = await db.Database.BeginTransactionAsync(ct);
/// var item = await stock.LockItemAsync(id, ct);   // SELECT ... FOR UPDATE
/// stock.AddEntry(item, ...) o await stock.ConsumeAsync(item, ...)
/// await db.SaveChangesAsync(ct);
/// await transaction.CommitAsync(ct);               // aquí se libera el bloqueo
/// </code>
/// Los métodos solo agregan cambios al DbContext; quien llama guarda y confirma.
/// </summary>
public class StockService(AppDbContext db, ILogger<StockService> logger)
{
    /// <summary>
    /// Lee el insumo y bloquea su fila hasta el final de la transacción.
    /// Si otra petición ya lo bloqueó, espera a que termine y luego lee el stock actualizado.
    /// Así dos salidas al mismo tiempo no pueden dejar el stock negativo.
    /// </summary>
    public async Task<InventoryItem?> LockItemAsync(Guid itemId, CancellationToken cancellationToken)
    {
        var items = await LockItemsAsync([itemId], cancellationToken);
        return items.Count == 0 ? null : items[0];
    }

    /// <summary>
    /// Bloquea varios insumos a la vez, siempre en el mismo orden (por id), para que dos operaciones
    /// que bloquean los mismos insumos no se queden esperándose mutuamente (deadlock).
    /// </summary>
    public async Task<IReadOnlyList<InventoryItem>> LockItemsAsync(IReadOnlyCollection<Guid> itemIds, CancellationToken cancellationToken)
    {
        EnsureTransaction();
        var ids = itemIds.Distinct().ToArray();

        // FromSql arma una consulta con parámetros (no concatena texto: sin riesgo de inyección SQL).
        // Se ejecuta tal cual, sin envolverla, para que el FOR UPDATE se aplique.
        return await db.InventoryItems
            .FromSql($"SELECT * FROM inventory_items WHERE id = ANY({ids}) ORDER BY id FOR UPDATE")
            .ToListAsync(cancellationToken);
    }

    /// <summary>Entrada: crea un lote, suma al stock y registra el movimiento enlazado al lote.</summary>
    public StockMovement AddEntry(InventoryItem item, int quantity, DateOnly? expirationDate, MovementInfo info)
    {
        ArgumentOutOfRangeException.ThrowIfNegativeOrZero(quantity);
        EnsureTransaction();

        var now = DateTime.UtcNow;
        var lot = new StockLot
        {
            Id = Guid.CreateVersion7(),
            ItemId = item.Id,
            Quantity = quantity,
            ExpirationDate = expirationDate,
            PurchaseOrderId = info.PurchaseOrderId,
            ReceivedAt = now,
        };
        var movement = NewMovement(item.Id, MovementTypes.Entrada, quantity, lot.Id, info, now);

        item.Stock += quantity;
        db.StockLots.Add(lot);
        db.StockMovements.Add(movement);
        return movement;
    }

    /// <summary>
    /// Salida por FEFO: descuenta de los lotes que vencen primero y crea un movimiento por cada lote tocado.
    ///
    /// Es <b>tolerante</b>: si el stock no alcanza, descuenta lo que hay y deja un aviso en el log,
    /// porque el consumo de un tratamiento ya realizado no debe bloquearse por un descuadre de inventario.
    /// La salida manual valida antes que la cantidad no supere <c>item.Stock</c> (ver InventoryItemsController).
    /// </summary>
    public async Task<IReadOnlyList<StockMovement>> ConsumeAsync(
        InventoryItem item, int quantity, MovementInfo info, CancellationToken cancellationToken)
    {
        ArgumentOutOfRangeException.ThrowIfNegativeOrZero(quantity);
        EnsureTransaction();

        var lots = await db.StockLots
            .Where(lot => lot.ItemId == item.Id && lot.Quantity > 0)
            .OrderByFefo()
            .ToListAsync(cancellationToken);

        var now = DateTime.UtcNow;
        var movements = new List<StockMovement>();
        var remaining = quantity;

        foreach (var lot in lots)
        {
            if (remaining == 0) break;

            var taken = Math.Min(lot.Quantity, remaining);
            lot.Quantity -= taken;
            remaining -= taken;

            var movement = NewMovement(item.Id, MovementTypes.Salida, taken, lot.Id, info, now);
            db.StockMovements.Add(movement);
            movements.Add(movement);
        }

        item.Stock -= quantity - remaining;

        if (remaining > 0)
        {
            logger.LogWarning(
                "Stock insuficiente al consumir {Quantity} de {ItemId} ({ItemName}): faltaron {Missing}. Motivo: {Reason}",
                quantity, item.Id, item.Name, remaining, info.Reason);
        }

        return movements;
    }

    private static StockMovement NewMovement(Guid itemId, string type, int quantity, Guid lotId, MovementInfo info, DateTime now) => new()
    {
        Id = Guid.CreateVersion7(),
        ItemId = itemId,
        Type = type,
        Quantity = quantity,
        Reason = info.Reason,
        LotId = lotId,
        PurchaseOrderId = info.PurchaseOrderId,
        TreatmentAssignmentId = info.TreatmentAssignmentId,
        PatientId = info.PatientId,
        CreatedByUserId = info.CreatedByUserId,
        CreatedAt = now,
    };

    // Sin transacción, el FOR UPDATE se liberaría en cuanto termina la consulta y no protegería nada.
    private void EnsureTransaction()
    {
        if (db.Database.CurrentTransaction is null)
            throw new InvalidOperationException("Las operaciones de stock deben ejecutarse dentro de una transacción.");
    }
}

public static class StockLotQueryExtensions
{
    /// <summary>
    /// Orden FEFO: primero el que vence antes; los que no vencen van al final;
    /// entre iguales, el que llegó primero.
    /// </summary>
    public static IOrderedQueryable<StockLot> OrderByFefo(this IQueryable<StockLot> lots) =>
        lots.OrderBy(lot => lot.ExpirationDate == null)
            .ThenBy(lot => lot.ExpirationDate)
            .ThenBy(lot => lot.ReceivedAt)
            .ThenBy(lot => lot.Id);
}
