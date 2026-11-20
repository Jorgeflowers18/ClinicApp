using System.ComponentModel.DataAnnotations;
using ClinicApp.Api.Common;

namespace ClinicApp.Api.Modules.ClinicalHistory;

/// <summary>
/// Ayudas para validar las secciones de la historia clínica. Los errores usan los nombres del JSON
/// (camelCase) y una ruta relativa a la sección, por ejemplo <c>conditions.otro.detail</c>; MVC le agrega
/// delante el nombre de la sección (<c>medicalBackground.conditions.otro.detail</c>).
/// </summary>
public static class SectionRules
{
    public const int MaxListItems = 50;

    public static ValidationResult Error(string message, string member) => new(message, [member]);

    /// <summary>"Hoy" en la clínica, para las reglas "no puede ser futura".</summary>
    public static DateOnly Today(ValidationContext context) =>
        (context.GetService(typeof(ClinicClock)) as ClinicClock)?.Today ?? DateOnly.FromDateTime(DateTime.UtcNow);

    /// <summary>Texto con al menos <paramref name="min"/> caracteres sin contar espacios de los extremos.</summary>
    public static bool HasText(string? value, int min) => (value?.Trim().Length ?? 0) >= min;

    /// <summary>"" o una fecha "YYYY-MM-DD".</summary>
    public static bool IsDateOrEmpty(string? value) => new IsoDateAttribute().IsValid(value);

    /// <summary>
    /// Los elementos de una lista (alergias, propuestos...) traen un id que genera el frontend: debe venir,
    /// tener hasta 100 caracteres y no repetirse.
    /// </summary>
    public static IEnumerable<ValidationResult> ValidateIds(IEnumerable<string?> ids, string list)
    {
        var seen = new HashSet<string>();
        var index = 0;
        foreach (var id in ids)
        {
            if (string.IsNullOrWhiteSpace(id) || id.Length > 100)
                yield return Error("Identificador inválido", $"{list}[{index}].id");
            else if (!seen.Add(id))
                yield return Error("Identificador repetido", $"{list}[{index}].id");
            index++;
        }
    }

    /// <summary>Cada valor debe ser una de las opciones permitidas.</summary>
    public static IEnumerable<ValidationResult> ValidateKeys(IEnumerable<string> values, IReadOnlyCollection<string> allowed, string member)
    {
        foreach (var value in values.Where(value => !allowed.Contains(value)))
        {
            yield return Error($"Opción desconocida: {value}", member);
        }
    }

    public static IEnumerable<ValidationResult> ValidateOption(string? value, IReadOnlyCollection<string> allowed, string member)
    {
        if (!allowed.Contains(value ?? "")) yield return Error("Opción inválida", member);
    }
}
