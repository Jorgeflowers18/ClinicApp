using ClinicApp.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace ClinicApp.Api.Modules.Institution;

/// <summary>
/// Crea el perfil de la institución al arrancar si no existe (en cualquier entorno), con los valores de
/// <c>initialInstitutionProfile</c> del frontend. Así la API nunca tiene que manejar "sin perfil".
/// El nombre inicial se puede cambiar con <c>Seed:InstitutionName</c>.
/// </summary>
public static class InstitutionSeeder
{
    public static async Task SeedInstitutionAsync(this WebApplication app)
    {
        using var scope = app.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var logger = scope.ServiceProvider.GetRequiredService<ILogger<InstitutionProfile>>();

        try
        {
            if (await db.Institutions.AnyAsync(profile => profile.Id == InstitutionProfile.SingleId)) return;

            db.Institutions.Add(new InstitutionProfile
            {
                Id = InstitutionProfile.SingleId,
                Name = app.Configuration["Seed:InstitutionName"] ?? "ClinicApp Odontología",
                LogoText = "CA",
                Hours = "Lunes a viernes: 08:00 - 18:00\nSábados: 08:00 - 13:00",
                UpdatedAt = DateTime.UtcNow,
            });
            await db.SaveChangesAsync();
            logger.LogInformation("Se creó el perfil inicial de la institución.");
        }
        catch (Exception exception)
        {
            logger.LogError(exception, "No se pudo crear el perfil de la institución. ¿Están aplicadas las migraciones?");
        }
    }
}
