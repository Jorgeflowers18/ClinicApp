using ClinicApp.Api.Common;
using ClinicApp.Api.Data;
using ClinicApp.Api.Modules.Appointments;
using Microsoft.EntityFrameworkCore;

namespace ClinicApp.Api.Modules.Notifications;

/// <summary>
/// Tarea en segundo plano (cada <c>Notifications:DispatchIntervalSeconds</c>, 10 s):
/// <list type="number">
/// <item><b>Recordatorios:</b> crea uno pendiente para cada cita programada o confirmada que empieza dentro de
/// <c>Notifications:ReminderHoursBefore</c> (24 h) y todavía no lo tiene.</item>
/// <item><b>Envío:</b> envía las pendientes de la más antigua a la más nueva. Si el proveedor falla, reintenta
/// en la siguiente vuelta; al tercer intento queda <c>fallida</c>.</item>
/// </list>
/// Lo lógico está en <see cref="RunOnceAsync"/>, que las pruebas llaman directamente.
/// </summary>
public class NotificationDispatcher(
    IServiceScopeFactory scopes, INotificationSender sender, NotificationSettings settings, ClinicClock clock,
    ILogger<NotificationDispatcher> logger) : BackgroundService
{
    // Una vuelta a la vez, aunque las pruebas la llamen mientras corre la del temporizador.
    private readonly SemaphoreSlim _running = new(1, 1);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!settings.Enabled) return;

        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(settings.DispatchIntervalSeconds));
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                await RunOnceAsync(stoppingToken);
            }
            catch (Exception exception) when (exception is not OperationCanceledException)
            {
                logger.LogError(exception, "Falló el envío de notificaciones; se reintenta en la siguiente vuelta.");
            }
        }
    }

    /// <summary>Una vuelta: crea los recordatorios que tocan y envía las pendientes. Devuelve cuántas envió.</summary>
    public async Task<int> RunOnceAsync(CancellationToken cancellationToken)
    {
        if (!settings.Enabled) return 0;

        await _running.WaitAsync(cancellationToken);
        try
        {
            await using var scope = scopes.CreateAsyncScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var composer = scope.ServiceProvider.GetRequiredService<NotificationComposer>();

            await CreateRemindersAsync(db, composer, cancellationToken);
            return await SendPendingAsync(db, cancellationToken);
        }
        finally
        {
            _running.Release();
        }
    }

    private async Task CreateRemindersAsync(AppDbContext db, NotificationComposer composer, CancellationToken cancellationToken)
    {
        var now = clock.UtcNow;
        var until = now.AddHours(settings.ReminderHoursBefore);

        var due = await db.Appointments.AsNoTracking()
            .Where(appointment => (appointment.Status == AppointmentStatuses.Programada || appointment.Status == AppointmentStatuses.Confirmada)
                && appointment.Start > now && appointment.Start <= until
                && !db.NotificationLogs.Any(log => log.AppointmentId == appointment.Id && log.Type == NotificationTypes.Recordatorio))
            .ToListAsync(cancellationToken);

        foreach (var appointment in due)
        {
            await composer.AddAsync(appointment, NotificationTypes.Recordatorio, cancellationToken);
        }
        await db.SaveChangesAsync(cancellationToken);
    }

    private async Task<int> SendPendingAsync(AppDbContext db, CancellationToken cancellationToken)
    {
        var pending = await db.NotificationLogs
            .Where(log => log.Status == NotificationStatuses.Pendiente)
            .OrderBy(log => log.CreatedAt)
            .Take(50)
            .ToListAsync(cancellationToken);

        var sent = 0;
        foreach (var log in pending)
        {
            try
            {
                await sender.SendAsync(new OutgoingNotification(log.Id, log.Channel, log.Recipient, log.Message), cancellationToken);
                log.Status = NotificationStatuses.Enviada;
                log.SentAt = clock.UtcNow;
                log.Error = null;
                sent++;
            }
            catch (Exception exception) when (exception is not OperationCanceledException)
            {
                log.Attempts++;
                log.Error = exception.Message.Length <= 500 ? exception.Message : exception.Message[..500];
                if (log.Attempts >= NotificationSettings.MaxAttempts)
                {
                    log.Status = NotificationStatuses.Fallida;
                    log.SentAt = clock.UtcNow;
                }
                logger.LogWarning(exception, "No se pudo enviar la notificación {LogId} (intento {Attempt}).", log.Id, log.Attempts);
            }
            await db.SaveChangesAsync(cancellationToken);
        }

        return sent;
    }
}
