using ClinicApp.Api.Modules.Auth;
using ClinicApp.Api.Modules.Patients;
using ClinicApp.Api.Modules.Treatments;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ClinicApp.Api.Modules.Appointments;

public class AppointmentConfiguration : IEntityTypeConfiguration<Appointment>
{
    public void Configure(EntityTypeBuilder<Appointment> builder)
    {
        builder.ToTable("appointments", table =>
        {
            table.HasCheckConstraint("ck_appointments_status",
                "status IN ('programada', 'confirmada', 'cancelada', 'completada', 'no_asistio')");
            table.HasCheckConstraint("ck_appointments_range", "\"end\" > start");
        });

        builder.Property(appointment => appointment.Status).HasMaxLength(15);
        builder.Property(appointment => appointment.Notes).HasMaxLength(1000);

        // Restrict: no se puede borrar un paciente, profesional, tratamiento o consultorio con citas.
        builder.HasOne<Patient>().WithMany().HasForeignKey(appointment => appointment.PatientId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<Professional>().WithMany().HasForeignKey(appointment => appointment.ProfessionalId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<Treatment>().WithMany().HasForeignKey(appointment => appointment.TreatmentId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<Room>().WithMany().HasForeignKey(appointment => appointment.RoomId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<User>().WithMany().HasForeignKey(appointment => appointment.CreatedByUserId).OnDelete(DeleteBehavior.SetNull);
        builder.HasOne<User>().WithMany().HasForeignKey(appointment => appointment.StatusChangedByUserId).OnDelete(DeleteBehavior.SetNull);

        // Para la agenda (por fecha) y para buscar choques de un profesional o consultorio.
        builder.HasIndex(appointment => appointment.Start);
        builder.HasIndex(appointment => new { appointment.PatientId, appointment.Start });
        builder.HasIndex(appointment => new { appointment.ProfessionalId, appointment.Start });
        builder.HasIndex(appointment => new { appointment.RoomId, appointment.Start });
    }
}

public class ScheduleBlockConfiguration : IEntityTypeConfiguration<ScheduleBlock>
{
    public void Configure(EntityTypeBuilder<ScheduleBlock> builder)
    {
        builder.ToTable("schedule_blocks", table =>
        {
            table.HasCheckConstraint("ck_schedule_blocks_target", "professional_id IS NOT NULL OR room_id IS NOT NULL");
            table.HasCheckConstraint("ck_schedule_blocks_range", "\"end\" > start");
        });

        builder.Property(block => block.Reason).HasMaxLength(300);

        builder.HasOne<Professional>().WithMany().HasForeignKey(block => block.ProfessionalId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<Room>().WithMany().HasForeignKey(block => block.RoomId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<User>().WithMany().HasForeignKey(block => block.CreatedByUserId).OnDelete(DeleteBehavior.SetNull);

        builder.HasIndex(block => block.Start);
    }
}
