namespace ClinicApp.Api.Common;

/// <summary>
/// Funciones de PostgreSQL para buscar texto sin distinguir tildes.
/// <c>unaccent('Pérez')</c> devuelve <c>'Perez'</c>; combinado con ILIKE, "perez" encuentra "Pérez".
/// Requiere la extensión <c>unaccent</c> (la crea la migración CrearPacientes).
/// </summary>
public static class TextSearch
{
    /// <summary>
    /// Se traduce a <c>unaccent(texto)</c> dentro de una consulta LINQ (registrado en AppDbContext).
    /// No se puede llamar fuera de una consulta.
    /// </summary>
    public static string Unaccent(string text) =>
        throw new InvalidOperationException("TextSearch.Unaccent solo se usa dentro de consultas de EF Core.");

    /// <summary>Patrón para ILIKE: "%texto%", escapando los comodines que escriba el usuario.</summary>
    public static string ContainsPattern(string search) =>
        "%" + search.Trim().Replace("\\", "\\\\").Replace("%", "\\%").Replace("_", "\\_") + "%";
}
