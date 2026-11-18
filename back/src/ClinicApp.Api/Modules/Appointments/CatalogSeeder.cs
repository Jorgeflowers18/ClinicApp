using ClinicApp.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace ClinicApp.Api.Modules.Appointments;

/// <summary>
/// En desarrollo, si no hay profesionales ni consultorios, crea los del modo mock del frontend
/// (appointments.mock-data.ts) y vincula la cuenta medico@clinica.com con la Dra. Carla Ríos.
/// </summary>
public static class CatalogSeeder
{
    private static readonly (string Name, string Specialty, string Registration)[] DevelopmentProfessionals =
    [
        ("Dra. Carla Ríos", "Odontología general", "MSP-17-04581"),
        ("Dr. Andrés Vega", "Ortodoncia", "MSP-17-03922"),
        ("Dra. Paula Nieto", "Endodoncia", "MSP-09-01157"),
    ];

    private static readonly string[] DevelopmentRooms = ["Consultorio 1", "Consultorio 2", "Consultorio 3"];

    public static async Task SeedCatalogsAsync(this WebApplication app)
    {
        if (!app.Environment.IsDevelopment()) return;

        using var scope = app.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var logger = scope.ServiceProvider.GetRequiredService<ILogger<Professional>>();

        try
        {
            var now = DateTime.UtcNow;

            if (!await db.Professionals.AnyAsync())
            {
                var created = DevelopmentProfessionals
                    .Select(item => new Professional
                    {
                        Id = Guid.CreateVersion7(),
                        Name = item.Name,
                        Specialty = item.Specialty,
                        RegistrationNumber = item.Registration,
                        CreatedAt = now,
                    })
                    .ToList();
                db.Professionals.AddRange(created);

                var medico = await db.Users.FirstOrDefaultAsync(user => user.Email == "medico@clinica.com" && user.ProfessionalId == null);
                if (medico is not null) medico.ProfessionalId = created[0].Id;
            }

            if (!await db.Rooms.AnyAsync())
            {
                db.Rooms.AddRange(DevelopmentRooms.Select(name => new Room { Id = Guid.CreateVersion7(), Name = name, CreatedAt = now }));
            }

            await db.SaveChangesAsync();
        }
        catch (Exception exception)
        {
            logger.LogError(exception, "No se pudieron crear los profesionales y consultorios de desarrollo.");
        }
    }
}
