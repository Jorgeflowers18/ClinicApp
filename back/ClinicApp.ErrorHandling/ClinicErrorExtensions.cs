using System.Diagnostics;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace ClinicApp.ErrorHandling;

public static class ClinicErrorExtensions
{
    public static IServiceCollection AddClinicAppErrors(this IServiceCollection services)
    {
        services.Configure<ApiBehaviorOptions>(options => options.InvalidModelStateResponseFactory = action =>
        {
            var issues = action.ModelState.SelectMany(entry => entry.Value?.Errors.Select(error =>
                new FieldIssue(entry.Key, string.IsNullOrWhiteSpace(error.ErrorMessage) ? "Revisa el formato de este campo." : error.ErrorMessage)) ?? []);
            var failure = new ApiFailure(400, "VALIDATION_ERROR", "Revisa los campos indicados y vuelve a guardar.", issues);
            var result = new BadRequestObjectResult(ClinicProblems.Create(400, action.HttpContext.TraceIdentifier, failure));
            result.ContentTypes.Add("application/problem+json");
            return result;
        });
        return services;
    }

    /// <summary>Register before authentication, authorization and endpoints. Does not change their policies.</summary>
    public static IApplicationBuilder UseClinicAppErrors(this IApplicationBuilder app) => app.UseMiddleware<ClinicErrorMiddleware>();
}

public sealed class ClinicErrorMiddleware(RequestDelegate next, ILogger<ClinicErrorMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext context)
    {
        // Server-generated; never echo untrusted request headers as a tracking identifier.
        context.TraceIdentifier = Activity.Current?.TraceId.ToString() ?? Guid.NewGuid().ToString("N");
        context.Response.Headers["X-Request-ID"] = context.TraceIdentifier;
        try
        {
            await next(context);
            if (context.Response.StatusCode >= 400 && !context.Response.HasStarted && context.Response.ContentLength is null or 0 && context.Response.ContentType is null)
                await ClinicProblems.Write(context, ClinicProblems.Create(context.Response.StatusCode, context.TraceIdentifier));
        }
        catch (OperationCanceledException) when (context.RequestAborted.IsCancellationRequested) { /* The client disconnected; never report a successful save. */ }
        catch (Exception exception) when (!context.Response.HasStarted)
        {
            var failure = exception as ApiFailure;
            var status = failure?.Status ?? 500;
            var problem = ClinicProblems.Create(status, context.TraceIdentifier, failure);
            // Diagnostic metadata only; no patient names, body, credentials or exception text.
            logger.Log(status >= 500 ? LogLevel.Error : LogLevel.Warning,
                "API failure {Code}, trace {TraceId}, exception type {ExceptionType}",
                problem.Extensions["code"], context.TraceIdentifier, exception.GetType().Name);
            context.Response.Clear();
            context.Response.StatusCode = status;
            context.Response.Headers["X-Request-ID"] = context.TraceIdentifier;
            await ClinicProblems.Write(context, problem);
        }
    }
}
