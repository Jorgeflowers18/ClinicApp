using ClinicApp.Api.Common;
using ClinicApp.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace ClinicApp.Api.Modules.ClinicalHistory;

/// <summary>
/// Tarea en segundo plano que corre cada <c>Attachments:CleanupIntervalMinutes</c> (60):
///
/// <list type="number">
/// <item><b>Huérfanos:</b> borra la fila y el archivo de los adjuntos que se subieron y <b>nunca</b> se guardaron
/// en una historia (<c>linked_at = null</c>) y tienen más de <c>Attachments:OrphanHours</c> (24). Vacío = no borra.</item>
/// <item><b>Protocolo de conservación (apagado):</b> solo si <c>Attachments:Retention:RemovedDays</c> tiene valor.
/// Toma los adjuntos quitados de la historia hace más de esos días. Con <c>Retention:DryRun = true</c> (por defecto)
/// solo los anota en el log; con <c>false</c> borra el archivo y marca <c>purged_at</c> (la fila se conserva).
/// Nunca toca un adjunto que está en la historia actual.</item>
/// </list>
/// Lo lógico está en <see cref="RunOnceAsync"/>, que las pruebas llaman directamente.
/// </summary>
public class AttachmentCleanupService(
    IServiceScopeFactory scopes, AttachmentStorage storage, IConfiguration configuration, ClinicClock clock,
    ILogger<AttachmentCleanupService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var minutes = configuration.GetValue<int?>("Attachments:CleanupIntervalMinutes") ?? 60;
        using var timer = new PeriodicTimer(TimeSpan.FromMinutes(Math.Max(1, minutes)));

        do
        {
            try
            {
                await RunOnceAsync(stoppingToken);
            }
            catch (Exception exception) when (exception is not OperationCanceledException)
            {
                logger.LogError(exception, "Falló la limpieza de adjuntos; se reintenta en la siguiente vuelta.");
            }
        }
        while (await timer.WaitForNextTickAsync(stoppingToken));
    }

    /// <summary>Una vuelta de limpieza. Devuelve cuántos huérfanos borró y cuántos archivos purgó.</summary>
    public async Task<(int Orphans, int Purged)> RunOnceAsync(CancellationToken cancellationToken)
    {
        await using var scope = scopes.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var now = clock.UtcNow;

        var orphans = 0;
        var orphanHours = configuration.GetValue<double?>("Attachments:OrphanHours");
        if (orphanHours is > 0)
        {
            var limit = now.AddHours(-orphanHours.Value);
            var expired = await db.ClinicalAttachments
                .Where(attachment => attachment.LinkedAt == null && attachment.CreatedAt < limit)
                .ToListAsync(cancellationToken);

            foreach (var attachment in expired)
            {
                if (storage.TryDelete(attachment.StoragePath, out var error))
                {
                    db.ClinicalAttachments.Remove(attachment);
                    orphans++;
                }
                else
                {
                    logger.LogWarning(error, "No se pudo borrar el adjunto huérfano {AttachmentId}; se reintenta luego.", attachment.Id);
                }
            }
            await db.SaveChangesAsync(cancellationToken);
        }

        var purged = 0;
        var removedDays = configuration.GetValue<int?>("Attachments:Retention:RemovedDays");
        if (removedDays is > 0)
        {
            var dryRun = configuration.GetValue("Attachments:Retention:DryRun", true);
            var limit = now.AddDays(-removedDays.Value);
            var candidates = await db.ClinicalAttachments
                .Where(attachment => attachment.RemovedAt != null && attachment.RemovedAt < limit && attachment.PurgedAt == null)
                .ToListAsync(cancellationToken);

            foreach (var attachment in candidates)
            {
                if (dryRun)
                {
                    logger.LogWarning(
                        "[Simulación] Se borraría el adjunto {AttachmentId} «{Alias}» del paciente {PatientId}, quitado el {RemovedAt:yyyy-MM-dd}.",
                        attachment.Id, attachment.Alias, attachment.PatientId, attachment.RemovedAt);
                    continue;
                }

                if (storage.TryDelete(attachment.StoragePath, out var error))
                {
                    attachment.PurgedAt = now;
                    purged++;
                    logger.LogWarning("Protocolo de conservación: se borró el archivo del adjunto {AttachmentId} «{Alias}».", attachment.Id, attachment.Alias);
                }
                else
                {
                    logger.LogWarning(error, "No se pudo purgar el adjunto {AttachmentId}; se reintenta luego.", attachment.Id);
                }
            }
            await db.SaveChangesAsync(cancellationToken);
        }

        return (orphans, purged);
    }
}
