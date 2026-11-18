using ClinicApp.Api.Common;
using ClinicApp.Api.Modules.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ClinicApp.Api.Modules.Reports;

/// <summary>
/// Reportes por periodo: /api/reports?from=YYYY-MM-DD&amp;to=YYYY-MM-DD (inclusivos, en hora de la clínica).
///
/// Roles: el resumen y la agenda los usa también la página de Inicio, que ven los tres roles, y no muestran
/// dinero: quedan abiertos a los tres. Productividad, tratamientos (trae ingresos) e inventario: solo admin.
/// </summary>
[ApiController]
[Route("api/reports")]
[Authorize(Roles = Roles.Todos)]
public class ReportsController(ReportQueries reports, ClinicClock clock) : ControllerBase
{
    [HttpGet("summary")]
    public Task<ActionResult<ReportsSummary>> Summary([FromQuery] string? from, [FromQuery] string? to, CancellationToken cancellationToken) =>
        Run(from, to, period => reports.SummaryAsync(period, cancellationToken));

    [HttpGet("agenda")]
    public Task<ActionResult<AgendaReport>> Agenda([FromQuery] string? from, [FromQuery] string? to, CancellationToken cancellationToken) =>
        Run(from, to, period => reports.AgendaAsync(period, cancellationToken));

    [HttpGet("productivity")]
    [Authorize(Roles = Roles.Admin)]
    public Task<ActionResult<ProductivityReport>> Productivity([FromQuery] string? from, [FromQuery] string? to, CancellationToken cancellationToken) =>
        Run(from, to, period => reports.ProductivityAsync(period, cancellationToken));

    [HttpGet("treatments")]
    [Authorize(Roles = Roles.Admin)]
    public Task<ActionResult<TreatmentsReport>> Treatments([FromQuery] string? from, [FromQuery] string? to, CancellationToken cancellationToken) =>
        Run(from, to, period => reports.TreatmentsAsync(period, cancellationToken));

    [HttpGet("inventory")]
    [Authorize(Roles = Roles.Admin)]
    public Task<ActionResult<InventoryReport>> Inventory([FromQuery] string? from, [FromQuery] string? to, CancellationToken cancellationToken) =>
        Run(from, to, period => reports.InventoryAsync(period, cancellationToken));

    /// <summary>Valida el periodo (400 por campo) y calcula el reporte.</summary>
    private async Task<ActionResult<T>> Run<T>(string? from, string? to, Func<ReportPeriod, Task<T>> build)
    {
        var period = ReportPeriod.TryCreate(from, to, clock, out var errors);
        if (period is null)
        {
            foreach (var (field, message) in errors) ModelState.AddModelError(field, message);
            return this.ValidationError(ModelState);
        }
        return await build(period);
    }
}
