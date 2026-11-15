using System.ComponentModel.DataAnnotations;

namespace ClinicApp.Api.Modules.Treatments;

/// <summary>
/// Lo que la API devuelve: la forma de <c>Treatment</c> en el frontend (treatment.types.ts).
/// Es una clase distinta de la entidad para que la tabla pueda cambiar sin romper el contrato.
/// </summary>
public record TreatmentDto(
    Guid Id,
    string Name,
    string Category,
    string? Description,
    int DurationMinutes,
    decimal Price,
    bool Active,
    IReadOnlyList<TreatmentConsumptionDto> Consumption,
    DateTime CreatedAt)
{
    public static TreatmentDto FromEntity(Treatment treatment) => new(
        treatment.Id,
        treatment.Name,
        treatment.Category,
        treatment.Description,
        treatment.DurationMinutes,
        treatment.Price,
        treatment.Active,
        // Pendiente: los insumos se guardan cuando exista la tabla de inventario.
        // Mientras tanto se devuelve una lista vacía, porque el frontend siempre espera el arreglo.
        [],
        treatment.CreatedAt);
}

/// <summary>Insumo que consume el tratamiento (pendiente del módulo de inventario).</summary>
public record TreatmentConsumptionDto(string ItemId, int Quantity);

/// <summary>
/// Lo que la API recibe al crear o editar: la forma de <c>TreatmentFormValues</c> del frontend.
/// Las reglas replican las del esquema de Zod (treatmentSchema): el frontend valida para ayudar
/// al usuario, pero la API vuelve a validar porque es la única barrera real.
/// </summary>
public class TreatmentRequest
{
    [Required(ErrorMessage = "El nombre es obligatorio")]
    [MinLength(2, ErrorMessage = "Mínimo 2 caracteres")]
    [MaxLength(120, ErrorMessage = "Máximo 120 caracteres")]
    public string Name { get; set; } = "";

    [Required(ErrorMessage = "La categoría es obligatoria")]
    [MinLength(2, ErrorMessage = "Mínimo 2 caracteres")]
    [MaxLength(80, ErrorMessage = "Máximo 80 caracteres")]
    public string Category { get; set; } = "";

    [MaxLength(1000, ErrorMessage = "Máximo 1000 caracteres")]
    public string? Description { get; set; }

    [Range(5, 1440, ErrorMessage = "La duración debe estar entre 5 y 1440 minutos")]
    public int DurationMinutes { get; set; }

    // ParseLimitsInInvariantCulture: lee "99999999.99" con punto decimal sin importar el idioma
    // de Windows (en español el separador es la coma y la conversión fallaría).
    [Range(typeof(decimal), "0", "99999999.99", ParseLimitsInInvariantCulture = true,
        ErrorMessage = "El precio debe estar entre 0 y 99 999 999,99")]
    public decimal Price { get; set; }

    public bool Active { get; set; }

    // "consumption" también llega desde el frontend; por ahora se ignora (ver TreatmentDto).

    /// <summary>Copia los datos del formulario en la entidad (sirve para crear y para editar).</summary>
    public void ApplyTo(Treatment treatment)
    {
        treatment.Name = Name.Trim();
        treatment.Category = Category.Trim();
        treatment.Description = string.IsNullOrWhiteSpace(Description) ? null : Description.Trim();
        treatment.DurationMinutes = DurationMinutes;
        treatment.Price = Price;
        treatment.Active = Active;
    }
}
