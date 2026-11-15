namespace ClinicApp.Api.Modules.Treatments;

/// <summary>
/// Tratamiento del catálogo de la clínica (limpieza, ortodoncia, endodoncia...).
/// Cada propiedad se convierte en una columna de la tabla "treatments".
/// </summary>
public class Treatment
{
    /// <summary>Clave primaria. EF Core la reconoce por llamarse "Id".</summary>
    public Guid Id { get; set; }

    public string Name { get; set; } = "";

    public string Category { get; set; } = "";

    /// <summary>Opcional: el "?" indica que la columna admite NULL.</summary>
    public string? Description { get; set; }

    public int DurationMinutes { get; set; }

    /// <summary>Precio de catálogo. "decimal" es el tipo correcto para dinero (sin errores de redondeo).</summary>
    public decimal Price { get; set; }

    public bool Active { get; set; } = true;

    /// <summary>Fecha de creación, siempre en UTC.</summary>
    public DateTime CreatedAt { get; set; }

    /// <summary>Insumos que consume cada vez que se realiza ("consumption" en el frontend).</summary>
    public List<TreatmentConsumption> Consumption { get; set; } = [];
}

/// <summary>
/// Insumo que consume un tratamiento y cuánto. Tabla intermedia tratamiento ↔ insumo:
/// la clave es el par (tratamiento, insumo), así un insumo no se repite en el mismo tratamiento.
/// </summary>
public class TreatmentConsumption
{
    public Guid TreatmentId { get; set; }
    public Guid ItemId { get; set; }
    public int Quantity { get; set; }
}
