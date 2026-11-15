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
    }
}
