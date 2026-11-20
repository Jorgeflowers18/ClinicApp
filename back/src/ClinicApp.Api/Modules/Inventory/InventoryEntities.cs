namespace ClinicApp.Api.Modules.Inventory;

/// <summary>Valores permitidos de los campos de texto con opciones fijas (iguales a los del frontend).</summary>
public static class ItemKinds
{
    public const string Consumible = "consumible";
    public const string Instrumental = "instrumental";
    public static readonly IReadOnlyList<string> All = [Consumible, Instrumental];
}

public static class MovementTypes
{
    public const string Entrada = "entrada";
    public const string Salida = "salida";
    public static readonly IReadOnlyList<string> All = [Entrada, Salida];
}

public static class PurchaseOrderStatuses
{
    public const string Pendiente = "pendiente";
    public const string Recibida = "recibida";
    public const string Cancelada = "cancelada";
    public static readonly IReadOnlyList<string> All = [Pendiente, Recibida, Cancelada];
}

public static class SterilizationResults
{
    public const string Aprobado = "aprobado";
    public const string Fallido = "fallido";
    public static readonly IReadOnlyList<string> All = [Aprobado, Fallido];
}

/// <summary>Insumo del inventario: consumible (guantes, anestesia) o instrumental esterilizable.</summary>
public class InventoryItem
{
    public Guid Id { get; set; }
    public string Name { get; set; } = "";
    public string Category { get; set; } = "";
    public string Unit { get; set; } = "";
    public string Kind { get; set; } = ItemKinds.Consumible;

    /// <summary>Si <c>Stock &lt;= MinStock</c>, el insumo aparece en "Stock crítico".</summary>
    public int MinStock { get; set; }

    public decimal UnitCost { get; set; }

    /// <summary>Texto libre, como en el formulario del frontend (no es la tabla de proveedores).</summary>
    public string? Supplier { get; set; }

    /// <summary>
    /// Stock actual = suma de las cantidades de sus lotes. Solo lo cambia <see cref="StockService"/>,
    /// nunca el formulario del insumo.
    /// </summary>
    public int Stock { get; set; }

    public DateTime CreatedAt { get; set; }
}

/// <summary>
/// Lote de stock: se crea en cada entrada (manual o al recibir una orden de compra).
/// Las salidas lo van descontando por FEFO (primero en vencer, primero en salir).
/// </summary>
public class StockLot
{
    public Guid Id { get; set; }
    public Guid ItemId { get; set; }
    public InventoryItem Item { get; set; } = null!;

    /// <summary>Cantidad que todavía queda en el lote.</summary>
    public int Quantity { get; set; }

    /// <summary>DateOnly: fecha sin hora (columna "date"). Sin vencimiento = sale al final.</summary>
    public DateOnly? ExpirationDate { get; set; }

    public Guid? PurchaseOrderId { get; set; }
    public DateTime ReceivedAt { get; set; }
}

/// <summary>Historial de entradas y salidas. No se edita ni se borra.</summary>
public class StockMovement
{
    public Guid Id { get; set; }
    public Guid ItemId { get; set; }
    public string Type { get; set; } = MovementTypes.Entrada;
    public int Quantity { get; set; }
    public string Reason { get; set; } = "";

    /// <summary>Lote creado (entrada) o descontado (salida).</summary>
    public Guid? LotId { get; set; }

    public Guid? PurchaseOrderId { get; set; }

    // Sin llave foránea hasta que existan las tablas de asignaciones y pacientes.
    public Guid? TreatmentAssignmentId { get; set; }
    public Guid? PatientId { get; set; }

    /// <summary>Usuario que registró el movimiento (auditoría; no se expone en la API).</summary>
    public Guid? CreatedByUserId { get; set; }

    public DateTime CreatedAt { get; set; }
}

public class Supplier
{
    public Guid Id { get; set; }
    public string Name { get; set; } = "";
    public string? ContactName { get; set; }
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public string? Address { get; set; }
    public string? Notes { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class PurchaseOrder
{
    public Guid Id { get; set; }
    public Guid SupplierId { get; set; }
    public string Status { get; set; } = PurchaseOrderStatuses.Pendiente;
    public string? Notes { get; set; }

    /// <summary>Líneas de la orden. Se guardan y se borran junto con la orden.</summary>
    public List<PurchaseOrderLine> Lines { get; set; } = [];

    public Guid? CreatedByUserId { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? ReceivedAt { get; set; }
}

public class PurchaseOrderLine
{
    public Guid Id { get; set; }
    public Guid PurchaseOrderId { get; set; }

    /// <summary>Orden de la línea dentro de la orden (0, 1, 2...), para devolverlas como se crearon.</summary>
    public int Position { get; set; }

    public Guid ItemId { get; set; }
    public int Quantity { get; set; }
    public decimal UnitCost { get; set; }

    /// <summary>Vencimiento del lote que se crea al recibir la orden.</summary>
    public DateOnly? ExpirationDate { get; set; }
}

public class SterilizationCycle
{
    public Guid Id { get; set; }
    public DateOnly PerformedAt { get; set; }
    public string Result { get; set; } = SterilizationResults.Aprobado;

    /// <summary>Profesional responsable. Sin llave foránea hasta que exista el catálogo de profesionales.</summary>
    public Guid ResponsibleProfessionalId { get; set; }

    public string? Notes { get; set; }

    /// <summary>Instrumentos esterilizados en el ciclo.</summary>
    public List<SterilizationCycleItem> Items { get; set; } = [];

    public Guid? CreatedByUserId { get; set; }
    public DateTime CreatedAt { get; set; }
}

/// <summary>Tabla intermedia ciclo ↔ instrumento.</summary>
public class SterilizationCycleItem
{
    public Guid CycleId { get; set; }
    public Guid ItemId { get; set; }
}
