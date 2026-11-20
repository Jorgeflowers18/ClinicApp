using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ClinicApp.Api.Modules.Appointments;

public class ProfessionalConfiguration : IEntityTypeConfiguration<Professional>
{
    public void Configure(EntityTypeBuilder<Professional> builder)
    {
        builder.ToTable("professionals");

        builder.Property(professional => professional.Name).HasMaxLength(120);
        builder.Property(professional => professional.Specialty).HasMaxLength(80);
        builder.Property(professional => professional.RegistrationNumber).HasMaxLength(40);
        builder.Property(professional => professional.Active).HasDefaultValue(true);

        builder.HasIndex(professional => professional.Name);
    }
}

public class RoomConfiguration : IEntityTypeConfiguration<Room>
{
    public void Configure(EntityTypeBuilder<Room> builder)
    {
        builder.ToTable("rooms");

        builder.Property(room => room.Name).HasMaxLength(60);
        builder.Property(room => room.Active).HasDefaultValue(true);

        // Dos consultorios activos no pueden llamarse igual (sin distinguir mayúsculas).
        builder.HasIndex(room => room.Name).IsUnique().HasFilter("active").HasDatabaseName("ix_rooms_name_active");
    }
}
