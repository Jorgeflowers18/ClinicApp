using ClinicApp.Api.Modules.Appointments;
using ClinicApp.Api.Modules.Auth;
using ClinicApp.Api.Modules.Patients;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ClinicApp.Api.Modules.Inventory;

// Tablas del inventario. Las restricciones CHECK son una segunda barrera: aunque un error
// en el código intentara guardar un stock negativo o un tipo desconocido, la base lo rechaza.

public class InventoryItemConfiguration : IEntityTypeConfiguration<InventoryItem>
{
    public void Configure(EntityTypeBuilder<InventoryItem> builder)
    {
        builder.ToTable("inventory_items", table =>
        {
            table.HasCheckConstraint("ck_inventory_items_kind", "kind IN ('consumible', 'instrumental')");
            table.HasCheckConstraint("ck_inventory_items_stock", "stock >= 0");
            table.HasCheckConstraint("ck_inventory_items_min_stock", "min_stock >= 0");
            table.HasCheckConstraint("ck_inventory_items_unit_cost", "unit_cost >= 0");
        });

        builder.Property(item => item.Name).HasMaxLength(120);
        builder.Property(item => item.Category).HasMaxLength(80);
        builder.Property(item => item.Unit).HasMaxLength(30);
        builder.Property(item => item.Kind).HasMaxLength(20);
        builder.Property(item => item.Supplier).HasMaxLength(120);
        builder.Property(item => item.UnitCost).HasPrecision(10, 2);

        builder.HasIndex(item => item.Name);
    }
}

