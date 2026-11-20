using ClinicApp.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace ClinicApp.Api.Modules.Appointments;

/// <summary>
/// Disponibilidad de profesionales y consultorios: busca choques con otras citas y con bloqueos, con los
/// mismos mensajes del mock del frontend (findAppointmentConflict / findScheduleBlockConflict).
///
/// Para que dos personas no agenden el mismo horario a la vez, antes de buscar choques se toma un candado
/// de PostgreSQL (<c>pg_advisory_xact_lock</c>) por profesional y por consultorio. El segundo espera a que
/// el primero termine su transacción y entonces ya ve la cita nueva. Los candados se sueltan solos al
/// terminar la transacción.
/// </summary>
public class AvailabilityService(AppDbContext db)
{
    public const string ProfessionalBusy = "El profesional ya tiene una cita agendada en ese horario";
    public const string RoomBusy = "El consultorio ya está ocupado en ese horario";
    public const string ProfessionalBlocked = "El profesional tiene un bloqueo de horario en ese rango";
    public const string RoomBlocked = "El consultorio tiene un bloqueo de horario en ese rango";
    public const string BlockOverProfessionalAppointment = "El profesional tiene una cita agendada en ese horario";
    public const string BlockOverRoomAppointment = "El consultorio tiene una cita agendada en ese horario";

    /// <summary>
    /// Bloquea la agenda del profesional y del consultorio hasta el final de la transacción.
    /// Siempre en el mismo orden (por texto), para que dos operaciones no se esperen entre sí.
    /// </summary>
    public async Task LockAsync(Guid? professionalId, Guid? roomId, CancellationToken cancellationToken)
    {
        if (db.Database.CurrentTransaction is null)
            throw new InvalidOperationException("Los candados de agenda deben tomarse dentro de una transacción.");

        var keys = new List<string>();
        if (professionalId is { } professional) keys.Add($"agenda:professional:{professional}");
        if (roomId is { } room) keys.Add($"agenda:room:{room}");

        foreach (var key in keys.Order(StringComparer.Ordinal))
        {
            await db.Database.ExecuteSqlAsync($"SELECT pg_advisory_xact_lock(hashtext({key}))", cancellationToken);
        }
    }

    /// <summary>Choque de una cita. Devuelve el mensaje, o null si el horario está libre.</summary>
    public async Task<string?> FindAppointmentConflictAsync(
        Guid professionalId, Guid? roomId, DateTime start, DateTime end, Guid? excludeAppointmentId, CancellationToken cancellationToken)
    {
        var activeAppointments = db.Appointments.AsNoTracking()
            .Where(appointment => appointment.Status != AppointmentStatuses.Cancelada
                && appointment.Id != excludeAppointmentId
                && appointment.Start < end && appointment.End > start);

        if (await activeAppointments.AnyAsync(appointment => appointment.ProfessionalId == professionalId, cancellationToken))
            return ProfessionalBusy;

        if (roomId is not null && await activeAppointments.AnyAsync(appointment => appointment.RoomId == roomId, cancellationToken))
            return RoomBusy;

        var blocks = db.ScheduleBlocks.AsNoTracking().Where(block => block.Start < end && block.End > start);

        if (await blocks.AnyAsync(block => block.ProfessionalId == professionalId, cancellationToken))
            return ProfessionalBlocked;

        if (roomId is not null && await blocks.AnyAsync(block => block.RoomId == roomId, cancellationToken))
            return RoomBlocked;

        return null;
    }

    /// <summary>
    /// Un bloqueo no puede crearse sobre una cita no cancelada del mismo profesional o consultorio.
    /// Los bloqueos sí pueden superponerse entre sí.
    /// </summary>
    public async Task<string?> FindBlockConflictAsync(
        Guid? professionalId, Guid? roomId, DateTime start, DateTime end, CancellationToken cancellationToken)
    {
        var activeAppointments = db.Appointments.AsNoTracking()
            .Where(appointment => appointment.Status != AppointmentStatuses.Cancelada
                && appointment.Start < end && appointment.End > start);

        if (professionalId is not null && await activeAppointments.AnyAsync(appointment => appointment.ProfessionalId == professionalId, cancellationToken))
            return BlockOverProfessionalAppointment;

        if (roomId is not null && await activeAppointments.AnyAsync(appointment => appointment.RoomId == roomId, cancellationToken))
            return BlockOverRoomAppointment;

        return null;
    }
}

/// <summary>
/// Lo que pasa después de crear o cancelar una cita. Se llama dentro de la misma transacción, antes de
/// guardar, así lo que agregue (por ejemplo, la notificación pendiente) se guarda junto con la cita.
/// Lo implementa el módulo de notificaciones (AppointmentNotifications).
/// </summary>
public interface IAppointmentEvents
{
    Task AppointmentCreatedAsync(Appointment appointment, CancellationToken cancellationToken);

    Task AppointmentCancelledAsync(Appointment appointment, CancellationToken cancellationToken);
}

