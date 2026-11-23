using System.ComponentModel.DataAnnotations;
using ClinicApp.Api.Common;
using ClinicApp.Api.Data;
using ClinicApp.Api.Modules.Auth;
using ClinicApp.Api.Modules.Patients;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ClinicApp.Api.Modules.Notifications;

/// <summary>
/// Notificación: la forma de <c>NotificationLog</c> del frontend (notification.types.ts), más el nombre del
/// paciente (para el historial, sin pedir cada paciente) y el mensaje que se le envió, ya armado.
/// El destinatario (teléfono o correo) no se expone.
/// </summary>
public record NotificationLogDto(
    Guid Id, Guid PatientId, string PatientName, Guid? AppointmentId, string Type, string Channel, string Status,
    DateTime? SentAt, string Message)
{
    public static NotificationLogDto FromEntity(NotificationLog log, string patientName) =>
        new(log.Id, log.PatientId, patientName, log.AppointmentId, log.Type, log.Channel, log.Status, log.SentAt, log.Message);

    /// <summary>Convierte una página de notificaciones trayendo los nombres de sus pacientes en una sola consulta.</summary>
    public static async Task<List<NotificationLogDto>> FromEntitiesAsync(
        IReadOnlyList<NotificationLog> logs, AppDbContext db, CancellationToken cancellationToken)
    {
        var names = await db.PatientNamesAsync(logs.Select(log => log.PatientId), cancellationToken);
        return logs.Select(log => FromEntity(log, names.GetValueOrDefault(log.PatientId, ""))).ToList();
    }
}

/// <summary>Indicadores del historial: todas las notificaciones enviadas o fallidas (sin las pendientes).</summary>
public record NotificationSummaryDto(int Total, int Sent, int Failed);

public record NotificationTemplateDto(Guid Id, string Message, DateTime UpdatedAt);

public class NotificationTemplateRequest
{
    [Required(ErrorMessage = "El mensaje debe tener al menos 10 caracteres")]
    [MaxLength(1000, ErrorMessage = "Máximo 1000 caracteres")]
    public string Message { get; set; } = "";
}

/// <summary>
/// Notificaciones: /api/notifications
/// El reporte y la plantilla son para admin y recepción. La variante <c>?appointmentId=</c> (el detalle de la
/// cita, "cliente notificado") la pueden usar los tres roles, porque la agenda la ven todos.
/// </summary>
[ApiController]
[Route("api/notifications")]
[Authorize(Roles = Roles.Todos)]
public class NotificationsController(AppDbContext db, ClinicClock clock) : ControllerBase
{
    private static readonly string[] Channels = [NotificationChannels.Email, NotificationChannels.Sms];
    private static readonly string[] ListedStatuses = [NotificationStatuses.Enviada, NotificationStatuses.Fallida];
    private static readonly string[] Types = [NotificationTypes.Recordatorio, NotificationTypes.Confirmacion, NotificationTypes.Cancelacion];

