using ClinicApp.Api.Common;
using ClinicApp.Api.Data;
using ClinicApp.Api.Modules.Appointments;
using ClinicApp.Api.Modules.Inventory;
using ClinicApp.Api.Modules.Notifications;
using ClinicApp.Api.Modules.Treatments;
using Microsoft.EntityFrameworkCore;

namespace ClinicApp.Api.Modules.Reports;

/// <summary>
/// Los cinco reportes. Cada número se cuenta o se suma en PostgreSQL (GROUP BY, COUNT, SUM): la API no trae
/// las filas a memoria. Las fórmulas son las del mock del frontend (reports.api.ts) y de backlog.md § reports.
/// </summary>
public class ReportQueries(AppDbContext db, ClinicClock clock)
{
    private static readonly Dictionary<string, string> StatusLabels = new()
    {
        [AppointmentStatuses.Programada] = "Programada",
        [AppointmentStatuses.Confirmada] = "Confirmada",
        [AppointmentStatuses.Cancelada] = "Cancelada",
        [AppointmentStatuses.Completada] = "Completada",
        [AppointmentStatuses.NoAsistio] = "No asistió",
    };

    private static readonly Dictionary<string, string> PurchaseLabels = new()
    {
        [PurchaseOrderStatuses.Pendiente] = "Pendiente",
        [PurchaseOrderStatuses.Recibida] = "Recibida",
        [PurchaseOrderStatuses.Cancelada] = "Cancelada",
    };

    private static double Ratio(int numerator, int denominator) => denominator > 0 ? (double)numerator / denominator : 0;

    private IQueryable<Appointment> AppointmentsIn(ReportPeriod period) =>
        db.Appointments.AsNoTracking().Where(appointment => appointment.Start >= period.StartUtc && appointment.Start < period.EndUtc);

    public async Task<ReportsSummary> SummaryAsync(ReportPeriod period, CancellationToken cancellationToken)
    {
        var byStatus = await AppointmentsIn(period)
            .GroupBy(appointment => appointment.Status)
            .Select(group => new { Status = group.Key, Count = group.Count() })
            .ToDictionaryAsync(entry => entry.Status, entry => entry.Count, cancellationToken);
        var completed = byStatus.GetValueOrDefault(AppointmentStatuses.Completada);
        var noShow = byStatus.GetValueOrDefault(AppointmentStatuses.NoAsistio);

        return new ReportsSummary(
            PatientsTotal: await db.Patients.CountAsync(patient => patient.DeletedAt == null, cancellationToken),
            PatientsNewInPeriod: await db.Patients.CountAsync(patient => patient.CreatedAt >= period.StartUtc && patient.CreatedAt < period.EndUtc, cancellationToken),
            AppointmentsInPeriod: byStatus.Values.Sum(),
            AppointmentsCompleted: completed,
            AppointmentsNoShow: noShow,
            NoShowRate: Ratio(noShow, completed + noShow),
            TreatmentsPerformed: await db.TreatmentAssignments.CountAsync(assignment =>
                assignment.Status == AssignmentStatuses.Completado && assignment.StartDate >= period.From && assignment.StartDate <= period.To, cancellationToken),
            CriticalStockItems: await db.InventoryItems.CountAsync(item => item.Stock <= item.MinStock, cancellationToken),
            NotificationsSent: await db.NotificationLogs.CountAsync(log =>
                log.Status == NotificationStatuses.Enviada && log.SentAt >= period.StartUtc && log.SentAt < period.EndUtc, cancellationToken));
    }

