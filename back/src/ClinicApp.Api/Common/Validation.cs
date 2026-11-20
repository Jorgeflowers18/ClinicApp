using System.ComponentModel.DataAnnotations;
using System.Globalization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;

namespace ClinicApp.Api.Common;

/// <summary>Piezas comunes para responder errores de validación (400) con el mismo formato en toda la API.</summary>
public static class Validation
{
    /// <summary>Título de los 400 de validación. El frontend lo muestra como mensaje general.</summary>
    public const string Title = "Revisa los datos ingresados";

    /// <summary>
    /// 400 con los errores que el controlador agregó a mano al ModelState (por ejemplo, "el insumo no existe"),
    /// con la misma forma que los errores automáticos de [ApiController].
    /// </summary>
    public static ObjectResult ValidationError(this ControllerBase controller, ModelStateDictionary modelState, string title = Title) =>
        controller.ValidationProblem(title: title, modelStateDictionary: modelState) as ObjectResult
        ?? throw new InvalidOperationException("ValidationProblem no devolvió un ObjectResult.");

    /// <summary>
    /// 409 con el mismo formato de los errores de validación, marcando el campo que choca
    /// (por ejemplo, "documentId": "Ya existe un paciente con esta cédula"). Así el formulario
    /// del frontend lo muestra junto al campo.
    /// </summary>
    public static ObjectResult FieldConflict(this ControllerBase controller, string field, string message)
    {
        var modelState = new ModelStateDictionary();
        modelState.AddModelError(field, message);
        var result = controller.ValidationProblem(title: message, statusCode: StatusCodes.Status409Conflict, modelStateDictionary: modelState) as ObjectResult
            ?? throw new InvalidOperationException("ValidationProblem no devolvió un ObjectResult.");
        result.StatusCode = StatusCodes.Status409Conflict;
        return result;
    }

    /// <summary>Texto opcional limpio: sin espacios al inicio ni al final, y "" en lugar de null.</summary>
    public static string Clean(string? value) => value?.Trim() ?? "";

    /// <summary>Correo opcional: "" o un correo con @ y dominio (misma regla que los proveedores).</summary>
    public const string OptionalEmailPattern = @"^\s*([^@\s]+@[^@\s]+\.[^@\s]+)?\s*$";

    /// <summary>Convierte "YYYY-MM-DD" en DateOnly. Vacío o null → null.</summary>
    public static DateOnly? ParseDate(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : DateOnly.ParseExact(value.Trim(), IsoDateAttribute.Format, CultureInfo.InvariantCulture);
}

/// <summary>
/// Fecha sin hora en formato "YYYY-MM-DD" (lo que envía un input type="date").
/// Acepta vacío o null: si el campo es obligatorio, se combina con [Required].
/// Se recibe como texto porque el formulario manda "" cuando la fecha opcional queda vacía,
/// y "" no se puede convertir directamente a DateOnly.
/// </summary>
[AttributeUsage(AttributeTargets.Property)]
public sealed class IsoDateAttribute() : ValidationAttribute("Fecha inválida (formato AAAA-MM-DD)")
{
    public const string Format = "yyyy-MM-dd";

    public override bool IsValid(object? value) =>
        value is null
        || value is string text && (string.IsNullOrWhiteSpace(text)
            || DateOnly.TryParseExact(text.Trim(), Format, CultureInfo.InvariantCulture, DateTimeStyles.None, out _));
}
