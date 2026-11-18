using System.ComponentModel.DataAnnotations;
using ClinicApp.Api.Common;
using ClinicApp.Api.Data;
using ClinicApp.Api.Modules.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ClinicApp.Api.Modules.Notifications;

/// <summary>Notificación: la forma de <c>NotificationLog</c> del frontend (notification.types.ts).</summary>
public record NotificationLogDto(Guid Id, Guid PatientId, Guid? AppointmentId, string Type, string Channel, string Status, DateTime? SentAt)
{
    public static NotificationLogDto FromEntity(NotificationLog log) =>
        new(log.Id, log.PatientId, log.AppointmentId, log.Type, log.Channel, log.Status, log.SentAt);
}

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
    /// <summary>
    /// GET /api/notifications?appointmentId= → lista (sin paginar) de las notificaciones de una cita. Los tres roles.
    /// GET /api/notifications?page&amp;pageSize&amp;search&amp;dateFrom&amp;dateTo → reporte paginado. Admin y recepción.
    /// search: nombre o cédula del paciente. Fechas inclusivas en hora de la clínica. Sin las pendientes.
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> List(
        [FromQuery] PageQuery query, [FromQuery] Guid? appointmentId, [FromQuery] string? dateFrom, [FromQuery] string? dateTo,
        CancellationToken cancellationToken)
    {
        var sent = db.NotificationLogs.AsNoTracking().Where(log => log.Status != NotificationStatuses.Pendiente);

        if (appointmentId is not null)
        {
            var byAppointment = await sent.Where(log => log.AppointmentId == appointmentId)
                .OrderByDescending(log => log.SentAt).ToListAsync(cancellationToken);
            return Ok(byAppointment.Select(NotificationLogDto.FromEntity));
        }

        if (!User.IsInRole(Roles.Admin) && !User.IsInRole(Roles.Recepcion)) return Forbid();

        var attribute = new IsoDateAttribute();
        if (!attribute.IsValid(dateFrom)) ModelState.AddModelError("dateFrom", "Fecha inválida (formato AAAA-MM-DD)");
        if (!attribute.IsValid(dateTo)) ModelState.AddModelError("dateTo", "Fecha inválida (formato AAAA-MM-DD)");
        if (!ModelState.IsValid) return this.ValidationError(ModelState);

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
            page.Items.Select(NotificationLogDto.FromEntity).ToList(), page.Page, page.PageSize, page.TotalItems, page.TotalPages));
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
