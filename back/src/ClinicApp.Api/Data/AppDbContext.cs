using ClinicApp.Api.Common;
using ClinicApp.Api.Modules.Appointments;
using ClinicApp.Api.Modules.Auth;
using ClinicApp.Api.Modules.Inventory;
using ClinicApp.Api.Modules.Patients;
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
    public DbSet<TreatmentConsumption> TreatmentConsumptions => Set<TreatmentConsumption>();

    // auth
    public DbSet<User> Users => Set<User>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<PasswordResetToken> PasswordResetTokens => Set<PasswordResetToken>();
    public DbSet<AccessRequest> AccessRequests => Set<AccessRequest>();

    // inventory
    public DbSet<InventoryItem> InventoryItems => Set<InventoryItem>();
    public DbSet<StockLot> StockLots => Set<StockLot>();
    public DbSet<StockMovement> StockMovements => Set<StockMovement>();
    public DbSet<Supplier> Suppliers => Set<Supplier>();
    public DbSet<PurchaseOrder> PurchaseOrders => Set<PurchaseOrder>();
    public DbSet<PurchaseOrderLine> PurchaseOrderLines => Set<PurchaseOrderLine>();
    public DbSet<SterilizationCycle> SterilizationCycles => Set<SterilizationCycle>();
    public DbSet<SterilizationCycleItem> SterilizationCycleItems => Set<SterilizationCycleItem>();

    // patients
    public DbSet<Patient> Patients => Set<Patient>();

    // appointments
    public DbSet<Professional> Professionals => Set<Professional>();
    public DbSet<Room> Rooms => Set<Room>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // Extensión de PostgreSQL para buscar sin distinguir tildes (TextSearch.Unaccent).
        modelBuilder.HasPostgresExtension("unaccent");
        modelBuilder.HasDbFunction(typeof(TextSearch).GetMethod(nameof(TextSearch.Unaccent))!)
            .HasName("unaccent")
            .IsBuiltIn();

        // N.° de historia clínica correlativo (HC-000001, HC-000002...).
        modelBuilder.HasSequence<int>(PatientConfiguration.RecordNumberSequence).StartsAt(1);

        // Aplica todas las clases IEntityTypeConfiguration del proyecto
        // (por ejemplo, TreatmentConfiguration) sin tener que listarlas una por una.
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);
    }
}
