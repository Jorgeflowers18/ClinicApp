namespace ClinicApp.Api.Modules.Reports;

// Formas de respuesta de front/src/modules/reports/types/report.types.ts.

/// <summary>
/// <c>PatientsTotal</c> y <c>CriticalStockItems</c> son el estado actual; el resto, del periodo.
/// <c>TreatmentsPerformed</c>: tratamientos realizados (completados) con fecha en el periodo, igual que en el reporte de tratamientos.
/// </summary>
public record ReportsSummary(
    int PatientsTotal, int PatientsNewInPeriod, int AppointmentsInPeriod, int AppointmentsCompleted, int AppointmentsNoShow,
    double NoShowRate, int TreatmentsPerformed, int CriticalStockItems, int NotificationsSent);

public record AgendaDayRow(string Date, string Label, int Total, int Completadas, int NoShow, int Canceladas);

public record AgendaStatusRow(string Status, string Label, int Count);

public record RoomOccupancyRow(string RoomId, string RoomName, int Appointments, int BookedMinutes, int BlockedMinutes);

public record AgendaReport(List<AgendaDayRow> ByDay, List<AgendaStatusRow> ByStatus, List<RoomOccupancyRow> OccupancyByRoom);

public record ProfessionalProductivityRow(
    Guid ProfessionalId, string Name, string Specialty, int Scheduled, int Completed, int NoShow, int Cancelled, double CompletionRate);

public record ProductivityReport(List<ProfessionalProductivityRow> ByProfessional);

public record TreatmentReportRow(
    Guid TreatmentId, string Name, decimal Price, int AppointmentsInPeriod, int ActiveAssignments, int CompletedAssignments,
    int SessionsDone, int SessionsPlanned, decimal EstimatedRevenue);

public record TreatmentsReport(List<TreatmentReportRow> ByTreatment);

public record CriticalItemRow(Guid ItemId, string Name, string Category, int Stock, int MinStock, string Unit);

public record PurchaseReportRow(Guid OrderId, string SupplierName, string Status, string StatusLabel, decimal Total, DateTime CreatedAt);

public record ConsumptionRow(Guid ItemId, string Name, string Unit, int Quantity);

public record InventoryReport(
    List<CriticalItemRow> CriticalItems, List<PurchaseReportRow> PurchasesInPeriod, decimal PurchasesTotal, List<ConsumptionRow> ConsumptionInPeriod);

/// <summary>Filas que devuelven las consultas SQL de la agenda (agrupadas por día de la clínica o por consultorio).</summary>
public sealed class DayStatusCount
{
    public DateOnly Day { get; set; }
    public string Status { get; set; } = "";
    public int Count { get; set; }
}

public sealed class RoomMinutes
{
    public Guid? RoomId { get; set; }
    public int Count { get; set; }
    public int Minutes { get; set; }
}
