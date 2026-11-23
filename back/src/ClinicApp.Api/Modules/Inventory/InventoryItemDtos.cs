using System.ComponentModel.DataAnnotations;
using ClinicApp.Api.Common;

namespace ClinicApp.Api.Modules.Inventory;

/// <summary>Insumo: la forma de <c>InventoryItem</c> en el frontend (inventory.types.ts).</summary>
public record InventoryItemDto(
    Guid Id,
    string Name,
    string Category,
    string Unit,
    string Kind,
    int MinStock,
    decimal UnitCost,
    string? Supplier,
    int Stock,
    DateTime CreatedAt)
{
    public static InventoryItemDto FromEntity(InventoryItem item) => new(
        item.Id, item.Name, item.Category, item.Unit, item.Kind,
        item.MinStock, item.UnitCost, item.Supplier, item.Stock, item.CreatedAt);
}

/// <summary>Insumo para los selectores (tratamientos, órdenes de compra, esterilización): solo lo que muestran.</summary>
public record InventoryItemOptionDto(Guid Id, string Name, string Unit, string Kind);

/// <summary>
/// Crear o editar un insumo: la forma de <c>InventoryItemFormValues</c>.
/// No trae el stock: el stock solo cambia con movimientos.
/// </summary>
public class InventoryItemRequest
{
    [Required(ErrorMessage = "El nombre es obligatorio")]
    [MinLength(2, ErrorMessage = "Mínimo 2 caracteres")]
    [MaxLength(120, ErrorMessage = "Máximo 120 caracteres")]
    public string Name { get; set; } = "";

    [Required(ErrorMessage = "La categoría es obligatoria")]
    [MinLength(2, ErrorMessage = "Mínimo 2 caracteres")]
    [MaxLength(80, ErrorMessage = "Máximo 80 caracteres")]
    public string Category { get; set; } = "";

    [Required(ErrorMessage = "La unidad es obligatoria")]
    [MaxLength(30, ErrorMessage = "Máximo 30 caracteres")]
    public string Unit { get; set; } = "";

    // AllowedValues: solo acepta uno de los valores de la lista.
    [Required(ErrorMessage = "Selecciona un tipo de insumo")]
    [AllowedValues(ItemKinds.Consumible, ItemKinds.Instrumental, ErrorMessage = "Selecciona un tipo de insumo")]
    public string Kind { get; set; } = "";

    [Range(0, 1_000_000, ErrorMessage = "No puede ser negativo")]
    public int MinStock { get; set; }

    [Range(typeof(decimal), "0", "99999999.99", ParseLimitsInInvariantCulture = true,
        ErrorMessage = "No puede ser negativo")]
    public decimal UnitCost { get; set; }

    [MaxLength(120, ErrorMessage = "Máximo 120 caracteres")]
    public string? Supplier { get; set; }

    public void ApplyTo(InventoryItem item)
    {
        item.Name = Name.Trim();
        item.Category = Category.Trim();
        item.Unit = Unit.Trim();
        item.Kind = Kind;
        item.MinStock = MinStock;
        item.UnitCost = UnitCost;
        item.Supplier = string.IsNullOrWhiteSpace(Supplier) ? null : Supplier.Trim();
    }
}

/// <summary>Movimiento de stock: la forma de <c>StockMovement</c>.</summary>
public record StockMovementDto(
    Guid Id,
    Guid ItemId,
    string Type,
    int Quantity,
    string Reason,
    Guid? LotId,
    Guid? TreatmentAssignmentId,
    Guid? PatientId,
    Guid? PurchaseOrderId,
    DateTime CreatedAt)
{
    public static StockMovementDto FromEntity(StockMovement movement) => new(
        movement.Id, movement.ItemId, movement.Type, movement.Quantity, movement.Reason,
        movement.LotId, movement.TreatmentAssignmentId, movement.PatientId, movement.PurchaseOrderId,
        movement.CreatedAt);
}

/// <summary>Registrar una entrada o salida manual: la forma de <c>MovementFormValues</c>.</summary>
public class MovementRequest
{
    [Required(ErrorMessage = "Selecciona un tipo de movimiento")]
    [AllowedValues(MovementTypes.Entrada, MovementTypes.Salida, ErrorMessage = "Selecciona un tipo de movimiento")]
    public string Type { get; set; } = "";

    [Range(1, 1_000_000, ErrorMessage = "Mínimo 1")]
    public int Quantity { get; set; }

    [Required(ErrorMessage = "Describe el motivo del movimiento")]
    [MinLength(3, ErrorMessage = "Describe el motivo del movimiento")]
    [MaxLength(300, ErrorMessage = "Máximo 300 caracteres")]
    public string Reason { get; set; } = "";

    /// <summary>"YYYY-MM-DD" o vacío. Solo se usa en las entradas (vencimiento del lote nuevo).</summary>
    [IsoDate]
    public string? ExpirationDate { get; set; }
}

/// <summary>Lote de stock: la forma de <c>StockLot</c>. DateOnly sale en el JSON como "YYYY-MM-DD".</summary>
public record StockLotDto(
    Guid Id,
    Guid ItemId,
    int Quantity,
    DateOnly? ExpirationDate,
    Guid? PurchaseOrderId,
    DateTime ReceivedAt)
{
    public static StockLotDto FromEntity(StockLot lot) => new(
        lot.Id, lot.ItemId, lot.Quantity, lot.ExpirationDate, lot.PurchaseOrderId, lot.ReceivedAt);
}
