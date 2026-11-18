using ClinicApp.Api.Modules.Appointments;
using ClinicApp.Api.Modules.Auth;
using ClinicApp.Api.Modules.Patients;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ClinicApp.Api.Modules.Notifications;

/// <summary>Plantilla del mensaje (una sola para los tres tipos). Tabla <c>notification_templates</c>.</summary>
public class NotificationTemplate
{
    public static readonly Guid SingleId = Guid.Parse("00000000-0000-7000-8000-0000000000d1");

    public const string DefaultMessage =
        "Hola [nombre del cliente], te escribimos desde [nombre de la clínica] para recordarte tu cita del [fecha de la cita] " +
        "a las [hora de la cita] con [profesional]. Si necesitas reprogramar, contáctanos con anticipación. ¡Te esperamos!";

    public Guid Id { get; set; }
    public string Message { get; set; } = "";
    public DateTime UpdatedAt { get; set; }
    public Guid? UpdatedByUserId { get; set; }
}

/// <summary>
/// Notificación enviada (o por enviar) a un paciente. Tabla <c>notification_logs</c>.
/// Se crea <c>pendiente</c> junto con la cita y una tarea en segundo plano la envía.
/// </summary>
public class NotificationLog
{
    public Guid Id { get; set; }
    public Guid PatientId { get; set; }
    public Guid? AppointmentId { get; set; }
    public string Type { get; set; } = "";
    public string Channel { get; set; } = "";
    public string Status { get; set; } = NotificationStatuses.Pendiente;

    /// <summary>Teléfono o correo usado. No se expone.</summary>
    public string Recipient { get; set; } = "";

    /// <summary>Mensaje ya armado, para saber qué se le dijo al paciente. No se expone.</summary>
    public string Message { get; set; } = "";

    public string? Error { get; set; }
    public int Attempts { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? SentAt { get; set; }
}

public static class NotificationTypes
{
    public const string Recordatorio = "recordatorio_cita";
    public const string Confirmacion = "confirmacion_cita";
    public const string Cancelacion = "cancelacion_cita";
}

public static class NotificationChannels
{
    public const string Email = "email";
    public const string Sms = "sms";
}

public static class NotificationStatuses
{
    /// <summary>Interno: guardada con la cita, todavía no enviada. No sale en la API.</summary>
    public const string Pendiente = "pendiente";
    public const string Enviada = "enviada";
    public const string Fallida = "fallida";
}

public class NotificationTemplateConfiguration : IEntityTypeConfiguration<NotificationTemplate>
{
    public void Configure(EntityTypeBuilder<NotificationTemplate> builder)
    {
        builder.ToTable("notification_templates");
        builder.Property(template => template.Message).HasMaxLength(1000);
        builder.HasOne<User>().WithMany().HasForeignKey(template => template.UpdatedByUserId).OnDelete(DeleteBehavior.SetNull);

        // La migración inserta la plantilla predeterminada del mock.
        builder.HasData(new NotificationTemplate
        {
            Id = NotificationTemplate.SingleId,
            Message = NotificationTemplate.DefaultMessage,
            UpdatedAt = new DateTime(2026, 11, 17, 0, 0, 0, DateTimeKind.Utc),
        });
    }
}

public class NotificationLogConfiguration : IEntityTypeConfiguration<NotificationLog>
{
    public void Configure(EntityTypeBuilder<NotificationLog> builder)
    {
        builder.ToTable("notification_logs", table =>
        {
            table.HasCheckConstraint("ck_notification_logs_type", "type IN ('recordatorio_cita', 'confirmacion_cita', 'cancelacion_cita')");
            table.HasCheckConstraint("ck_notification_logs_channel", "channel IN ('email', 'sms', 'whatsapp')");
            table.HasCheckConstraint("ck_notification_logs_status", "status IN ('pendiente', 'enviada', 'fallida')");
        });

        builder.Property(log => log.Type).HasMaxLength(25);
        builder.Property(log => log.Channel).HasMaxLength(10);
        builder.Property(log => log.Status).HasMaxLength(10);
        builder.Property(log => log.Recipient).HasMaxLength(254);
        builder.Property(log => log.Message).HasMaxLength(1200);
        builder.Property(log => log.Error).HasMaxLength(500);

        builder.HasOne<Patient>().WithMany().HasForeignKey(log => log.PatientId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<Appointment>().WithMany().HasForeignKey(log => log.AppointmentId).OnDelete(DeleteBehavior.Restrict);

        // El mismo aviso no se repite para una cita (por ejemplo, un solo recordatorio).
        builder.HasIndex(log => new { log.AppointmentId, log.Type }).IsUnique().HasFilter("appointment_id IS NOT NULL");
        builder.HasIndex(log => log.SentAt);
        builder.HasIndex(log => new { log.Status, log.CreatedAt });
    }
}