    /// <summary>
    /// GET /api/notifications?appointmentId= → lista (sin paginar) de las notificaciones de una cita. Los tres roles.
    /// GET /api/notifications?page&amp;pageSize&amp;search&amp;dateFrom&amp;dateTo&amp;channel&amp;status&amp;type&amp;id → reporte
    /// paginado. Admin y recepción. search: nombre o cédula del paciente. Fechas inclusivas en hora de la clínica.
    /// channel (email, sms), status (enviada, fallida) y type (recordatorio_cita, confirmacion_cita,
    /// cancelacion_cita): un valor desconocido da 400 en su campo. id: solo esa notificación (el enlace de una
    /// alerta de envío fallido). Sin las pendientes.
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> List(
        [FromQuery] PageQuery query, [FromQuery] Guid? appointmentId, [FromQuery] string? dateFrom, [FromQuery] string? dateTo,
        [FromQuery] string? channel, [FromQuery] string? status, [FromQuery] string? type, [FromQuery] Guid? id,
        CancellationToken cancellationToken)
    {
        var sent = db.NotificationLogs.AsNoTracking().Where(log => log.Status != NotificationStatuses.Pendiente);

        if (appointmentId is not null)
        {
            var byAppointment = await sent.Where(log => log.AppointmentId == appointmentId)
                .OrderByDescending(log => log.SentAt).ToListAsync(cancellationToken);
            return Ok(await NotificationLogDto.FromEntitiesAsync(byAppointment, db, cancellationToken));
        }

        if (!User.IsInRole(Roles.Admin) && !User.IsInRole(Roles.Recepcion)) return Forbid();

        var attribute = new IsoDateAttribute();
        if (!attribute.IsValid(dateFrom)) ModelState.AddModelError("dateFrom", "Fecha inválida (formato AAAA-MM-DD)");
        if (!attribute.IsValid(dateTo)) ModelState.AddModelError("dateTo", "Fecha inválida (formato AAAA-MM-DD)");
        if (!string.IsNullOrEmpty(channel) && !Channels.Contains(channel)) ModelState.AddModelError("channel", "Canal desconocido");
        if (!string.IsNullOrEmpty(status) && !ListedStatuses.Contains(status)) ModelState.AddModelError("status", "Estado desconocido");
        if (!string.IsNullOrEmpty(type) && !Types.Contains(type)) ModelState.AddModelError("type", "Tipo de mensaje desconocido");
        if (!ModelState.IsValid) return this.ValidationError(ModelState);

        if (id is not null) sent = sent.Where(log => log.Id == id);
        if (!string.IsNullOrEmpty(channel)) sent = sent.Where(log => log.Channel == channel);
        if (!string.IsNullOrEmpty(status)) sent = sent.Where(log => log.Status == status);
        if (!string.IsNullOrEmpty(type)) sent = sent.Where(log => log.Type == type);

        if (Validation.ParseDate(dateFrom) is { } from)
        {
            var start = clock.ToUtc(from, TimeOnly.MinValue);
            sent = sent.Where(log => log.SentAt >= start);
        }
        if (Validation.ParseDate(dateTo) is { } to)
        {
            var end = clock.ToUtc(to.AddDays(1), TimeOnly.MinValue);
            sent = sent.Where(log => log.SentAt < end);
        }

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var pattern = TextSearch.ContainsPattern(query.Search);
            var patients = db.Patients
                .Where(patient => EF.Functions.ILike(TextSearch.Unaccent(patient.FirstName + " " + patient.LastName), TextSearch.Unaccent(pattern))
                    || EF.Functions.ILike(patient.DocumentId, pattern))
                .Select(patient => patient.Id);
            sent = sent.Where(log => patients.Contains(log.PatientId));
        }

        var page = await sent.OrderByDescending(log => log.SentAt).ThenByDescending(log => log.Id).ToPagedResultAsync(query, cancellationToken);
        return Ok(new PagedResult<NotificationLogDto>(
            await NotificationLogDto.FromEntitiesAsync(page.Items, db, cancellationToken), page.Page, page.PageSize, page.TotalItems, page.TotalPages));
    }

    /// <summary>
    /// GET /api/notifications/summary → <c>{ total, sent, failed }</c> de todo el historial (sin las pendientes),
    /// para los indicadores de la página, sin leer el historial completo. Admin y recepción.
    /// </summary>
    [HttpGet("summary")]
    [Authorize(Roles = Roles.AdminYRecepcion)]
    public async Task<NotificationSummaryDto> Summary(CancellationToken cancellationToken)
    {
        var counts = await db.NotificationLogs.AsNoTracking()
            .Where(log => log.Status != NotificationStatuses.Pendiente)
            .GroupBy(log => log.Status)
            .Select(group => new { Status = group.Key, Count = group.Count() })
            .ToListAsync(cancellationToken);
        var sent = counts.Where(row => row.Status == NotificationStatuses.Enviada).Sum(row => row.Count);
        var failed = counts.Where(row => row.Status == NotificationStatuses.Fallida).Sum(row => row.Count);
        return new NotificationSummaryDto(counts.Sum(row => row.Count), sent, failed);
    }

    /// <summary>GET /api/notifications/template</summary>
    [HttpGet("template")]
    [Authorize(Roles = Roles.AdminYRecepcion)]
    public async Task<NotificationTemplateDto> GetTemplate(CancellationToken cancellationToken)
    {
        var template = await db.NotificationTemplates.AsNoTracking().FirstAsync(cancellationToken);
        return new NotificationTemplateDto(template.Id, template.Message, template.UpdatedAt);
    }

    /// <summary>PUT /api/notifications/template { message } → la plantilla guardada.</summary>
    [HttpPut("template")]
    [Authorize(Roles = Roles.AdminYRecepcion)]
    public async Task<ActionResult<NotificationTemplateDto>> UpdateTemplate(NotificationTemplateRequest request, CancellationToken cancellationToken)
    {
        var message = request.Message.Trim();
        if (message.Length < 10)
        {
            ModelState.AddModelError("message", "El mensaje debe tener al menos 10 caracteres");
            return this.ValidationError(ModelState);
        }

        var template = await db.NotificationTemplates.FirstAsync(cancellationToken);
        template.Message = message;
        template.UpdatedAt = clock.UtcNow;
        template.UpdatedByUserId = User.GetUserId();
        await db.SaveChangesAsync(cancellationToken);

        return new NotificationTemplateDto(template.Id, template.Message, template.UpdatedAt);
    }
}
