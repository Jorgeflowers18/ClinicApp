using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ClinicApp.Api.Common;

/// <summary>
/// Guarda una clase de C# (por ejemplo, los antecedentes médicos) como un objeto JSON en una columna
/// <c>jsonb</c> de PostgreSQL. Los nombres van en camelCase, igual que en la API y en el frontend.
/// </summary>
public static class JsonbConversion
{
    public static readonly JsonSerializerOptions Options = new(JsonSerializerDefaults.Web);

    /// <summary>Columna jsonb para una sección (clase, lista o diccionario).</summary>
    public static PropertyBuilder<T> HasJsonbConversion<T>(this PropertyBuilder<T> property)
    {
        property
            .HasColumnType("jsonb")
            .HasConversion(
                value => JsonSerializer.Serialize(value, Options),
                text => JsonSerializer.Deserialize<T>(text, Options)!,
                // EF Core detecta los cambios comparando el JSON, porque la clase no sabe compararse sola.
                new ValueComparer<T>(
                    (left, right) => JsonSerializer.Serialize(left, Options) == JsonSerializer.Serialize(right, Options),
                    value => JsonSerializer.Serialize(value, Options).GetHashCode(),
                    value => JsonSerializer.Deserialize<T>(JsonSerializer.Serialize(value, Options), Options)!));
        return property;
    }

    /// <summary>
    /// Columna jsonb para un JSON libre (el odontograma tal como lo exporta la librería, o la copia de una
    /// versión de la historia). No se valida por dentro.
    /// </summary>
    public static PropertyBuilder<JsonElement?> HasJsonbConversion(this PropertyBuilder<JsonElement?> property)
    {
        property
            .HasColumnType("jsonb")
            .HasConversion(
                value => value.HasValue ? value.Value.GetRawText() : null,
                text => text == null ? null : JsonDocument.Parse(text, default).RootElement.Clone(),
                new ValueComparer<JsonElement?>(
                    (left, right) => Raw(left) == Raw(right),
                    value => Raw(value).GetHashCode(),
                    value => value));
        return property;
    }

    private static string Raw(JsonElement? value) => value.HasValue ? value.Value.GetRawText() : "";
}
