using ClinicApp.Api.Common;
using ClinicApp.Api.Modules.Appointments;
using ClinicApp.Api.Modules.Auth;
using ClinicApp.Api.Modules.Patients;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ClinicApp.Api.Modules.ClinicalHistory;

public class ClinicalRecordConfiguration : IEntityTypeConfiguration<ClinicalRecord>
{
    public void Configure(EntityTypeBuilder<ClinicalRecord> builder)
    {
        builder.ToTable("clinical_records");
        builder.HasKey(record => record.PatientId);

        // Token de concurrencia: el UPDATE exige que la revisión siga siendo la leída.
        builder.Property(record => record.Revision).IsConcurrencyToken();

        builder.Property(record => record.Chart).HasJsonbConversion();
        builder.Property(record => record.MedicalBackground).HasJsonbConversion();
        builder.Property(record => record.AllergiesAndMedication).HasJsonbConversion();
        builder.Property(record => record.Habits).HasJsonbConversion();
        builder.Property(record => record.DentalBackground).HasJsonbConversion();
        builder.Property(record => record.PeriodontalBackground).HasJsonbConversion();
        builder.Property(record => record.Plan).HasJsonbConversion();
        builder.Property(record => record.DataConsent).HasJsonbConversion();
        builder.Property(record => record.TruthDeclaration).HasJsonbConversion();
        builder.Property(record => record.ExamRequests).HasJsonbConversion();

        builder.HasOne<Patient>().WithOne().HasForeignKey<ClinicalRecord>(record => record.PatientId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<User>().WithMany().HasForeignKey(record => record.UpdatedByUserId).OnDelete(DeleteBehavior.SetNull);
    }
}

public class ClinicalRecordVersionConfiguration : IEntityTypeConfiguration<ClinicalRecordVersion>
{
    public void Configure(EntityTypeBuilder<ClinicalRecordVersion> builder)
    {
        builder.ToTable("clinical_record_versions");

        builder.Property(version => version.Data).HasJsonbConversion();

        builder.HasOne<ClinicalRecord>().WithMany().HasForeignKey(version => version.PatientId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<User>().WithMany().HasForeignKey(version => version.SavedByUserId).OnDelete(DeleteBehavior.SetNull);

        builder.HasIndex(version => new { version.PatientId, version.Revision }).IsUnique();
    }
}

public class ClinicalEncounterConfiguration : IEntityTypeConfiguration<ClinicalEncounter>
{
    public void Configure(EntityTypeBuilder<ClinicalEncounter> builder)
    {
        builder.ToTable("clinical_encounters", table =>
            table.HasCheckConstraint("ck_clinical_encounters_asa", "asa IN ('', 'I', 'II', 'III', 'IV')"));

        // El id lo genera el frontend: EF Core no debe inventar otro.
        builder.Property(encounter => encounter.Id).ValueGeneratedNever();

        builder.Property(encounter => encounter.LegacyProfessionalName).HasMaxLength(120);
        builder.Property(encounter => encounter.Reason).HasMaxLength(500);
        builder.Property(encounter => encounter.PresentIllness).HasMaxLength(2000);
        builder.Property(encounter => encounter.Asa).HasMaxLength(3);
        builder.Property(encounter => encounter.Procedures).HasMaxLength(4000);
        builder.Property(encounter => encounter.Materials).HasMaxLength(1000);
        builder.Property(encounter => encounter.ExamFindings).HasMaxLength(1000);
        builder.Property(encounter => encounter.Evolution).HasMaxLength(4000);
        builder.Property(encounter => encounter.Notes).HasMaxLength(4000);
        builder.Property(encounter => encounter.DiagnosisSummary).HasColumnType("text");

        builder.Property(encounter => encounter.Vitals).HasJsonbConversion();
        builder.Property(encounter => encounter.RiskAssessment).HasJsonbConversion();
        builder.Property(encounter => encounter.ExtraoralExam).HasJsonbConversion();
        builder.Property(encounter => encounter.IntraoralExam).HasJsonbConversion();
        builder.Property(encounter => encounter.Pain).HasJsonbConversion();
        builder.Property(encounter => encounter.CariesRisk).HasJsonbConversion();
        builder.Property(encounter => encounter.PeriodontalRisk).HasJsonbConversion();
        builder.Property(encounter => encounter.Diagnoses).HasJsonbConversion();
        builder.Property(encounter => encounter.Prognosis).HasJsonbConversion();
        builder.Property(encounter => encounter.PeriodontalDiagnosis).HasJsonbConversion();
        builder.Property(encounter => encounter.MaintenanceInterval).HasJsonbConversion();
        builder.Property(encounter => encounter.RequestedExams).HasJsonbConversion();
        builder.Property(encounter => encounter.PerformedTreatments).HasJsonbConversion();
        builder.Property(encounter => encounter.ChartSnapshot).HasJsonbConversion();
        builder.Property(encounter => encounter.ClinicalSnapshot).HasJsonbConversion();

        builder.HasOne<Patient>().WithMany().HasForeignKey(encounter => encounter.PatientId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<Professional>().WithMany().HasForeignKey(encounter => encounter.ProfessionalId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<Appointment>().WithMany().HasForeignKey(encounter => encounter.AppointmentId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<User>().WithMany().HasForeignKey(encounter => encounter.CreatedByUserId).OnDelete(DeleteBehavior.SetNull);

        builder.HasMany(encounter => encounter.Addenda).WithOne().HasForeignKey(note => note.EncounterId).OnDelete(DeleteBehavior.Restrict);

        // Una cita tiene como máximo una atención.
        builder.HasIndex(encounter => encounter.AppointmentId).IsUnique().HasFilter("appointment_id IS NOT NULL");
        builder.HasIndex(encounter => new { encounter.PatientId, encounter.Date });
        builder.HasIndex(encounter => encounter.Date);
        builder.HasIndex(encounter => encounter.ProfessionalId);
    }
}

public class EncounterNoteConfiguration : IEntityTypeConfiguration<EncounterNote>
{
    public void Configure(EntityTypeBuilder<EncounterNote> builder)
    {
        builder.ToTable("encounter_notes");

        builder.Property(note => note.Text).HasMaxLength(4000);
        builder.Property(note => note.AuthorName).HasMaxLength(120);
        builder.HasOne<User>().WithMany().HasForeignKey(note => note.AuthorUserId).OnDelete(DeleteBehavior.SetNull);
    }
}

public class ClinicalAttachmentConfiguration : IEntityTypeConfiguration<ClinicalAttachment>
{
    public void Configure(EntityTypeBuilder<ClinicalAttachment> builder)
    {
        builder.ToTable("clinical_attachments", table =>
        {
            table.HasCheckConstraint("ck_clinical_attachments_kind",
                "kind IN ('radiografia_periapical', 'bitewing', 'panoramica', 'cbct', 'fotografias', 'modelos', 'pruebas_pulpares', 'laboratorio', 'interconsulta', 'biopsia', 'consentimiento', 'otro')");
            table.HasCheckConstraint("ck_clinical_attachments_mime",
                "mime IN ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')");
            table.HasCheckConstraint("ck_clinical_attachments_size", "size BETWEEN 1 AND 20971520");
        });

        builder.Property(attachment => attachment.Alias).HasMaxLength(255);
        builder.Property(attachment => attachment.Kind).HasMaxLength(30);
        builder.Property(attachment => attachment.Mime).HasMaxLength(50);
        builder.Property(attachment => attachment.StoragePath).HasMaxLength(200);
        builder.Ignore(attachment => attachment.IsInRecord);

        builder.HasOne<Patient>().WithMany().HasForeignKey(attachment => attachment.PatientId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<User>().WithMany().HasForeignKey(attachment => attachment.UploadedByUserId).OnDelete(DeleteBehavior.SetNull);

        builder.HasIndex(attachment => attachment.PatientId);
        // Para la limpieza de huérfanos (nunca guardados) y del protocolo de conservación.
        builder.HasIndex(attachment => new { attachment.LinkedAt, attachment.CreatedAt });
    }
}
