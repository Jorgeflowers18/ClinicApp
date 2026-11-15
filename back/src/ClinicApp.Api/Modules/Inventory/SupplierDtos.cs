using System.ComponentModel.DataAnnotations;

namespace ClinicApp.Api.Modules.Inventory;

/// <summary>Proveedor: la forma de <c>Supplier</c> en el frontend.</summary>
public record SupplierDto(
    Guid Id,
    string Name,
    string? ContactName,
    string? Phone,
    string? Email,
    string? Address,
    string? Notes,
    DateTime CreatedAt)
{
    public static SupplierDto FromEntity(Supplier supplier) => new(
        supplier.Id, supplier.Name, supplier.ContactName, supplier.Phone,
        supplier.Email, supplier.Address, supplier.Notes, supplier.CreatedAt);
}

/// <summary>Crear o editar un proveedor: la forma de <c>SupplierFormValues</c>. Solo el nombre es obligatorio.</summary>
public class SupplierRequest
{
    [Required(ErrorMessage = "El nombre es obligatorio")]
    [MinLength(2, ErrorMessage = "Mínimo 2 caracteres")]
    [MaxLength(120, ErrorMessage = "Máximo 120 caracteres")]
    public string Name { get; set; } = "";

    [MaxLength(120, ErrorMessage = "Máximo 120 caracteres")]
    public string? ContactName { get; set; }

    [MaxLength(30, ErrorMessage = "Máximo 30 caracteres")]
    public string? Phone { get; set; }

    // RegularExpression deja pasar vacío o null: el correo es opcional, pero si viene debe ser válido.
    [RegularExpression(@"^\s*[^@\s]+@[^@\s]+\.[^@\s]+\s*$", ErrorMessage = "Correo inválido")]
    [MaxLength(254, ErrorMessage = "Máximo 254 caracteres")]
    public string? Email { get; set; }

    [MaxLength(250, ErrorMessage = "Máximo 250 caracteres")]
    public string? Address { get; set; }

    [MaxLength(1000, ErrorMessage = "Máximo 1000 caracteres")]
    public string? Notes { get; set; }

    public void ApplyTo(Supplier supplier)
    {
        supplier.Name = Name.Trim();
        supplier.ContactName = Clean(ContactName);
        supplier.Phone = Clean(Phone);
        supplier.Email = Clean(Email)?.ToLowerInvariant();
        supplier.Address = Clean(Address);
        supplier.Notes = Clean(Notes);
    }

    /// <summary>El formulario manda "" en los campos vacíos; en la base se guardan como NULL.</summary>
    private static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
