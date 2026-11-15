using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.WebUtilities;

namespace ClinicApp.Api.Common;

/// <summary>
/// Ajustes comunes para todas las respuestas de error (formato ProblemDetails):
/// los 404 de los controladores, las rutas que no existen, los 405 y los errores inesperados (500).
/// El frontend (shared/lib/http.ts) muestra <c>detail</c> si existe y, si no, <c>title</c>.
/// </summary>
public static class ProblemDetailsSetup
{
    // Títulos en español para los errores genéricos que genera .NET.
    private static readonly Dictionary<int, string> SpanishTitles = new()
    {
        [StatusCodes.Status400BadRequest] = "Solicitud inválida",
        [StatusCodes.Status401Unauthorized] = "Inicia sesión para continuar",
        [StatusCodes.Status403Forbidden] = "No tienes permiso para realizar esta acción",
        [StatusCodes.Status404NotFound] = "Recurso no encontrado",
        [StatusCodes.Status405MethodNotAllowed] = "Método no permitido",
        [StatusCodes.Status409Conflict] = "La operación entra en conflicto con los datos actuales",
        [StatusCodes.Status415UnsupportedMediaType] = "Formato de datos no soportado",
        [StatusCodes.Status500InternalServerError] = "Ocurrió un error inesperado",
    };

    // Título en inglés que .NET pone por defecto a los 500.
    private const string DefaultServerErrorTitle = "An error occurred while processing your request.";

    public static void Customize(ProblemDetailsContext context)
    {
        var problem = context.ProblemDetails;
        var status = problem.Status ?? context.HttpContext.Response.StatusCode;

        // Solo se traducen los títulos genéricos. Los que escribimos en un controlador
        // (por ejemplo "Tratamiento no encontrado") se dejan como están.
        if (IsDefaultTitle(problem.Title, status) && SpanishTitles.TryGetValue(status, out var title))
        {
            problem.Title = title;
        }

        // Error inesperado (una excepción que nadie atrapó).
        // En desarrollo se muestra el mensaje de la excepción para depurar.
        // En producción nunca: puede revelar tablas, consultas o rutas del servidor.
        // El detalle completo queda siempre en el log, y el "traceId" de la respuesta permite encontrarlo.
        //
        // La excepción se lee de IExceptionHandlerFeature: con controladores, .NET escribe el error
        // con su propio escritor (DefaultApiProblemDetailsWriter) y context.Exception llega vacío.
        var exception = context.Exception
            ?? context.HttpContext.Features.Get<IExceptionHandlerFeature>()?.Error;

        if (exception is not null)
        {
            var environment = context.HttpContext.RequestServices.GetRequiredService<IHostEnvironment>();
            problem.Detail = environment.IsDevelopment() ? exception.Message : null;
        }
    }

    private static bool IsDefaultTitle(string? title, int status) =>
        string.IsNullOrEmpty(title)
        || title == ReasonPhrases.GetReasonPhrase(status) // "Not Found", "Method Not Allowed"...
        || title == DefaultServerErrorTitle;
}
