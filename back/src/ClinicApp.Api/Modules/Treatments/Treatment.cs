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

    // Pendiente: la lista de insumos que consume el tratamiento ("consumption" en el frontend).
    // Se agrega cuando exista la tabla de insumos del módulo de inventario.
}
