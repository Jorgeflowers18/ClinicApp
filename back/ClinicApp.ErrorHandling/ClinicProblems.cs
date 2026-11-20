using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace ClinicApp.ErrorHandling;

public static partial class ClinicProblems
{
    public static ProblemDetails Create(int status, string traceId, ApiFailure? failure = null)
    {
        var code = Identifier(failure?.Code) ?? $"HTTP_{status}";
        var kind = status switch
        {
            401 => "authentication", 403 => "authorization", 404 => "not-found",
            _ when code == "STORAGE_ERROR" || status == 507 => "storage",
            >= 500 => "internal",
            _ when code == "DUPLICATE_RECORD" => "duplicate",
            409 or 412 => "conflict",
            _ when status == 422 || failure?.Errors.Count > 0 => "validation",
            _ => "business"
        };
        var title = kind switch
        {
            "authentication" => "Tu sesión no es válida. Inicia sesión para continuar.",
            "authorization" => "No tienes permiso para realizar esta operación.",
            "not-found" => "El registro ya no está disponible. Actualiza la consulta.",
            "storage" => "No se pudo guardar la información. Revisa el almacenamiento disponible y vuelve a intentar.",
            "internal" => "El servidor no pudo completar la operación. Conserva tus datos e inténtalo más tarde.",
            "duplicate" => "Este registro ya existe. Revísalo antes de volver a guardar.",
            "conflict" => "Los datos cambiaron. Revisa la información actual antes de reintentar; tu formulario se conserva.",
            "validation" => "Revisa los campos indicados y vuelve a guardar.",
            _ => "No se pudo completar la operación. Revisa los datos e inténtalo de nuevo."
        };
        var problem = new ProblemDetails
        {
            Type = $"urn:clinicapp:problem:{kind}", Status = status, Title = title,
            Detail = status >= 500 ? title : SafeMessage(failure?.Message, title)
        };
        problem.Extensions["code"] = code;
        problem.Extensions["kind"] = kind;
        problem.Extensions["traceId"] = Identifier(traceId);
        if (Identifier(failure?.RecordId) is { } recordId) problem.Extensions["recordId"] = recordId;
        problem.Extensions["errors"] = status >= 500 ? Array.Empty<FieldIssue>() : (failure?.Errors ?? [])
            .Where(issue => FieldPath().IsMatch(issue.Field) && issue.Field.Length <= 250)
            .Select(issue => issue with { Message = SafeMessage(issue.Message, "Revisa este campo."), Code = Identifier(issue.Code), RecordId = Identifier(issue.RecordId) })
            .Distinct().Take(200).ToArray();
        return problem;
    }

    public static Task Write(HttpContext context, ProblemDetails problem) =>
        context.Response.WriteAsJsonAsync(problem, options: null,
            contentType: "application/problem+json", cancellationToken: context.RequestAborted);

    private static string? Identifier(string? value) => value is not null && PublicId().IsMatch(value) ? value : null;
    private static string SafeMessage(string? value, string fallback) =>
        string.IsNullOrWhiteSpace(value) || value.Length > 700 || Sensitive().IsMatch(value) ? fallback : value.Trim();

    [GeneratedRegex(@"^[a-zA-Z0-9_.:\-]{1,128}$")]
    private static partial Regex PublicId();
    [GeneratedRegex(@"^[\w$.[\]\-]+$")]
    private static partial Regex FieldPath();
    [GeneratedRegex(@"[<>]|\bat\s+\S+\s*\(|\b(select\s+.+\s+from|insert\s+into|SQLSTATE|SqlException|System\.\w+|StackTrace|Exception:|Bearer\s+\S+|password\s*[:=]|connectionstring|[A-Z]:\\|/var/|/home/)", RegexOptions.IgnoreCase | RegexOptions.Singleline)]
    private static partial Regex Sensitive();
}
