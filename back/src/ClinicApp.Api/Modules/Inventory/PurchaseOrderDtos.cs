using System.ComponentModel.DataAnnotations;
using ClinicApp.Api.Common;

namespace ClinicApp.Api.Modules.Inventory;

/// <summary>Orden de compra: la forma de <c>PurchaseOrder</c> en el frontend, con sus líneas.</summary>
public record PurchaseOrderDto(
    Guid Id,
    Guid SupplierId,
    string Status,
    string? Notes,
    IReadOnlyList<PurchaseOrderLineDto> Lines,
    DateTime CreatedAt,
    DateTime? ReceivedAt)
{
    public static PurchaseOrderDto FromEntity(PurchaseOrder order) => new(
        order.Id,
        order.SupplierId,
        order.Status,
        order.Notes,
        order.Lines.OrderBy(line => line.Position).Select(PurchaseOrderLineDto.FromEntity).ToList(),
        order.CreatedAt,
        order.ReceivedAt);
}

public record PurchaseOrderLineDto(Guid ItemId, int Quantity, decimal UnitCost, DateOnly? ExpirationDate)
{
    public static PurchaseOrderLineDto FromEntity(PurchaseOrderLine line) =>
        new(line.ItemId, line.Quantity, line.UnitCost, line.ExpirationDate);
}

/// <summary>Crear una orden: la forma de <c>PurchaseOrderFormValues</c>.</summary>
public class PurchaseOrderRequest
{
    // Guid? + [Required]: si no viene, el error dice "Selecciona un proveedor" (con Guid a secas llegaría 0000...).
    [Required(ErrorMessage = "Selecciona un proveedor")]
    public Guid? SupplierId { get; set; }

    // Las reglas de cada línea se validan solas: los errores salen como "lines[0].quantity".
    [Required(ErrorMessage = "Agrega al menos una línea")]
    [MinLength(1, ErrorMessage = "Agrega al menos una línea")]
    [MaxLength(100, ErrorMessage = "Máximo 100 líneas")]
    public List<PurchaseOrderLineRequest> Lines { get; set; } = [];

    [MaxLength(1000, ErrorMessage = "Máximo 1000 caracteres")]
    public string? Notes { get; set; }
}

public class PurchaseOrderLineRequest
{
    [Required(ErrorMessage = "Selecciona un insumo")]
    public Guid? ItemId { get; set; }

    [Range(1, 1_000_000, ErrorMessage = "Mínimo 1")]
    public int Quantity { get; set; }

    [Range(typeof(decimal), "0", "99999999.99", ParseLimitsInInvariantCulture = true,
        ErrorMessage = "No puede ser negativo")]
    public decimal UnitCost { get; set; }

    /// <summary>"YYYY-MM-DD" o vacío: vencimiento del lote que se creará al recibir la orden.</summary>
    [IsoDate]
    public string? ExpirationDate { get; set; }
}
