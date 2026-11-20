using ClinicApp.Api.Modules.Auth;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ClinicApp.Api.Modules.Patients;

public class PatientConfiguration : IEntityTypeConfiguration<Patient>
{
    public const string RecordNumberSequence = "patient_record_number_seq";

    public void Configure(EntityTypeBuilder<Patient> builder)
    {
        builder.ToTable("patients", table =>
        {
            table.HasCheckConstraint("ck_patients_gender", "gender IN ('femenino', 'masculino', 'otro')");
            table.HasCheckConstraint("ck_patients_document_type", "document_type IN ('', 'cedula', 'pasaporte', 'otro')");
            table.HasCheckConstraint("ck_patients_marital_status",
                "marital_status IN ('', 'soltero', 'casado', 'union_libre', 'divorciado', 'viudo')");
            table.HasCheckConstraint("ck_patients_treatment_status",
                "treatment_status IN ('activo', 'en seguimiento', 'pendiente', 'inactivo')");
        });

        // El número lo pone PostgreSQL al insertar (nextval) y EF Core lo lee de vuelta.
        builder.Property(patient => patient.RecordNumber)
            .HasDefaultValueSql($"nextval('{RecordNumberSequence}')");
        builder.HasIndex(patient => patient.RecordNumber).IsUnique();

        builder.Property(patient => patient.FirstName).HasMaxLength(80);
        builder.Property(patient => patient.LastName).HasMaxLength(80);
        builder.Property(patient => patient.DocumentId).HasMaxLength(20);
        builder.Property(patient => patient.DocumentType).HasMaxLength(10);
        builder.Property(patient => patient.Gender).HasMaxLength(10);
        builder.Property(patient => patient.MaritalStatus).HasMaxLength(15);
        builder.Property(patient => patient.Occupation).HasMaxLength(120);
        builder.Property(patient => patient.Company).HasMaxLength(120);
        builder.Property(patient => patient.Nationality).HasMaxLength(60);
        builder.Property(patient => patient.Phone).HasMaxLength(30);
        builder.Property(patient => patient.Email).HasMaxLength(254);
        builder.Property(patient => patient.Address).HasMaxLength(250);
        builder.Property(patient => patient.City).HasMaxLength(120);
        builder.Property(patient => patient.Notes).HasMaxLength(2000);
        builder.Property(patient => patient.EmergencyContactName).HasMaxLength(120);
        builder.Property(patient => patient.EmergencyContactRelationship).HasMaxLength(60);
        builder.Property(patient => patient.EmergencyContactPhone).HasMaxLength(30);
        builder.Property(patient => patient.InsuranceProvider).HasMaxLength(120);
        builder.Property(patient => patient.InsurancePolicy).HasMaxLength(60);
        builder.Property(patient => patient.TreatmentStatus).HasMaxLength(20);
        builder.Property(patient => patient.NotificationsEnabled).HasDefaultValue(true);

        builder.Ignore(patient => patient.IsActive);
        builder.Ignore(patient => patient.FullName);

        builder.HasOne<User>().WithMany().HasForeignKey(patient => patient.CreatedByUserId).OnDelete(DeleteBehavior.SetNull);
        builder.HasOne<User>().WithMany().HasForeignKey(patient => patient.UpdatedByUserId).OnDelete(DeleteBehavior.SetNull);
        builder.HasOne<User>().WithMany().HasForeignKey(patient => patient.DeletedByUserId).OnDelete(DeleteBehavior.SetNull);

        builder.HasIndex(patient => patient.DocumentId);
        builder.HasIndex(patient => patient.CreatedAt);
        builder.HasIndex(patient => patient.DeletedAt);
    }
}
