using Microsoft.EntityFrameworkCore;

namespace ClinicApp.Api.Common;

/// <summary>
/// Parámetros de paginación que manda el frontend en la URL: ?page=1&amp;pageSize=10&amp;search=texto
/// </summary>
public record PageQuery(int Page = 1, int PageSize = 10, string? Search = null)
{
    public const int MaxPageSize = 100;

    /// <summary>Página válida: nunca menor que 1.</summary>
    public int SafePage => Page < 1 ? 1 : Page;

    /// <summary>Tamaño válido: entre 1 y 100, para que nadie pida un millón de filas.</summary>
    public int SafePageSize => PageSize < 1 ? 10 : Math.Min(PageSize, MaxPageSize);
}

/// <summary>
/// Respuesta paginada con la misma forma que <c>Paginated&lt;T&gt;</c> del frontend.
/// </summary>
public record PagedResult<T>(IReadOnlyList<T> Items, int Page, int PageSize, int TotalItems, int TotalPages);

public static class PagingExtensions
{
    /// <summary>
    /// Pagina cualquier consulta de EF Core: cuenta el total y trae solo las filas de la página pedida.
    /// </summary>
    public static async Task<PagedResult<T>> ToPagedResultAsync<T>(
        this IQueryable<T> query, PageQuery pageQuery, CancellationToken cancellationToken = default)
    {
        var page = pageQuery.SafePage;
        var pageSize = pageQuery.SafePageSize;

        var totalItems = await query.CountAsync(cancellationToken);
        var items = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        var totalPages = Math.Max(1, (int)Math.Ceiling(totalItems / (double)pageSize));
        return new PagedResult<T>(items, page, pageSize, totalItems, totalPages);
    }
}
