using ClinicApp.Api.Data;
using ClinicApp.Api.Modules.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ClinicApp.Api.Modules.Inventory;

/// <summary>Catálogo de proveedores: /api/inventory/suppliers (sin paginar: son pocos).</summary>
[ApiController]
[Route("api/inventory/suppliers")]
[Authorize(Roles = Roles.AdminYRecepcion)]
public class SuppliersController(AppDbContext db) : ControllerBase
{
    /// <summary>GET /api/inventory/suppliers → ordenados por nombre.</summary>
    [HttpGet]
    public async Task<List<SupplierDto>> List(CancellationToken cancellationToken)
    {
        var suppliers = await db.Suppliers.AsNoTracking()
            .OrderBy(supplier => supplier.Name)
            .ToListAsync(cancellationToken);

        return suppliers.Select(SupplierDto.FromEntity).ToList();
    }

    /// <summary>POST /api/inventory/suppliers → 201.</summary>
    [HttpPost]
    public async Task<ActionResult<SupplierDto>> Create(SupplierRequest request, CancellationToken cancellationToken)
    {
        var supplier = new Supplier { Id = Guid.CreateVersion7(), CreatedAt = DateTime.UtcNow };
        request.ApplyTo(supplier);

        db.Suppliers.Add(supplier);
        await db.SaveChangesAsync(cancellationToken);

        // No hay GET /suppliers/{id}: se responde 201 con el proveedor en el cuerpo.
        return StatusCode(StatusCodes.Status201Created, SupplierDto.FromEntity(supplier));
    }

    /// <summary>PUT /api/inventory/suppliers/{id}</summary>
    [HttpPut("{id:guid}")]
    public async Task<ActionResult<SupplierDto>> Update(Guid id, SupplierRequest request, CancellationToken cancellationToken)
    {
        var supplier = await db.Suppliers.FirstOrDefaultAsync(entry => entry.Id == id, cancellationToken);
        if (supplier is null) return SupplierNotFound();

        request.ApplyTo(supplier);
        await db.SaveChangesAsync(cancellationToken);

        return SupplierDto.FromEntity(supplier);
    }

    /// <summary>DELETE /api/inventory/suppliers/{id} → 204, o 409 si tiene órdenes de compra.</summary>
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var supplier = await db.Suppliers.FirstOrDefaultAsync(entry => entry.Id == id, cancellationToken);
        if (supplier is null) return SupplierNotFound();

        if (await db.PurchaseOrders.AnyAsync(order => order.SupplierId == id, cancellationToken))
        {
            return Problem(
                statusCode: StatusCodes.Status409Conflict,
                title: "No se puede eliminar: el proveedor tiene órdenes de compra asociadas");
        }

        db.Suppliers.Remove(supplier);
        await db.SaveChangesAsync(cancellationToken);

        return NoContent();
    }

    private ObjectResult SupplierNotFound() =>
        Problem(statusCode: StatusCodes.Status404NotFound, title: "Proveedor no encontrado");
}
