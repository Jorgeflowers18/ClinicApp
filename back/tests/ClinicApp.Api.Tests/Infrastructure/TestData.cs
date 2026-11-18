using System.Net;
using System.Text.Json.Nodes;

namespace ClinicApp.Api.Tests.Infrastructure;

/// <summary>Cuerpos de ejemplo válidos y atajos para crear registros en las pruebas.</summary>
public static class TestData
{
    private static int _counter = Random.Shared.Next(100_000, 900_000);

    /// <summary>Número único en la ejecución (para cédulas, nombres...).</summary>
    public static int Next() => Interlocked.Increment(ref _counter);

    /// <summary>Cédula de 10 dígitos que no se repite entre pruebas.</summary>
    public static string DocumentId() => $"17{Next():D8}";

    public static Dictionary<string, object?> PatientBody(string? documentId = null, string firstName = "María", string lastName = "Pérez") => new()
    {
        ["firstName"] = firstName,
        ["lastName"] = lastName,
        ["documentId"] = documentId ?? DocumentId(),
        ["birthDate"] = "1990-05-12",
        ["gender"] = "femenino",
        ["maritalStatus"] = "",
        ["occupation"] = "",
        ["company"] = "",
        ["nationality"] = "Ecuatoriana",
        ["phone"] = "0991234567",
        ["email"] = "",
        ["address"] = "",
        ["city"] = "Quito",
        ["notes"] = "",
        ["notificationsEnabled"] = true,
        ["emergencyContactName"] = "",
        ["emergencyContactRelationship"] = "",
        ["emergencyContactPhone"] = "",
        ["insuranceProvider"] = "",
        ["insurancePolicy"] = "",
        ["consentSigned"] = false,
        ["treatmentStatus"] = "activo",
        ["lastVisitAt"] = "",
    };

    public static async Task<JsonNode> CreatePatientAsync(this HttpClient client, string? firstName = null, string? lastName = null)
    {
        var body = PatientBody(firstName: firstName ?? "Paciente", lastName: lastName ?? $"Prueba {Next()}");
        return (await client.PostJson("/api/patients", body, HttpStatusCode.Created))!;
    }

    /// <summary>
    /// Un profesional para usar en las pruebas. Hasta que exista el catálogo de profesionales, cualquier id sirve.
    /// </summary>
    public static Task<Guid> ProfessionalIdAsync(this HttpClient client) => Task.FromResult(Guid.NewGuid());

    /// <summary>Fecha "YYYY-MM-DD".</summary>
    public static string Iso(this DateOnly date) => date.ToString("yyyy-MM-dd");

    /// <summary>Hoy en Ecuador (la zona de la clínica en las pruebas).</summary>
    public static DateOnly TodayInClinic() =>
        DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, TimeZoneInfo.FindSystemTimeZoneById("America/Guayaquil")));
}
