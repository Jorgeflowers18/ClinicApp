using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ClinicApp.Api.Modules.Auth;

public class UserConfiguration : IEntityTypeConfiguration<User>
{
    public void Configure(EntityTypeBuilder<User> builder)
    {
        builder.ToTable("users", table =>
            table.HasCheckConstraint("ck_users_role", "role IN ('admin', 'recepcion', 'medico')"));

        builder.Property(u => u.Email).HasMaxLength(254);
        builder.HasIndex(u => u.Email).IsUnique();

        builder.Property(u => u.Name).HasMaxLength(120);
        builder.Property(u => u.PasswordHash).HasMaxLength(200);
        builder.Property(u => u.Role).HasMaxLength(20);

        // El perfil va en una columna jsonb: se lee y se guarda siempre junto con el usuario.
        builder.OwnsOne(u => u.Profile, profile => profile.ToJson());
    }
}

public class RefreshTokenConfiguration : IEntityTypeConfiguration<RefreshToken>
{
    public void Configure(EntityTypeBuilder<RefreshToken> builder)
    {
        builder.Property(t => t.TokenHash).HasMaxLength(64);
        builder.HasIndex(t => t.TokenHash).IsUnique();

        builder.HasOne(t => t.User).WithMany().HasForeignKey(t => t.UserId).OnDelete(DeleteBehavior.Cascade);
    }
}

public class PasswordResetTokenConfiguration : IEntityTypeConfiguration<PasswordResetToken>
{
    public void Configure(EntityTypeBuilder<PasswordResetToken> builder)
    {
        builder.Property(t => t.TokenHash).HasMaxLength(64);
        builder.HasIndex(t => t.TokenHash).IsUnique();

        builder.HasOne(t => t.User).WithMany().HasForeignKey(t => t.UserId).OnDelete(DeleteBehavior.Cascade);
    }
}

public class AccessRequestConfiguration : IEntityTypeConfiguration<AccessRequest>
{
    public void Configure(EntityTypeBuilder<AccessRequest> builder)
    {
        builder.Property(r => r.Email).HasMaxLength(254);
        builder.Property(r => r.FullName).HasMaxLength(120);
        builder.Property(r => r.Institution).HasMaxLength(160);
        builder.Property(r => r.Message).HasMaxLength(1000);
        builder.Property(r => r.Status).HasMaxLength(20);
        builder.HasIndex(r => r.CreatedAt);
    }
}
