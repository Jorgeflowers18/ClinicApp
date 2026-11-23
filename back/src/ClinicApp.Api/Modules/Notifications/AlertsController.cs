using ClinicApp.Api.Common;
using ClinicApp.Api.Data;
using ClinicApp.Api.Modules.Appointments;
using ClinicApp.Api.Modules.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ClinicApp.Api.Modules.Notifications;

public record AlertAppointmentDto(
    Guid Id, DateTime Start, DateTime End, string Status, Guid PatientId, string PatientName, Guid ProfessionalId, string ProfessionalName);

public record AlertBirthdayDto(Guid PatientId, string PatientName, string BirthDate);

public record AlertCriticalItemDto(Guid ItemId, string Name, int Stock, int MinStock, string Unit);

public record AlertFailedDeliveryDto(Guid Id, Guid PatientId, string PatientName, Guid? AppointmentId, string Channel, string Type, DateTime? SentAt);

/// <summary>Lo que muestra el centro de alertas del encabezado, en una sola respuesta.</summary>
public record AlertsDto(
    string Date,
    IReadOnlyList<AlertAppointmentDto> AppointmentsToday,
    IReadOnlyList<AlertBirthdayDto> BirthdaysToday,
    IReadOnlyList<AlertCriticalItemDto> CriticalItems,
    IReadOnlyList<AlertFailedDeliveryDto> FailedDeliveries);

/// <summary>
/// Alertas del día: /api/alerts. Reemplaza las lecturas completas que hacía el centro de alertas del frontend
/// (todos los pacientes, todas las citas, todo el inventario y todo el historial cada 5 minutos).
/// "Hoy" es el día de la clínica (<c>Clinic:TimeZone</c>).
/// </summary>
[ApiController]
[Route("api/alerts")]
[Authorize(Roles = Roles.Todos)]
public class AlertsController(AppDbContext db, ClinicClock clock) : ControllerBase
{
    /// <summary>Días hacia atrás en los que se muestran los envíos fallidos.</summary>
    public const int FailedDeliveryDays = 7;

    /// <summary>
    /// GET /api/alerts →
    /// <list type="bullet">
    /// <item>citas programadas o confirmadas que empiezan hoy (los tres roles);</item>
    /// <item>cumpleaños de hoy de pacientes activos (los tres roles; los nacidos un 29 de febrero se muestran el 28
    /// en los años que no son bisiestos);</item>
    /// <item>insumos con stock en o bajo el mínimo y envíos fallidos de los últimos 7 días (solo admin y
    /// recepción; para el médico van vacíos).</item>
    /// </list>
    /// </summary>
    [HttpGet]
    public async Task<AlertsDto> Get(CancellationToken cancellationToken)
    {
        var today = clock.Today;
        var (start, end) = clock.UtcRange(today, today);
        var canManage = User.IsInRole(Roles.Admin) || User.IsInRole(Roles.Recepcion);

        var active = new[] { AppointmentStatuses.Programada, AppointmentStatuses.Confirmada };
        var appointments = await (
                from appointment in db.Appointments.AsNoTracking()
                join patient in db.Patients on appointment.PatientId equals patient.Id
                join professional in db.Professionals on appointment.ProfessionalId equals professional.Id
                where appointment.Start >= start && appointment.Start < end && active.Contains(appointment.Status)
                orderby appointment.Start
                select new AlertAppointmentDto(
                    appointment.Id, appointment.Start, appointment.End, appointment.Status,
                    patient.Id, (patient.FirstName + " " + patient.LastName).Trim(), professional.Id, professional.Name))
            .ToListAsync(cancellationToken);

        var leapDayToo = today is { Month: 2, Day: 28 } && !DateTime.IsLeapYear(today.Year);
        var birthdays = (await db.Patients.AsNoTracking()
                .Where(patient => patient.DeletedAt == null && patient.BirthDate != null
                    && patient.BirthDate.Value.Month == today.Month
                    && (patient.BirthDate.Value.Day == today.Day || (leapDayToo && patient.BirthDate.Value.Day == 29)))
                .OrderBy(patient => patient.FirstName).ThenBy(patient => patient.LastName)
                .Select(patient => new { patient.Id, patient.FirstName, patient.LastName, patient.BirthDate })
                .ToListAsync(cancellationToken))
            .Select(patient => new AlertBirthdayDto(
                patient.Id, $"{patient.FirstName} {patient.LastName}".Trim(), patient.BirthDate!.Value.ToString(IsoDateAttribute.Format)))
            .ToList();

        List<AlertCriticalItemDto> critical = [];
        List<AlertFailedDeliveryDto> failed = [];
        if (canManage)
        {
            critical = await db.InventoryItems.AsNoTracking()
                .Where(item => item.Stock <= item.MinStock)
                .OrderBy(item => item.Stock).ThenBy(item => item.Name)
                .Select(item => new AlertCriticalItemDto(item.Id, item.Name, item.Stock, item.MinStock, item.Unit))
                .ToListAsync(cancellationToken);

            var since = clock.UtcNow.AddDays(-FailedDeliveryDays);
            failed = await (
                    from log in db.NotificationLogs.AsNoTracking()
                    join patient in db.Patients on log.PatientId equals patient.Id
                    where log.Status == NotificationStatuses.Fallida && log.SentAt >= since
                    orderby log.SentAt descending
                    select new AlertFailedDeliveryDto(
                        log.Id, patient.Id, (patient.FirstName + " " + patient.LastName).Trim(), log.AppointmentId, log.Channel, log.Type, log.SentAt))
                .ToListAsync(cancellationToken);
        }

        return new AlertsDto(today.ToString(IsoDateAttribute.Format), appointments, birthdays, critical, failed);
    }
}