    public async Task<AgendaReport> AgendaAsync(ReportPeriod period, CancellationToken cancellationToken)
    {
        // Citas por día de la clínica (no por día UTC) y por estado.
        var perDay = await db.Database.SqlQuery<DayStatusCount>($"""
            SELECT (start AT TIME ZONE {clock.ZoneId})::date AS day, status AS status, count(*)::int AS count
            FROM appointments
            WHERE start >= {period.StartUtc} AND start < {period.EndUtc}
            GROUP BY 1, 2
            """).ToListAsync(cancellationToken);

        var byDay = period.Days().Select(day =>
        {
            var ofDay = perDay.Where(entry => entry.Day == day).ToDictionary(entry => entry.Status, entry => entry.Count);
            return new AgendaDayRow(day.ToString(IsoDateAttribute.Format), ReportPeriod.DayLabel(day), ofDay.Values.Sum(),
                ofDay.GetValueOrDefault(AppointmentStatuses.Completada), ofDay.GetValueOrDefault(AppointmentStatuses.NoAsistio),
                ofDay.GetValueOrDefault(AppointmentStatuses.Cancelada));
        }).ToList();

        var byStatus = AppointmentStatuses.All
            .Select(status => new AgendaStatusRow(status, StatusLabels[status], perDay.Where(entry => entry.Status == status).Sum(entry => entry.Count)))
            .ToList();

        // Minutos reservados (citas no canceladas) y bloqueados (recortados al periodo), por consultorio.
        var booked = await db.Database.SqlQuery<RoomMinutes>($"""
            SELECT room_id, count(*)::int AS count, COALESCE(sum(EXTRACT(EPOCH FROM ("end" - start)) / 60), 0)::int AS minutes
            FROM appointments
            WHERE start >= {period.StartUtc} AND start < {period.EndUtc} AND status <> 'cancelada'
            GROUP BY room_id
            """).ToListAsync(cancellationToken);

        var blocked = await db.Database.SqlQuery<RoomMinutes>($"""
            SELECT room_id, count(*)::int AS count,
                   COALESCE(sum(EXTRACT(EPOCH FROM (LEAST("end", {period.EndUtc}) - GREATEST(start, {period.StartUtc}))) / 60), 0)::int AS minutes
            FROM schedule_blocks
            WHERE room_id IS NOT NULL AND start < {period.EndUtc} AND "end" > {period.StartUtc}
            GROUP BY room_id
            """).ToListAsync(cancellationToken);

        var rooms = await db.Rooms.AsNoTracking().OrderBy(room => room.Name).ToListAsync(cancellationToken);
        var occupancy = rooms
            .Where(room => room.Active || booked.Any(entry => entry.RoomId == room.Id) || blocked.Any(entry => entry.RoomId == room.Id))
            .Select(room =>
            {
                var ownBooked = booked.FirstOrDefault(entry => entry.RoomId == room.Id);
                var ownBlocked = blocked.FirstOrDefault(entry => entry.RoomId == room.Id);
                return new RoomOccupancyRow(room.Id.ToString(), room.Name, ownBooked?.Count ?? 0, ownBooked?.Minutes ?? 0, ownBlocked?.Minutes ?? 0);
            })
            .ToList();

        if (booked.FirstOrDefault(entry => entry.RoomId == null) is { } withoutRoom)
        {
            occupancy.Add(new RoomOccupancyRow("", "Sin consultorio", withoutRoom.Count, withoutRoom.Minutes, 0));
        }

        return new AgendaReport(byDay, byStatus, occupancy);
    }

    public async Task<ProductivityReport> ProductivityAsync(ReportPeriod period, CancellationToken cancellationToken)
    {
        var counts = await AppointmentsIn(period)
            .GroupBy(appointment => new { appointment.ProfessionalId, appointment.Status })
            .Select(group => new { group.Key.ProfessionalId, group.Key.Status, Count = group.Count() })
            .ToListAsync(cancellationToken);
        var professionals = await db.Professionals.AsNoTracking().ToListAsync(cancellationToken);

        var rows = professionals
            .Where(professional => professional.Active || counts.Any(entry => entry.ProfessionalId == professional.Id))
            .Select(professional =>
            {
                var own = counts.Where(entry => entry.ProfessionalId == professional.Id).ToDictionary(entry => entry.Status, entry => entry.Count);
                var scheduled = own.Values.Sum();
                var completed = own.GetValueOrDefault(AppointmentStatuses.Completada);
                var cancelled = own.GetValueOrDefault(AppointmentStatuses.Cancelada);
                return new ProfessionalProductivityRow(professional.Id, professional.Name, professional.Specialty, scheduled, completed,
                    own.GetValueOrDefault(AppointmentStatuses.NoAsistio), cancelled, Ratio(completed, Math.Max(1, scheduled - cancelled)));
            })
            .OrderByDescending(row => row.Completed)
            .ThenBy(row => row.Name)
            .ToList();

        return new ProductivityReport(rows);
    }