public class StockLotConfiguration : IEntityTypeConfiguration<StockLot>
{
    public void Configure(EntityTypeBuilder<StockLot> builder)
    {
        builder.ToTable("stock_lots", table =>
            table.HasCheckConstraint("ck_stock_lots_quantity", "quantity >= 0"));

        // Restrict: no se puede borrar un insumo que tiene lotes (se perdería el historial).
        builder.HasOne(lot => lot.Item).WithMany().HasForeignKey(lot => lot.ItemId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<PurchaseOrder>().WithMany().HasForeignKey(lot => lot.PurchaseOrderId).OnDelete(DeleteBehavior.Restrict);

        // Para recorrer los lotes de un insumo en orden FEFO.
        builder.HasIndex(lot => new { lot.ItemId, lot.ExpirationDate });
    }
}

public class StockMovementConfiguration : IEntityTypeConfiguration<StockMovement>
{
    public void Configure(EntityTypeBuilder<StockMovement> builder)
    {
        builder.ToTable("stock_movements", table =>
        {
            table.HasCheckConstraint("ck_stock_movements_type", "type IN ('entrada', 'salida')");
            table.HasCheckConstraint("ck_stock_movements_quantity", "quantity > 0");
        });

        builder.Property(movement => movement.Type).HasMaxLength(10);
        builder.Property(movement => movement.Reason).HasMaxLength(300);

        builder.HasOne<InventoryItem>().WithMany().HasForeignKey(movement => movement.ItemId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<StockLot>().WithMany().HasForeignKey(movement => movement.LotId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<PurchaseOrder>().WithMany().HasForeignKey(movement => movement.PurchaseOrderId).OnDelete(DeleteBehavior.Restrict);
        // SetNull: si algún día se borra un usuario, el movimiento queda (sin autor).
        builder.HasOne<User>().WithMany().HasForeignKey(movement => movement.CreatedByUserId).OnDelete(DeleteBehavior.SetNull);
        // Paciente al que se le consumió el insumo (tratamiento realizado).
        builder.HasOne<Patient>().WithMany().HasForeignKey(movement => movement.PatientId).OnDelete(DeleteBehavior.Restrict);

        // Historial de un insumo, del más reciente al más antiguo.
        builder.HasIndex(movement => new { movement.ItemId, movement.CreatedAt });
        // Reporte de inventario: salidas de un periodo.
        builder.HasIndex(movement => new { movement.Type, movement.CreatedAt });
    }
}

public class SupplierConfiguration : IEntityTypeConfiguration<Supplier>
{
    public void Configure(EntityTypeBuilder<Supplier> builder)
    {
        builder.ToTable("suppliers");

        builder.Property(supplier => supplier.Name).HasMaxLength(120);
        builder.Property(supplier => supplier.ContactName).HasMaxLength(120);
        builder.Property(supplier => supplier.Phone).HasMaxLength(30);
        builder.Property(supplier => supplier.Email).HasMaxLength(254);
        builder.Property(supplier => supplier.Address).HasMaxLength(250);
        builder.Property(supplier => supplier.Notes).HasMaxLength(1000);
    }
}

public class PurchaseOrderConfiguration : IEntityTypeConfiguration<PurchaseOrder>
{
    public void Configure(EntityTypeBuilder<PurchaseOrder> builder)
    {
        builder.ToTable("purchase_orders", table =>
            table.HasCheckConstraint("ck_purchase_orders_status", "status IN ('pendiente', 'recibida', 'cancelada')"));

        builder.Property(order => order.Status).HasMaxLength(20);
        builder.Property(order => order.Notes).HasMaxLength(1000);

        builder.HasOne<Supplier>().WithMany().HasForeignKey(order => order.SupplierId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<User>().WithMany().HasForeignKey(order => order.CreatedByUserId).OnDelete(DeleteBehavior.SetNull);

        // Cascade: las líneas pertenecen a la orden.
        builder.HasMany(order => order.Lines).WithOne().HasForeignKey(line => line.PurchaseOrderId).OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(order => order.CreatedAt);
    }
}

public class PurchaseOrderLineConfiguration : IEntityTypeConfiguration<PurchaseOrderLine>
{
    public void Configure(EntityTypeBuilder<PurchaseOrderLine> builder)
    {
        builder.ToTable("purchase_order_lines", table =>
        {
            table.HasCheckConstraint("ck_purchase_order_lines_quantity", "quantity >= 1");
            table.HasCheckConstraint("ck_purchase_order_lines_unit_cost", "unit_cost >= 0");
        });

        builder.Property(line => line.UnitCost).HasPrecision(10, 2);
        builder.HasOne<InventoryItem>().WithMany().HasForeignKey(line => line.ItemId).OnDelete(DeleteBehavior.Restrict);
    }
}

public class SterilizationCycleConfiguration : IEntityTypeConfiguration<SterilizationCycle>
{
    public void Configure(EntityTypeBuilder<SterilizationCycle> builder)
    {
        builder.ToTable("sterilization_cycles", table =>
            table.HasCheckConstraint("ck_sterilization_cycles_result", "result IN ('aprobado', 'fallido')"));

        builder.Property(cycle => cycle.Result).HasMaxLength(20);
        builder.Property(cycle => cycle.Notes).HasMaxLength(1000);

        builder.HasOne<User>().WithMany().HasForeignKey(cycle => cycle.CreatedByUserId).OnDelete(DeleteBehavior.SetNull);
        builder.HasOne<Professional>().WithMany().HasForeignKey(cycle => cycle.ResponsibleProfessionalId).OnDelete(DeleteBehavior.Restrict);
        builder.HasMany(cycle => cycle.Items).WithOne().HasForeignKey(item => item.CycleId).OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(cycle => cycle.PerformedAt);
    }
}

public class SterilizationCycleItemConfiguration : IEntityTypeConfiguration<SterilizationCycleItem>
{
    public void Configure(EntityTypeBuilder<SterilizationCycleItem> builder)
    {
        builder.ToTable("sterilization_cycle_items");

        // Clave primaria compuesta: un instrumento aparece una sola vez en cada ciclo.
        builder.HasKey(item => new { item.CycleId, item.ItemId });
        builder.HasOne<InventoryItem>().WithMany().HasForeignKey(item => item.ItemId).OnDelete(DeleteBehavior.Restrict);
    }
}
