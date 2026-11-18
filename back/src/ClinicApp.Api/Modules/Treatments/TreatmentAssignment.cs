using ClinicApp.Api.Modules.Appointments;
using ClinicApp.Api.Modules.Auth;
using ClinicApp.Api.Modules.Inventory;
using ClinicApp.Api.Modules.Patients;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ClinicApp.Api.Modules.Treatments;

/// <summary>
/// Tratamiento realizado a un paciente ("asignación" en el frontend). Tabla <c>treatment_assignments</c>.
/// La API solo los registra ya completados (1 de 1 sesión) desde la historia clínica; los estados
/// en_progreso y suspendido quedan para datos antiguos importados.
/// </summary>
public class TreatmentAssignment
{
    public Guid Id { get; set; }
    public Guid TreatmentId { get; set; }
    public Guid PatientId { get; set; }
    public int TotalSessions { get; set; } = 1;
    public int CompletedSessions { get; set; } = 1;
    public string Status { get; set; } = AssignmentStatuses.Completado;

    /// <summary>Fecha de la atención en que se realizó.</summary>
    public DateOnly StartDate { get; set; }

    /// <summary>Pieza o zona tratada ("" si no aplica).</summary>
    public string Tooth { get; set; } = "";

    /// <summary>
    /// Atención de la historia clínica en que se realizó. Sin llave foránea por ahora: el frontend
    /// registra el tratamiento antes de crear la atención.
    /// </summary>
    public Guid? SourceEncounterId { get; set; }

    /// <summary>Clave de idempotencia (atención + tratamiento de esa atención). Única.</summary>
    public string? SourceKey { get; set; }

    /// <summary>Costo cobrado. Si es null (asignaciones antiguas), vale el precio del catálogo.</summary>
    public decimal? Price { get; set; }

    /// <summary>Profesional que lo realizó (lo llenará el registro transaccional de la atención).</summary>
    public Guid? ProfessionalId { get; set; }

    public DateTime CreatedAt { get; set; }
    public Guid? CreatedByUserId { get; set; }
}

public static class AssignmentStatuses
{
    public const string EnProgreso = "en_progreso";
    public const string Completado = "completado";
    public const string Suspendido = "suspendido";
}

public class TreatmentAssignmentConfiguration : IEntityTypeConfiguration<TreatmentAssignment>
{
    public void Configure(EntityTypeBuilder<TreatmentAssignment> builder)
    {
        builder.ToTable("treatment_assignments", table =>
        {
            table.HasCheckConstraint("ck_treatment_assignments_status", "status IN ('en_progreso', 'completado', 'suspendido')");
            table.HasCheckConstraint("ck_treatment_assignments_sessions", "total_sessions >= 1 AND completed_sessions >= 0 AND completed_sessions <= total_sessions");
            table.HasCheckConstraint("ck_treatment_assignments_price", "price IS NULL OR price >= 0");
        });

        builder.Property(assignment => assignment.Status).HasMaxLength(15);
        builder.Property(assignment => assignment.Tooth).HasMaxLength(60);
        builder.Property(assignment => assignment.SourceKey).HasMaxLength(200);
        builder.Property(assignment => assignment.Price).HasPrecision(10, 2);

        builder.HasOne<Treatment>().WithMany().HasForeignKey(assignment => assignment.TreatmentId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<Patient>().WithMany().HasForeignKey(assignment => assignment.PatientId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<Professional>().WithMany().HasForeignKey(assignment => assignment.ProfessionalId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<User>().WithMany().HasForeignKey(assignment => assignment.CreatedByUserId).OnDelete(DeleteBehavior.SetNull);

        builder.HasIndex(assignment => assignment.SourceKey).IsUnique().HasFilter("source_key IS NOT NULL");
        builder.HasIndex(assignment => new { assignment.PatientId, assignment.StartDate });
        builder.HasIndex(assignment => new { assignment.TreatmentId, assignment.StartDate });
    }
}

/// <summary>Movimientos de stock → tratamiento realizado que los generó.</summary>
public class StockMovementAssignmentConfiguration : IEntityTypeConfiguration<StockMovement>
{
    public void Configure(EntityTypeBuilder<StockMovement> builder) =>
        builder.HasOne<TreatmentAssignment>().WithMany().HasForeignKey(movement => movement.TreatmentAssignmentId).OnDelete(DeleteBehavior.Restrict);
}
