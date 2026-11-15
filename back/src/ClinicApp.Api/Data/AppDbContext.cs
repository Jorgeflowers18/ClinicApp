using ClinicApp.Api.Modules.Auth;
using ClinicApp.Api.Modules.Treatments;
using Microsoft.EntityFrameworkCore;

namespace ClinicApp.Api.Data;

/// <summary>
/// Representa la base de datos dentro del código. Cada DbSet es una tabla:
/// con él se consulta (LINQ) y se guardan cambios (SaveChangesAsync).
/// </summary>
public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<Treatment> Treatments => Set<Treatment>();

    // auth
    public DbSet<User> Users => Set<User>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<PasswordResetToken> PasswordResetTokens => Set<PasswordResetToken>();
    public DbSet<AccessRequest> AccessRequests => Set<AccessRequest>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // Aplica todas las clases IEntityTypeConfiguration del proyecto
        // (por ejemplo, TreatmentConfiguration) sin tener que listarlas una por una.
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);
    }
}
