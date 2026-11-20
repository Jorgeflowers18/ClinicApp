using ClinicApp.Api.Modules.Inventory;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ClinicApp.Api.Modules.Treatments;

/// <summary>
/// Detalles de la tabla que EF Core no puede adivinar solo con la clase:
/// largos máximos de texto, precisión de los decimales, índices...
/// </summary>
public class TreatmentConfiguration : IEntityTypeConfiguration<Treatment>
{
    public void Configure(EntityTypeBuilder<Treatment> builder)
    {
        builder.Property(treatment => treatment.Name).HasMaxLength(120);
        builder.Property(treatment => treatment.Category).HasMaxLength(80);
        builder.Property(treatment => treatment.Description).HasMaxLength(1000);

        // numeric(10,2): hasta 99 999 999.99 con dos decimales exactos.
        builder.Property(treatment => treatment.Price).HasPrecision(10, 2);

        // Cascade: los consumos pertenecen al tratamiento y se borran con él.
        builder.HasMany(treatment => treatment.Consumption)
            .WithOne()
            .HasForeignKey(consumption => consumption.TreatmentId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public class TreatmentConsumptionConfiguration : IEntityTypeConfiguration<TreatmentConsumption>
{
    public void Configure(EntityTypeBuilder<TreatmentConsumption> builder)
    {
        builder.ToTable("treatment_consumptions", table =>
            table.HasCheckConstraint("ck_treatment_consumptions_quantity", "quantity >= 1"));

        builder.HasKey(consumption => new { consumption.TreatmentId, consumption.ItemId });

        // Restrict: no se puede borrar un insumo que algún tratamiento consume.
        builder.HasOne<InventoryItem>()
            .WithMany()
            .HasForeignKey(consumption => consumption.ItemId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