    public async Task<TreatmentsReport> TreatmentsAsync(ReportPeriod period, CancellationToken cancellationToken)
    {
        var appointments = await AppointmentsIn(period)
            .Where(appointment => appointment.TreatmentId != null)
            .GroupBy(appointment => appointment.TreatmentId!.Value)
            .Select(group => new { TreatmentId = group.Key, Count = group.Count() })
            .ToDictionaryAsync(entry => entry.TreatmentId, entry => entry.Count, cancellationToken);

        var assignments = await db.TreatmentAssignments.AsNoTracking()
            .Where(assignment => assignment.StartDate >= period.From && assignment.StartDate <= period.To)
            .Join(db.Treatments, assignment => assignment.TreatmentId, treatment => treatment.Id,
                (assignment, treatment) => new { assignment.TreatmentId, assignment.Status, assignment.TotalSessions, assignment.CompletedSessions, Price = assignment.Price ?? treatment.Price })
            .GroupBy(entry => entry.TreatmentId)
            .Select(group => new
            {
                TreatmentId = group.Key,
                Active = group.Count(entry => entry.Status == AssignmentStatuses.EnProgreso),
                Completed = group.Count(entry => entry.Status == AssignmentStatuses.Completado),
                SessionsDone = group.Sum(entry => entry.CompletedSessions),
                SessionsPlanned = group.Sum(entry => entry.TotalSessions),
                Revenue = group.Where(entry => entry.Status == AssignmentStatuses.Completado).Sum(entry => entry.Price),
            })
            .ToDictionaryAsync(entry => entry.TreatmentId, cancellationToken);

        var treatments = await db.Treatments.AsNoTracking().OrderBy(treatment => treatment.Name).ToListAsync(cancellationToken);
        var rows = treatments
            .Where(treatment => treatment.Active || appointments.ContainsKey(treatment.Id) || assignments.ContainsKey(treatment.Id))
            .Select(treatment =>
            {
                var own = assignments.GetValueOrDefault(treatment.Id);
                return new TreatmentReportRow(treatment.Id, treatment.Name, treatment.Price, appointments.GetValueOrDefault(treatment.Id),
                    own?.Active ?? 0, own?.Completed ?? 0, own?.SessionsDone ?? 0, own?.SessionsPlanned ?? 0, own?.Revenue ?? 0);
            })
            .ToList();

        return new TreatmentsReport(rows);
    }

    public async Task<InventoryReport> InventoryAsync(ReportPeriod period, CancellationToken cancellationToken)
    {
        var critical = await db.InventoryItems.AsNoTracking()
            .Where(item => item.Stock <= item.MinStock)
            .OrderBy(item => item.Name)
            .Select(item => new CriticalItemRow(item.Id, item.Name, item.Category, item.Stock, item.MinStock, item.Unit))
            .ToListAsync(cancellationToken);

        var orders = await db.PurchaseOrders.AsNoTracking()
            .Where(order => order.CreatedAt >= period.StartUtc && order.CreatedAt < period.EndUtc)
            .Join(db.Suppliers, order => order.SupplierId, supplier => supplier.Id, (order, supplier) => new
            {
                order.Id,
                SupplierName = supplier.Name,
                order.Status,
                order.CreatedAt,
                Total = db.PurchaseOrderLines.Where(line => line.PurchaseOrderId == order.Id).Sum(line => (decimal?)line.Quantity * line.UnitCost) ?? 0,
            })
            .OrderByDescending(order => order.CreatedAt)
            .ToListAsync(cancellationToken);

        var purchases = orders
            .Select(order => new PurchaseReportRow(order.Id, order.SupplierName, order.Status, PurchaseLabels.GetValueOrDefault(order.Status, order.Status), order.Total, order.CreatedAt))
            .ToList();

        var consumption = await db.StockMovements.AsNoTracking()
            .Where(movement => movement.Type == MovementTypes.Salida && movement.CreatedAt >= period.StartUtc && movement.CreatedAt < period.EndUtc)
            .Join(db.InventoryItems, movement => movement.ItemId, item => item.Id, (movement, item) => new { item.Id, item.Name, item.Unit, movement.Quantity })
            .GroupBy(entry => new { entry.Id, entry.Name, entry.Unit })
            .Select(group => new { group.Key.Id, group.Key.Name, group.Key.Unit, Quantity = group.Sum(entry => entry.Quantity) })
            .OrderByDescending(entry => entry.Quantity)
            .ToListAsync(cancellationToken);

        return new InventoryReport(critical, purchases, purchases.Where(order => order.Status != PurchaseOrderStatuses.Cancelada).Sum(order => order.Total),
            consumption.Select(entry => new ConsumptionRow(entry.Id, entry.Name, entry.Unit, entry.Quantity)).ToList());
    }
}
