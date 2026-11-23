using Microsoft.AspNetCore.OpenApi;
using Microsoft.OpenApi;

namespace ClinicApp.Api.Common;

/// <summary>
/// Declara los números del documento OpenAPI solo como números.
///
/// Por defecto, ASP.NET acepta números escritos como texto ("35") al leer JSON, y por eso el OpenAPI generado
/// decía que cada entero o decimal podía ser <c>integer | string</c> (con un <c>pattern</c>). La API siempre
/// <b>responde</b> números, así que los tipos que genera el frontend (<c>npm run api:types</c>) quedaban como
/// <c>number | string</c> sin necesidad. Este transformador solo cambia la documentación, no cómo se leen
/// las peticiones.
/// </summary>
public sealed class NumericSchemaTransformer : IOpenApiSchemaTransformer
{
    private const JsonSchemaType Numeric = JsonSchemaType.Integer | JsonSchemaType.Number;

    public Task TransformAsync(OpenApiSchema schema, OpenApiSchemaTransformerContext context, CancellationToken cancellationToken)
    {
        if (schema.Type is { } type && (type & Numeric) != 0 && type.HasFlag(JsonSchemaType.String))
        {
            schema.Type = type & ~JsonSchemaType.String;
            schema.Pattern = null;
        }
        return Task.CompletedTask;
    }
}
