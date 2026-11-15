namespace ClinicApp.Api.Modules.Auth;

/// <summary>Roles del sistema. Son los mismos valores que usa el frontend (auth.types.ts).</summary>
public static class Roles
{
    public const string Admin = "admin";
    public const string Recepcion = "recepcion";
    public const string Medico = "medico";

    /// <summary>Para <c>[Authorize(Roles = ...)]</c>: cualquiera de los tres roles.</summary>
    public const string Todos = $"{Admin},{Recepcion},{Medico}";

    /// <summary>Para <c>[Authorize(Roles = ...)]</c>: admin o recepción (inventario, notificaciones, finanzas).</summary>
    public const string AdminYRecepcion = $"{Admin},{Recepcion}";

    public static readonly IReadOnlyList<string> All = [Admin, Recepcion, Medico];
}
